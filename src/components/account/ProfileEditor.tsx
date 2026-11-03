import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Avatar from '../Avatar';
import Icon from '../Icon';
import { buildPublicData } from '../AccountRuntime';
import { gql } from '../../lib/anilist';
import { AVATAR_COLORS, BUNDLES, EFFECTS, FRAMES, NAME_COLORS, NAME_FONTS, NAMEPLATES, PFRAMES, bundleItems, isUnlocked, unlockProgress, unlockText } from '../../lib/decorations';
import type { Bundle, NameFont, NameStyle } from '../../lib/decorations';
import ProfileCard, { loadNameFont } from '../ProfileCard';
import { earnedBadges } from '../../lib/badges';
import { watchStats } from '../../lib/stats';
import ProfileFrame from '../ProfileFrame';
import type { DecoItem } from '../../lib/decorations';
import { USERNAME_RE, cleanUsername, discordInfo, hasDiscord, discordPlate, saveProfile, usernameFree, useProfile } from '../../lib/profile';
import type { Avatar as AvatarData, Deco } from '../../lib/profile';
import { CINEMA_ORIGIN, onProd } from '../../lib/site';
import { useApp } from '../../state';

type PicTab = 'letter' | 'anime' | 'stars' | 'discord';
interface Pic { url: string; name: string }

async function searchCharacters(q: string): Promise<Pic[]> {
  const d = q
    ? await gql(`query($s:String){ Page(perPage:24){ characters(search:$s, sort:FAVOURITES_DESC){ name{ full } image{ large } } } }`, { s: q })
    : await gql(`query{ Page(perPage:30){ characters(sort:FAVOURITES_DESC){ name{ full } image{ large } } } }`, {});
  return ((d?.Page?.characters ?? []) as any[]).filter((c) => c.image?.large && !/default\.jpg$/.test(c.image.large)).map((c) => ({ url: c.image.large, name: c.name?.full ?? '' }));
}
async function searchStars(q: string): Promise<Pic[]> {
  const path = q ? `/search/person?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1` : '/person/popular?language=en-US&page=1';
  const r = await fetch('/api/tmdb?path=' + encodeURIComponent(path));
  const j = r.ok ? await r.json() : null;
  return ((j?.results ?? []) as any[]).filter((p) => p.profile_path && !p.adult).slice(0, 24).map((p) => ({ url: `https://image.tmdb.org/t/p/w185${p.profile_path}`, name: p.name }));
}

interface Banner { url: string; name: string }
async function bannersTmdb(q: string): Promise<Banner[]> {
  const path = q ? `/search/multi?query=${encodeURIComponent(q)}&include_adult=false&language=en-US&page=1` : '/trending/all/week?language=en-US';
  const r = await fetch('/api/tmdb?path=' + encodeURIComponent(path));
  const j = r.ok ? await r.json() : null;
  return ((j?.results ?? []) as any[]).filter((m) => m.backdrop_path).slice(0, 18).map((m) => ({ url: `https://image.tmdb.org/t/p/w780${m.backdrop_path}`, name: m.title || m.name || '' }));
}
async function bannersAnime(q: string): Promise<Banner[]> {
  const d = q
    ? await gql(`query($s:String){ Page(perPage:30){ media(search:$s, type:ANIME, sort:POPULARITY_DESC){ bannerImage title{ english romaji } } } }`, { s: q })
    : await gql(`query{ Page(perPage:30){ media(type:ANIME, sort:TRENDING_DESC){ bannerImage title{ english romaji } } } }`, {});
  return ((d?.Page?.media ?? []) as any[]).filter((m) => m.bannerImage).slice(0, 18).map((m) => ({ url: m.bannerImage, name: m.title?.english || m.title?.romaji || '' }));
}

