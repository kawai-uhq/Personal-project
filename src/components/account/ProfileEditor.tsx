import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Avatar from '../Avatar';
import Icon from '../Icon';
import { buildPublicData } from '../AccountRuntime';
import { gql } from '../../lib/anilist';
import { AVATAR_COLORS, EFFECTS, FRAMES, NAMEPLATES, PFRAMES } from '../../lib/decorations';
import ProfileFrame from '../ProfileFrame';
import type { DecoItem } from '../../lib/decorations';
import { USERNAME_RE, cleanUsername, discordInfo, discordPlate, saveProfile, usernameFree, useProfile } from '../../lib/profile';
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
  const discord = discordInfo();

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

  const setAvatar = (a: AvatarData) => void save({ avatar: a });
  // one avatar decoration and one nameplate at a time: picking one of ours replaces the Discord one, and the other way round
  const setDeco = (d: Deco) => {
    const next: Deco = { ...profile.deco, ...d };
    if ('frame' in d && !('discord' in d)) next.discord = '';
    if (d.discord) next.frame = '';
    if ('nameplate' in d && !('dplate' in d)) next.dplate = '';
    if (d.dplate) next.nameplate = '';
    void save({ deco: next });
  };
  const letter = profile.username || session.email;
  const publicUrl = `${onProd() ? CINEMA_ORIGIN : location.origin}/u/${profile.username ?? ''}`;

  const decoGrid = (items: DecoItem[], current: string | undefined, key: 'frame' | 'nameplate' | 'effect' | 'pframe', extra?: ReactNode) => (
    <div className="pe-grid">
      <button type="button" className={`pe-opt ${!current ? 'on' : ''}`} disabled={busy} onClick={() => setDeco({ [key]: '' })}>
        <span className="pe-none"><Icon name="x" size={16} /></span>
        <small>None</small>
      </button>
      {extra}
      {items.map((it) => (
        <button key={it.id} type="button" className={`pe-opt ${current === it.id ? 'on' : ''}`} disabled={busy} onClick={() => setDeco({ [key]: it.id })} title={it.name}>
          {key === 'frame' ? (
            <Avatar avatar={profile.avatar} deco={{ frame: it.id }} letter={letter} size={46} />
          ) : key === 'pframe' ? (
            <span className="pe-mini pf-wrap has-pf"><span className="pe-mini-card" /><ProfileFrame id={it.id} /></span>
          ) : (
            <span className={`pe-swatch ${key === 'nameplate' ? `np-${it.id}` : 'pe-fx'}`}>{key === 'effect' && <span className={`fx fx-${it.id}`} />}</span>
          )}
          <small>{it.name}</small>
          <em className={`pe-theme t-${it.theme}`}>{it.theme === 'anime' ? 'Anime' : it.theme === 'movie' ? 'Movie' : ''}</em>
        </button>
      ))}
    </div>
  );

  return (
    <div className="pe">
      {error && <p className="error">{error}</p>}

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
            <button type="button" className={`pe-opt ${profile.deco.discord ? 'on' : ''}`} disabled={busy} title="My Discord decoration" onClick={() => setDeco({ discord: discord.decoration! })}>
              <Avatar avatar={profile.avatar} deco={{ discord: discord.decoration }} letter={letter} size={46} />
              <small>My Discord decoration</small>
              <em className="pe-theme t-discord">Discord</em>
            </button>
          ) : null
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
            <button type="button" className={`pe-opt ${profile.deco.dplate ? 'on' : ''}`} disabled={busy} title="My Discord nameplate" onClick={() => setDeco({ dplate: discord.nameplate!.asset })}>
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