/** Username, picture, decorations and the public profile switch. */
export default function ProfileEditor() {
  const { session, getToken, loved, history } = useApp();
  const profile = useProfile();
  const [name, setName] = useState(profile?.username ?? '');
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<PicTab>('letter');
  const [q, setQ] = useState('');
  const [pics, setPics] = useState<Pic[] | null>(null);
  const [shown, setShown] = useState(''); // what the pictures below are for ('' = popular)
  const [round, setRound] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, bumpLinked] = useState(0);
  useEffect(() => {
    // the Discord picture / decoration / nameplate / banner arrive a moment after the page opens
    const f = () => bumpLinked((n) => n + 1);
    window.addEventListener('comvie:linked', f);
    return () => window.removeEventListener('comvie:linked', f);
  }, []);
  const discord = discordInfo();
  const stats = useMemo(() => watchStats(), []);
  const [peek, setPeek] = useState<Deco | null>(null); // what the live preview shows while hovering an item
  const [btab, setBtab] = useState<'tmdb' | 'anime' | 'discord'>('tmdb');
  const [bq, setBq] = useState('');
  const [banners, setBanners] = useState<Banner[] | null>(null);
  const [bshown, setBshown] = useState('');
  const [bround, setBround] = useState(0);
  const [note, setNote] = useState<string | null>(null);

  // banner tabs: popular backdrops / banners straight away
  useEffect(() => {
    if (btab === 'discord') return;
    let live = true;
    setBanners(null);
    setBshown('');
    (btab === 'tmdb' ? bannersTmdb('') : bannersAnime(''))
      .then((x) => live && setBanners(x))
      .catch((e) => {
        console.error('[profile] banners', e);
        if (live) setBanners([]);
      });
    return () => {
      live = false;
    };
  }, [btab, bround]);
  // show every name font in the pickers
  useEffect(() => NAME_FONTS.forEach((f) => loadNameFont(f.id)), []);

  useEffect(() => setName(profile?.username ?? ''), [profile?.username]);

  // open a picture tab -> the most popular characters / stars appear right away
  useEffect(() => {
    if (tab !== 'anime' && tab !== 'stars') return;
    let live = true;
    setPics(null);
    setShown('');
    (tab === 'stars' ? searchStars('') : searchCharacters(''))
      .then((x) => live && setPics(x))
      .catch((e) => {
        console.error('[profile] popular pictures', e);
        if (live) setPics([]);
      });
    return () => {
      live = false;
    };
  }, [tab, round]);

  // live "is it free?" check while typing a username
  useEffect(() => {
    const n = name.trim();
    if (!n || n === profile?.username) return setNameMsg(null);
    if (!USERNAME_RE.test(n)) return setNameMsg({ ok: false, text: '3 to 20 lowercase letters, numbers or underscores.' });
    let live = true;
    const t = window.setTimeout(() => {
      usernameFree(n).then((free) => live && setNameMsg(free ? { ok: true, text: 'Available' } : { ok: false, text: 'Taken. Try another.' }));
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [name, profile?.username]);

  if (!session || !profile) {
    return <p className="muted small">Loading your profile… (if this stays, run the latest supabase/schema.sql in Supabase)</p>;
  }

  const save = async (patch: Parameters<typeof saveProfile>[1]) => {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again, then try once more.');
      await saveProfile(token, patch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
    }
    setBusy(false);
  };

  const saveName = async () => {
    const n = name.trim();
    if (!USERNAME_RE.test(n)) return setNameMsg({ ok: false, text: '3 to 20 lowercase letters, numbers or underscores.' });
    await save({ username: n });
  };

  const search = async () => {
    const t = q.trim();
    if (t.length === 1) return;
    setPics(null);
    setShown(t);
    try {
      setPics(tab === 'stars' ? await searchStars(t) : await searchCharacters(t));
    } catch (e) {
      console.error('[profile] picture search', e);
      setPics([]);
    }
  };

  const searchBanners = async () => {
    const t = bq.trim();
    if (t.length < 2) return;
    setBanners(null);
    setBshown(t);
    try {
      setBanners(btab === 'tmdb' ? await bannersTmdb(t) : await bannersAnime(t));
    } catch (e) {
      console.error('[profile] banner search', e);
      setBanners([]);
    }
  };

  const setAvatar = (a: AvatarData) => void save({ avatar: a });
  // one avatar decoration and one nameplate at a time: picking one of ours replaces the Discord one, and the other way round
  const merge = (d: Deco): Deco => {
    const next: Deco = { ...profile.deco, ...d };
    if ('frame' in d && !('discord' in d)) next.discord = '';
    if (d.discord) next.frame = '';
    if ('nameplate' in d && !('dplate' in d)) next.dplate = '';
    if (d.dplate) next.nameplate = '';
    return next;
  };
  const setDeco = (d: Deco) => {
    setPeek(null);
    void save({ deco: merge(d) });
  };
  // hovering (or focusing) an item shows it on the preview card
  const peekProps = (d: Deco) => ({
    onMouseEnter: () => setPeek(merge(d)),
    onMouseLeave: () => setPeek(null),
    onFocus: () => setPeek(merge(d)),
    onBlur: () => setPeek(null)
  });
  const tryItem = (it: DecoItem, d: Deco) => {
    if (!isUnlocked(it, stats)) {
      setNote(`${it.name} is locked: ${unlockText(it.unlock!)} (${unlockProgress(it.unlock!, stats)}).`);
      return;
    }
    setNote(null);
    setDeco(d);
  };
  const wearSet = (b: Bundle) => {
    const items = bundleItems(b);
    const locked = items.filter((x) => !isUnlocked(x.item, stats));
    const d: Deco = { discord: '', dplate: '' };
    const map: Record<string, keyof Deco> = { 'Avatar decoration': 'frame', 'Profile frame': 'pframe', Nameplate: 'nameplate', 'Profile decoration': 'effect', 'Name colour': 'nameColor', 'Name font': 'nameFont' };
    for (const x of items) if (isUnlocked(x.item, stats)) (d as any)[map[x.kind]] = x.item!.id;
    setNote(locked.length ? `Wearing ${b.name}. Still locked: ${locked.map((x) => `${x.item!.name} (${unlockText(x.item!.unlock!)})`).join(', ')}.` : `Wearing the full ${b.name} set.`);
    setPeek(null);
    void save({ deco: { ...profile.deco, ...d } });
  };
  const letter = profile.username || session.email;
  const publicUrl = `${onProd() ? CINEMA_ORIGIN : location.origin}/u/${profile.username ?? ''}`;

  type Key = 'frame' | 'nameplate' | 'effect' | 'pframe' | 'nameColor' | 'nameFont';
  const decoGrid = (items: DecoItem[], current: string | undefined, key: Key, extra?: ReactNode) => (
    <div className="pe-grid">
      <button type="button" className={`pe-opt ${!current ? 'on' : ''}`} disabled={busy} onClick={() => setDeco({ [key]: '' })} {...peekProps({ [key]: '' })}>
        <span className="pe-none"><Icon name="x" size={16} /></span>
        <small>None</small>
      </button>
      {extra}
      {items.map((it) => {
        const locked = !isUnlocked(it, stats);
        return (
          <button
            key={it.id}
            type="button"
            className={`pe-opt ${current === it.id ? 'on' : ''} ${locked ? 'locked' : ''}`}
            disabled={busy}
            onClick={() => tryItem(it, { [key]: it.id })}
            title={locked ? `${it.name}: ${unlockText(it.unlock!)}` : it.name}
            {...peekProps({ [key]: it.id })}
          >
            {key === 'frame' ? (
              <Avatar avatar={profile.avatar} deco={{ frame: it.id }} letter={letter} size={46} still />
            ) : key === 'pframe' ? (
              <span className="pe-mini pf-wrap has-pf"><span className="pe-mini-card" /><ProfileFrame id={it.id} still /></span>
            ) : key === 'nameColor' ? (
              <span className={`pe-namesw sname sname-c sname-${it.id}`} style={{ backgroundImage: (it as NameStyle).css }}>Aa</span>
            ) : key === 'nameFont' ? (
              <span className="pe-namesw" style={{ fontFamily: (it as NameFont).family }}>Aa</span>
            ) : (
              <span className={`pe-swatch ${key === 'nameplate' ? `np-${it.id}` : 'pe-fx'}`} style={key === 'nameplate' ? { backgroundImage: `url(/deco/nameplates/${it.id}-still.svg)` } : undefined}>
                {key === 'effect' && <span className={`fx fx-${it.id}`} style={{ backgroundImage: `url(/deco/effects/${it.id}-still.svg)` }} />}
              </span>
            )}
            <small>{it.name}</small>
            {locked ? (
              <em className="pe-lock"><Icon name="lock" size={11} />{unlockProgress(it.unlock!, stats)}</em>
            ) : (
              <em className={`pe-theme t-${it.theme}`}>{it.theme === 'anime' ? 'Anime' : it.theme === 'movie' ? 'Movie' : ''}</em>
            )}
          </button>
        );
      })}
    </div>
  );
  const previewDeco = peek ?? profile.deco;
  const myBadges = earnedBadges(stats, { joined: profile.created_at, discord: hasDiscord() });

  return (
    <div className="pe">
      <div className="pe-preview" aria-live="polite">
        <ProfileCard avatar={profile.avatar} deco={previewDeco} name={profile.username ? `@${profile.username}` : letter.split('@')[0]} badges={myBadges} size={76}>
          <p className="muted small">{peek ? 'Preview: tap to wear it' : 'Your profile card'}</p>
        </ProfileCard>
      </div>
      {error && <p className="error">{error}</p>}
      {note && <p className="small pe-note">{note}</p>}

      <div className="pe-block">
        <h3>Sets</h3>
        <p className="muted small pe-sub0">Wear every matching piece in one tap. Locked pieces unlock as you watch.</p>
        <div className="pe-grid pe-sets">
          {BUNDLES.map((bd) => {
            const items = bundleItems(bd);
            const open = items.filter((x) => isUnlocked(x.item, stats)).length;
            const color = NAME_COLORS.find((x) => x.id === bd.deco.nameColor);
            const font = NAME_FONTS.find((x) => x.id === bd.deco.nameFont);
            return (
              <button key={bd.id} type="button" className="pe-opt pe-set" disabled={busy} onClick={() => wearSet(bd)} {...peekProps({ ...bd.deco, discord: '', dplate: '' })}>
                <span className={`pe-setbg np-${bd.deco.nameplate}`} style={{ backgroundImage: `url(/deco/nameplates/${bd.deco.nameplate}-still.svg)` }}>
                  <Avatar avatar={profile.avatar} deco={{ frame: bd.deco.frame }} letter={letter} size={34} still />
                  <span className={`sname ${color ? `sname-c sname-${color.id}` : ''}`} style={{ backgroundImage: color?.css, fontFamily: font?.family }}>{profile.username || 'you'}</span>
                </span>
                <small>{bd.name}</small>
                <em className={`pe-theme ${open < items.length ? 'pe-part' : ''}`}>{open}/{items.length}</em>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pe-block">
        <h3>Username</h3>
        <div className="pe-row">
          <span className="auth-input pe-name">
            <span className="pe-at">@</span>
            <input value={name} maxLength={20} placeholder="kawai_pirate" onChange={(e) => setName(cleanUsername(e.target.value.replace(/^@/, '')) || e.target.value.toLowerCase().slice(0, 20))} aria-label="Username" />
          </span>
          <button className="btn primary" disabled={busy || !name.trim() || name.trim() === profile.username || nameMsg?.ok === false} onClick={() => void saveName()}>Save</button>
        </div>
        {nameMsg && <p className={`small ${nameMsg.ok ? 'pe-ok' : 'error'}`}>{nameMsg.text}</p>}
      </div>

      <div className="pe-block">
        <h3>Picture</h3>
        <div className="seg pe-tabs" role="tablist">
          {(['letter', 'anime', 'stars', ...(discord?.avatar ? ['discord'] : [])] as PicTab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setQ(''); }}>
              {t === 'letter' ? 'Letter' : t === 'anime' ? 'Anime character' : t === 'stars' ? 'Movie & TV star' : 'Discord'}
            </button>
          ))}
        </div>
        {tab === 'letter' && (
          <div className="pe-colors">
            {AVATAR_COLORS.map((c) => (
              <button key={c} type="button" className={`pe-color ${!profile.avatar.url && profile.avatar.color === c ? 'on' : ''}`} style={{ background: c }} disabled={busy} aria-label={`Colour ${c}`} onClick={() => setAvatar({ color: c })}>
                {letter.charAt(0).toUpperCase()}
              </button>
            ))}
          </div>
        )}
        {(tab === 'anime' || tab === 'stars') && (
          <>
            <form className="pe-row" onSubmit={(e) => { e.preventDefault(); void search(); }}>
              <span className="auth-input"><Icon name="search" size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'anime' ? 'Search a character (e.g. Frieren)' : 'Search an actor (e.g. Zendaya)'} /></span>
              <button className="btn" type="submit">Search</button>
            </form>
            <p className="muted small pe-sub">
              {shown ? <>Results for “{shown}” · <button type="button" className="link" onClick={() => { setQ(''); setRound((n) => n + 1); }}>show popular</button></> : tab === 'anime' ? 'Most popular characters' : 'Popular right now'}
            </p>
            {!pics && <div className="pe-pics">{Array.from({ length: 12 }, (_, i) => <span key={i} className="pe-pic skel" />)}</div>}
            {pics && (pics.length === 0 ? <p className="muted small">Nothing found. Try another name.</p> : (
              <div className="pe-pics">
                {pics.map((p) => (
                  <button key={p.url} type="button" className={`pe-pic ${profile.avatar.url === p.url ? 'on' : ''}`} disabled={busy} onClick={() => setAvatar({ url: p.url })} title={p.name}>
                    <img src={p.url} alt={p.name} loading="lazy" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            ))}
          </>
        )}
        {tab === 'discord' && discord?.avatar && (
          <div className="pe-row">
            <Avatar avatar={{ url: discord.avatar }} letter={discord.name} size={56} />
            <button className="btn" disabled={busy} onClick={() => setAvatar({ url: discord.avatar! })}>Use my Discord picture</button>
          </div>
        )}
      </div>

      <div className="pe-block">
        <h3>Avatar decoration</h3>
        {decoGrid(
          FRAMES,
          profile.deco.discord ? '__discord' : profile.deco.frame,
          'frame',
          discord?.decoration ? (
            <button type="button" className={`pe-opt ${profile.deco.discord ? 'on' : ''}`} disabled={busy} title="My Discord decoration" onClick={() => setDeco({ discord: discord.decoration! })} {...peekProps({ discord: discord.decoration! })}>
              <Avatar avatar={profile.avatar} deco={{ discord: discord.decoration }} letter={letter} size={46} />
              <small>My Discord decoration</small>
              <em className="pe-theme t-discord">Discord</em>
            </button>
          ) : null
        )}
      </div>

      <div className="pe-block">
        <h3>Name colour</h3>
        {decoGrid(NAME_COLORS, profile.deco.nameColor, 'nameColor')}
        <h3 className="pe-h3b">Name font</h3>
        {decoGrid(NAME_FONTS, profile.deco.nameFont, 'nameFont')}
      </div>

      <div className="pe-block">
        <h3>Profile banner</h3>
        <div className="seg pe-tabs" role="tablist">
          {(['tmdb', 'anime', ...(discord?.banner || hasDiscord() ? ['discord'] : [])] as ('tmdb' | 'anime' | 'discord')[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={btab === t} className={btab === t ? 'on' : ''} onClick={() => { setBtab(t); setBq(''); }}>
              {t === 'tmdb' ? 'Movies & TV' : t === 'anime' ? 'Anime' : 'Discord'}
            </button>
          ))}
        </div>
        {btab !== 'discord' ? (
          <>
            <form className="pe-row" onSubmit={(e) => { e.preventDefault(); void searchBanners(); }}>
              <span className="auth-input"><Icon name="search" size={16} /><input value={bq} onChange={(e) => setBq(e.target.value)} placeholder={btab === 'tmdb' ? 'Search a movie or show (e.g. Dune)' : 'Search an anime (e.g. Frieren)'} /></span>
              <button className="btn" type="submit">Search</button>
            </form>
            <p className="muted small pe-sub">
              {bshown ? <>Results for “{bshown}” · <button type="button" className="link" onClick={() => { setBq(''); setBround((n) => n + 1); }}>show trending</button></> : 'Trending now'}
              {profile.deco.banner && <> · <button type="button" className="link" onClick={() => setDeco({ banner: '' })}>remove my banner</button></>}
            </p>
            {!banners && <div className="pe-banners">{Array.from({ length: 6 }, (_, i) => <span key={i} className="pe-ban skel" />)}</div>}
            {banners && (banners.length === 0 ? <p className="muted small">Nothing found. Try another title.</p> : (
              <div className="pe-banners">
                {banners.map((bn) => (
                  <button key={bn.url} type="button" className={`pe-ban ${profile.deco.banner === bn.url ? 'on' : ''}`} disabled={busy} title={bn.name} onClick={() => setDeco({ banner: bn.url })} {...peekProps({ banner: bn.url })}>
                    <img src={bn.url} alt={bn.name} loading="lazy" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            ))}
          </>
        ) : discord?.banner ? (
          <div className="pe-banners">
            <button type="button" className={`pe-ban ${profile.deco.banner === discord.banner ? 'on' : ''}`} disabled={busy} onClick={() => setDeco({ banner: discord.banner! })} {...peekProps({ banner: discord.banner })}>
              <img src={discord.banner} alt="My Discord banner" referrerPolicy="no-referrer" />
            </button>
          </div>
        ) : (
          <p className="muted small pe-sub">
            {discord ? "Your Discord profile doesn't have a banner. Add one on Discord, then tap Update from Discord in Connections." : 'Loading your Discord banner… If it doesn’t appear, tap Update from Discord in Connections.'}
          </p>
        )}
      </div>

      <div className="pe-block">
        <h3>Profile frame</h3>
        {decoGrid(PFRAMES, profile.deco.pframe, 'pframe')}
      </div>

      <div className="pe-block">
        <h3>Nameplate</h3>
        {decoGrid(
          NAMEPLATES,
          profile.deco.dplate ? '__discord' : profile.deco.nameplate,
          'nameplate',
          discord?.nameplate ? (
            <button type="button" className={`pe-opt ${profile.deco.dplate ? 'on' : ''}`} disabled={busy} title="My Discord nameplate" onClick={() => setDeco({ dplate: discord.nameplate!.asset })} {...peekProps({ dplate: discord.nameplate!.asset })}>
              <span className="pe-swatch pe-dplate"><img src={discordPlate(discord.nameplate.asset).img} alt="" referrerPolicy="no-referrer" /></span>
              <small>My Discord nameplate</small>
              <em className="pe-theme t-discord">Discord</em>
            </button>
          ) : null
        )}
      </div>

      <div className="pe-block">
        <h3>Profile decoration</h3>
        {decoGrid(EFFECTS, profile.deco.effect, 'effect')}
        {discord && <p className="muted small pe-sub">Discord doesn't share profile decorations with other sites, so pick one of ours here.</p>}
      </div>

      <div className="pe-block">
        <h3>Public profile</h3>
        <label className="pe-check">
          <input
            type="checkbox"
            checked={profile.is_public}
            disabled={busy || !profile.username}
            onChange={(e) => void save(e.target.checked ? { is_public: true, public_data: buildPublicData(loved, history) } : { is_public: false })}
          />
          Show my profile to anyone with the link: picture, favorites, what I'm watching and my stats
        </label>
        {!profile.username && <p className="muted small">Pick a username first.</p>}
        {profile.is_public && profile.username && (
          <div className="pe-row">
            <a className="link" href={publicUrl} target="_blank" rel="noopener noreferrer">{publicUrl.replace(/^https?:\/\//, '')}</a>
            <button className="btn small ghost" onClick={() => void navigator.clipboard?.writeText(publicUrl)}><Icon name="link" size={14} />Copy link</button>
          </div>
        )}
      </div>
    </div>
  );
}
