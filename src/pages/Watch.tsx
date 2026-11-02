import { useEffect, useMemo, useRef, useState } from 'react';
import { usePageTitle } from '../lib/title';
import ConsentGate from '../components/ConsentGate';
import { mediaAllowed, useConsent } from '../lib/consent';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { PosterRow } from '../components/Rows';
import Icon from '../components/Icon';
import { votesShort } from '../lib/format';
import WatchedTick from '../components/WatchedTick';
import { clearAt, fractionOf, isWatched, resumeAt, saveAt, setSeasonWatched, setWatched } from '../lib/progress';
import { providerById, providerFromParam, providers, serverSlug } from '../lib/providers';
import { store } from '../lib/storage';
import { IMG, tmdb } from '../lib/tmdb';
import type { Details, Episode, Media, MediaType } from '../lib/types';
import { useApp } from '../state';
import Select from '../components/Select';
import ServerPanel from '../components/ServerPanel';
import { isBad, isGood, scoreOf, useHealth, vote } from '../lib/serverHealth';

/** How long a server that normally reports playback may stay silent before we call it broken */
const QUIET_MS = 25000;
/** Seconds the viewer gets to keep a silent server before we move on */
const SWITCH_IN = 8;

export default function Watch() {
  const { type, id } = useParams();
  const t: MediaType = type === 'tv' ? 'tv' : 'movie';
  const mid = Number(id);
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const { provider: defaultProvider, recordWatch, isFavorite, toggleFavorite, isLoved, toggleLoved } = useApp();

  const season = Math.max(1, Number(sp.get('s')) || 1);
  const episode = Math.max(1, Number(sp.get('e')) || 1);
  const goodKey = `${t}:${mid}`;
  // what every visitor's player reported for this title (which servers played, which had to be skipped)
  const health = useHealth(goodKey);
  // no server in the address: the one that last worked for this title, else the default
  const pid = providerFromParam(sp.get('p') ?? store.getGoodServer(goodKey) ?? serverSlug(defaultProvider)).id;
  const provider = providerById(pid);
  useEffect(() => {
    const raw = sp.get('p');
    if (raw && raw !== serverSlug(pid)) {
      const n = new URLSearchParams(sp);
      n.set('p', serverSlug(pid));
      setSp(n, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pid]);

  const [d, setD] = useState<Details | null>(null);
  usePageTitle(d ? (t === 'tv' ? `${d.media.title} S${season}E${episode}` : d.media.title) : null);
  const [eps, setEps] = useState<Episode[]>([]);
  const [more, setMore] = useState<Media[]>([]);
  const [viewSeason, setViewSeason] = useState(season);
  const [reload, setReload] = useState(0);
  const [protect, setProtect] = useState(store.getProtect());
  const [alive, setAlive] = useState(false);
  const [slow, setSlow] = useState(false);
  const [autonext] = useState(store.getAutoplay());
  const consent = useConsent();
  const [gateOpen, setGateOpen] = useState(false);
  const mediaOk = mediaAllowed(consent) || gateOpen; // player actually on the page
  const [autoSwitch, setAutoSwitch] = useState(store.getAutoSwitch());
  const [loaded, setLoaded] = useState(false);
  const [switched, setSwitched] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [tried, setTried] = useState<string[]>([]); // servers that didn't work for this episode
  const [hidden, setHidden] = useState(store.getHiddenServers('movie'));
  const [worked, setWorked] = useState(() => new Set(store.getWorkedServers('movie')));
  const [quiet, setQuiet] = useState(false); // the player loaded but never started a video
  const [stay, setStay] = useState(false); // the viewer chose to keep this server anyway
  const [left, setLeft] = useState<number | null>(null);
  const [poke, setPoke] = useState(0); // bumps when the viewer taps inside the player
  const frame = useRef<HTMLIFrameElement>(null);
  const [autoskip] = useState(store.getAutoskip());
  const [upNext, setUpNext] = useState<{ s: number; e: number; left: number } | null>(null);
  const [wv, setWv] = useState(0); // bumps when "watched" marks change

  useEffect(() => {
    let live = true;
    tmdb.details(t, mid).then((r) => live && setD(r)).catch(() => undefined);
    tmdb.similar(t, mid).then((r) => live && setMore(r)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [t, mid]);

  // The episode list follows the playing season, until the viewer browses another one
  useEffect(() => setViewSeason(season), [season]);

  useEffect(() => {
    if (t !== 'tv') return;
    let live = true;
    tmdb.episodes(mid, viewSeason).then((r) => live && setEps(r)).catch(() => live && setEps([]));
    return () => {
      live = false;
    };
  }, [t, mid, viewSeason]);

  // Remember what is being watched
  useEffect(() => {
    if (!d) return;
    recordWatch({
      media: d.media,
      season: t === 'tv' ? season : null,
      episode: t === 'tv' ? episode : null,
      providerId: pid,
      watchedAt: Date.now()
    });
    // only when the title / episode / server changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d, season, episode, pid]);

  // Where to start: the saved spot minus 5 seconds. Read when the episode / server / reload changes,
  // never while playing (that would reload the player).
  const start = useMemo(
    () => resumeAt(t, mid, season, episode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, mid, season, episode, pid, reload]
  );
  const opts = { autonext, autoskip };
  const url = t === 'movie' ? provider.movie(mid, start, opts) : provider.tv(mid, season, episode, start, opts);

  // The player's address only changes when the viewer picks something. When the player itself moves
  // to the next episode (Server 1 auto-next), the page follows along without reloading it.
  const internal = useRef<{ s: number; e: number } | null>(null);
  const [src, setSrc] = useState(url);
  useEffect(() => {
    if (internal.current && internal.current.s === season && internal.current.e === episode) {
      internal.current = null;
      return;
    }
    setSrc(url);
  }, [url, season, episode]);

  // Save the playback position the player reports
  const latest = useRef<{ pos: number; dur: number } | null>(null);
  const lastSave = useRef(0);
  useEffect(() => {
    latest.current = null;
    lastSave.current = 0;
    const flush = () => {
      const l = latest.current;
      if (l) saveAt(t, mid, season, episode, l.pos, l.dur);
    };
    const onMessage = (ev: MessageEvent) => {
      if (provider.failed?.(ev)) {
        setFailed(true);
        return;
      }
      const n = provider.parseNext?.(ev);
      if (n) {
        setAlive(true);
        if (latest.current) saveAt(t, mid, season, episode, latest.current.pos, latest.current.dur);
        latest.current = null;
        setWatched(t, mid, season, episode, true);
        internal.current = n;
        setSp({ s: String(n.s), e: String(n.e), p: serverSlug(pid) }, { replace: true });
        return;
      }
      const r = provider.parse(ev);
      if (!r) return;
      setAlive(true);
      if (r.ended) {
        latest.current = null;
        clearAt(t, mid, season, episode);
        if (t === 'tv') setWatched(t, mid, season, episode, true);
        else setWatched('movie', mid, 1, 1, true);
        setWv((n) => n + 1);
        if (autonext && !provider.handlesNext && nextRef.current) setUpNext({ ...nextRef.current, left: store.getNextDelay() });
        return;
      }
      if (r.t <= 0) return;
      latest.current = { pos: r.t, dur: r.d };
      if (Date.now() - lastSave.current > 5000) {
        lastSave.current = Date.now();
        flush();
      }
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [provider, t, mid, season, episode, pid, autonext]);

  // Tell the viewer when a server is taking suspiciously long
  const sandboxed = protect && provider.sandboxOk;
  useEffect(() => {
    setAlive(false);
    setSlow(false);
    setLoaded(false);
    setFailed(false);
    if (!mediaOk) return;
    const h = window.setTimeout(() => setSlow(true), 20000);
    return () => window.clearTimeout(h);
  }, [url, reload, sandboxed, mediaOk]);

  // A new title / episode starts a fresh round of servers
  useEffect(() => {
    setTried([]);
    setSwitched(null);
  }, [t, mid, season, episode]);

  // The player is talking to us, so this server works: remember it for this title (and give it a green dot)
  useEffect(() => {
    if (!alive) return;
    store.saveGoodServer(goodKey, serverSlug(pid));
    store.saveWorkedServer('movie', pid);
    vote(goodKey, pid, true);
    setWorked((w) => (w.has(pid) ? w : new Set(w).add(pid)));
    setQuiet(false);
  }, [alive, goodKey, pid]);

  // The next server to try: the visible ones after this one, best first — servers other visitors got to play this
  // title on, then ones that worked on this device, then the rest, and servers others had to skip last
  const rank = (id: string) => (isGood(health[id]) ? 0 : worked.has(id) ? 1 : isBad(health[id]) ? 3 : 2);
  const pickNext = (skip: Set<string>) => {
    const vis = providers.filter((p) => !hidden.includes(p.id) || p.id === pid);
    const i = vis.findIndex((p) => p.id === pid);
    const order = vis.map((_, k) => vis[(i + 1 + k) % vis.length]).filter((p) => p.id !== pid && !skip.has(p.id));
    const best = [...order].sort((a, b) => rank(a.id) - rank(b.id) || (rank(a.id) === 0 ? scoreOf(health[b.id]) - scoreOf(health[a.id]) : 0));
    return best[0] ?? null;
  };
  const switchAway = (why: string) => {
    vote(goodKey, pid, false);
    const skip = new Set([...tried, pid]);
    setTried([...skip]);
    const fresh = pickNext(skip);
    if (!fresh) {
      setSwitched(`Tried every server in your list and none started this one. Try Reload, or show more servers with Customize.`);
      return;
    }
    setSwitched(`${provider.name} ${why}, so we switched to ${fresh.name}.`);
    setServer(fresh.id);
  };

  // First visit to this title (no server in the address, none remembered): if other visitors found a server that
  // plays it and the one we started on isn't one of them, move to the best one before the viewer gets going
  const healthMoved = useRef<string | null>(null);
  useEffect(() => {
    if (healthMoved.current === goodKey || alive || sp.get('p') || store.getGoodServer(goodKey)) return;
    const good = providers.filter((p) => !hidden.includes(p.id) && isGood(health[p.id])).sort((a, b) => scoreOf(health[b.id]) - scoreOf(health[a.id]));
    if (!good.length) return;
    healthMoved.current = goodKey;
    if (isGood(health[pid])) return;
    setSwitched(`Most viewers watch this on ${good[0].name}, so we started there.`);
    setServer(good[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [health, goodKey]);

  // Source reliability 1: a server whose page never loads, or that says it has nothing, is swapped at once
  useEffect(() => {
    const bad = (slow && !loaded && !alive) || failed;
    if (!bad || !autoSwitch) return;
    switchAway(failed ? "doesn't have this one" : "didn't load");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slow, loaded, alive, autoSwitch, failed]);

  // Source reliability 2: the page loaded but the video never started. Servers that normally report playback
  // and stay silent are probably broken ("no sources", endless spinner). Tapping inside the player restarts the wait.
  useEffect(() => {
    setQuiet(false);
    setStay(false);
  }, [src, reload]);
  useEffect(() => {
    if (!loaded || alive || provider.silent || !mediaOk || stay) return;
    setQuiet(false);
    const h = window.setTimeout(() => (document.hidden ? setPoke((n) => n + 1) : setQuiet(true)), QUIET_MS);
    return () => window.clearTimeout(h);
  }, [loaded, alive, provider, mediaOk, stay, poke]);
  useEffect(() => {
    // focus moves into the player's frame when the viewer taps it
    const onBlur = () =>
      window.setTimeout(() => {
        if (frame.current && document.activeElement === frame.current) setPoke((n) => n + 1);
      }, 0);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);
  useEffect(() => {
    if (!quiet || !autoSwitch) {
      setLeft(null);
      return;
    }
    setLeft(SWITCH_IN);
    const h = window.setInterval(() => setLeft((n) => (n == null ? n : n - 1)), 1000);
    return () => window.clearInterval(h);
  }, [quiet, autoSwitch]);
  useEffect(() => {
    if (left == null || left > 0 || !quiet) return;
    setLeft(null);
    setQuiet(false);
    switchAway('never started the video');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, quiet]);

  const seasonInfo = d?.seasons.find((s) => s.number === season);
  const next = useMemo(() => {
    if (t !== 'tv' || !d) return null;
    if (seasonInfo && episode < seasonInfo.episodeCount) return { s: season, e: episode + 1 };
    if (d.seasons.some((s) => s.number === season + 1)) return { s: season + 1, e: 1 };
    return null;
  }, [t, d, seasonInfo, season, episode]);

  const nextRef = useRef(next);
  nextRef.current = next;

  // "Up next" countdown for servers that don't advance on their own
  useEffect(() => setUpNext(null), [season, episode, pid]);
  useEffect(() => {
    if (!upNext) return;
    if (upNext.left <= 0) {
      setUpNext(null);
      go(upNext.s, upNext.e);
      return;
    }
    const h = window.setTimeout(() => setUpNext((u) => (u ? { ...u, left: u.left - 1 } : u)), 1000);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upNext]);

  const go = (s: number, e: number) => {
    setSp({ s: String(s), e: String(e), p: serverSlug(pid) }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const setServer = (p: string) =>
    setSp(t === 'tv' ? { s: String(season), e: String(episode), p: serverSlug(p) } : { p: serverSlug(p) }, { replace: true });

  // Servers that refuse to run in a sandbox ("Please disable sandbox") are loaded without it
  const sandbox = sandboxed ? 'allow-scripts allow-same-origin allow-forms allow-presentation' : undefined;
  const nextServer = pickNext(new Set(tried)) ?? providers[(providers.findIndex((p) => p.id === pid) + 1) % providers.length];

  const m = d?.media;
  const fav = m ? isFavorite(m) : false;
  const love = m ? isLoved(m) : false;
  void wv;
  const epName = viewSeason === season ? eps.find((x) => x.number === episode)?.name : undefined;

  return (
    <div className="wp wide">
      <div className="wp-top">
        <button className="btn small ghost" onClick={() => (window.history.length > 1 ? nav(-1) : nav(`/title/${t}/${mid}`))}><Icon name="arrowLeft" size={15} />Back</button>
        <span className="sp" />
        {m && (
          <>
            <button className="btn small ghost" onClick={() => toggleFavorite(m)}><Icon name={fav ? 'check' : 'bookmark'} size={15} />{fav ? 'In Watchlist' : 'Watchlist'}</button>
            <button className="btn small ghost" aria-label={love ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={love} onClick={() => toggleLoved(m)}><Icon name="heart" size={17} fill={love} /></button>
          </>
        )}
      </div>

      <div className="wp-stage">
        <div className="wp-player">
          <ConsentGate label="Load the player" className="wp-frame" onOpen={() => setGateOpen(true)}>

          <iframe
            key={`${src}|${reload}|${sandboxed}`}
            ref={frame}
            className="wp-frame"
            src={src}
            title={m?.title ?? 'Player'}
            allow="autoplay *; fullscreen *; picture-in-picture; encrypted-media *"
            allowFullScreen
            sandbox={sandbox}
            onLoad={(e) => {
              setLoaded(true);
              // some servers want a message once loaded: the saved spot (Server 11) or a hello (Server 16)
              const r = provider.onFrameLoad?.(start);
              if (r) e.currentTarget.contentWindow?.postMessage(r.msg, r.origin);
            }}
          />

          </ConsentGate>

          {switched && (
            <div className="wp-slow" role="status">
              <span><Icon name="refresh" size={14} /> {switched}</span>
              <button className="pill" onClick={() => setSwitched(null)}>OK</button>
            </div>
          )}

          {upNext && (
            <div className="wp-upnext" role="status">
              <span>
                <Icon name="play" size={13} fill /> Up next: <b>S{upNext.s} · E{upNext.e}</b> in {upNext.left}s
              </span>
              <button className="pill on" onClick={() => go(upNext.s, upNext.e)}>Play now</button>
              <button className="pill" onClick={() => setUpNext(null)}>Cancel</button>
            </div>
          )}

          {((slow && !alive) || failed) && !quiet && (
            <div className="wp-slow" role="status">
              <span>{failed ? `${provider.name} doesn't have this one.` : `${provider.name} is taking a while to load.`}</span>
              <button className="pill warn" onClick={() => setServer(nextServer.id)}>Try {nextServer.name}</button>
              <button className="pill" onClick={() => setReload((n) => n + 1)}><Icon name="refresh" size={14} />Reload</button>
            </div>
          )}

          {quiet && !alive && (
            <div className="wp-slow" role="status">
              <span>
                {left != null
                  ? <>No video from {provider.name} yet. Switching to {nextServer.name} in {Math.max(left, 0)}s</>
                  : <>{provider.name} hasn't started a video.</>}
              </span>
              <button className="pill warn" onClick={() => { setQuiet(false); switchAway('never started the video'); }}>
                {left != null ? 'Switch now' : `Try ${nextServer.name}`}
              </button>
              <button className="pill" onClick={() => { setQuiet(false); setStay(true); }}>Stay here</button>
            </div>
          )}
        </div>
        <aside className="wp-col wp-col-sv">
          <div className="wp-fill">
              <ServerPanel
                items={providers.map((p) => ({ key: p.id, name: p.name, note: p.quality }))}
                current={pid}
                onPick={(k) => { setSwitched(null); setServer(k); }}
                onReload={() => setReload((n) => n + 1)}
                worked={new Set(providers.filter((p) => isGood(health[p.id]) || (worked.has(p.id) && !isBad(health[p.id]))).map((p) => p.id))}
                failed={new Set([...tried, ...providers.filter((p) => isBad(health[p.id])).map((p) => p.id)])}
                hidden={hidden}
                onHidden={(v) => { setHidden(v); store.saveHiddenServers('movie', v); }}
                autoSwitch={autoSwitch}
                onAutoSwitch={(v) => { setAutoSwitch(v); store.saveAutoSwitch(v); }}
              >
                {t === 'tv' && <p className="sv-now">Playing <b>Season {season} · Episode {episode}</b></p>}
              </ServerPanel>
          </div>
        </aside>
      </div>

      <div className="wp-main solo">
        <div className="wp-left">
          <div className="td-chips">
            {m && m.rating > 0 && (
              <span className="chip rate"><Icon name="star" size={14} fill />{m.rating.toFixed(1)}{d && d.votes > 0 && <small>({votesShort(d.votes)})</small>}</span>
            )}
            {m?.year && <span className="chip"><Icon name="calendar" size={14} />{m.year}</span>}
            {d?.status && <span className={`chip stat ${d.status === 'Released' || d.status === 'Ended' ? 'ok' : ''}`}>{d.status}</span>}
          </div>
          <h1>{m?.title ?? 'Loading…'}</h1>
          {epName && <p className="wp-epname">S{season} · E{episode} — {epName}</p>}
          {d?.tagline && <p className="wp-tag">“{d.tagline}”</p>}
          {d && d.genres.length > 0 && (
            <div className="td-chips">{d.genres.map((g) => <span key={g} className="chip">{g}</span>)}</div>
          )}
          <h3 className="wp-h">Overview</h3>
          <p className="wp-overview">{m?.overview || 'No description available.'}</p>

          <div className="wp-tools">
            {t === 'tv' && (episode > 1 || season > 1) && (
              <button
                className="btn small ghost"
                onClick={() => {
                  if (episode > 1) go(season, episode - 1);
                  else {
                    const ps = d?.seasons.find((s) => s.number === season - 1);
                    if (ps) go(ps.number, ps.episodeCount);
                  }
                }}
              >
                <Icon name="chevronLeft" size={15} />Prev
              </button>
            )}
            {next && <button className="btn small ghost" onClick={() => go(next.s, next.e)}>Next<Icon name="chevronRight" size={15} /></button>}
            <Link to={`/title/${t}/${mid}`} className="btn small ghost">Details</Link>
          </div>
          <p className="watch-help" style={{ background: 'none', padding: '14px 0', textAlign: 'left' }}>
            Video not loading? Pick another server from the list or{' '}
            <button
              className="link"
              onClick={() => {
                const v = !protect;
                setProtect(v);
                store.saveProtect(v);
              }}
            >
              turn popup protection {protect ? 'off' : 'on'}
            </button>
            .
          </p>

          {t === 'tv' && d && d.seasons.length > 0 && (
            <section className="wp-eps">
              <div className="season-head">
                <div>
                  <h2 className="section">Episodes &amp; Seasons</h2>
                  <p className="ep-sub">Select an episode to watch now</p>
                </div>
                <button
                  className="btn small ghost"
                  onClick={() => {
                    const nums = eps.map((x) => x.number);
                    const all = nums.length > 0 && nums.every((n) => isWatched('tv', mid, viewSeason, n));
                    setSeasonWatched(mid, viewSeason, nums, !all);
                    setWv((n) => n + 1);
                  }}
                >
                  <Icon name="check" size={14} />{eps.length > 0 && eps.every((x) => isWatched('tv', mid, viewSeason, x.number)) ? 'Unmark season' : 'Mark season watched'}
                </button>
                <Select className="field select dd" value={viewSeason} onChange={(e) => setViewSeason(Number(e.target.value))} aria-label="Season">
                  {d.seasons.map((s) => (
                    <option key={s.number} value={s.number}>{s.name} ({s.episodeCount} Ep)</option>
                  ))}
                </Select>
              </div>
              <div className="ep-list">
                {eps.map((e) => {
                  const now = viewSeason === season && e.number === episode;
                  const frac = fractionOf('tv', mid, viewSeason, e.number);
                  const seen = isWatched('tv', mid, viewSeason, e.number);
                  return (
                    <Link
                      key={e.number}
                      className={`ep-row ${now ? 'now' : ''} ${seen ? 'seen' : ''}`}
                      replace
                      to={`/watch/tv/${mid}?s=${viewSeason}&e=${e.number}&p=${serverSlug(pid)}`}
                      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                      <span className="ep-img">
                        {e.still ? <img src={IMG.still + e.still} alt="" loading="lazy" /> : null}
                        <span className="ep-tag">E{e.number}</span>
                        {frac > 0.02 && <span className="ep-prog"><i style={{ width: `${Math.round(frac * 100)}%` }} /></span>}
                      </span>
                      <span>
                        <WatchedTick
                          on={seen}
                          onToggle={() => {
                            setWatched('tv', mid, viewSeason, e.number, !seen);
                            setWv((n) => n + 1);
                          }}
                        />
                        {e.rating > 0 && <span className="ep-score"><Icon name="star" size={12} fill />{e.rating.toFixed(1)}</span>}
                        <h4>{e.number}. {e.name}</h4>
                        <span className="ep-meta">
                          {e.airDate && <span><Icon name="calendar" size={13} />{e.airDate}</span>}
                          {e.runtime > 0 && <span><Icon name="clock" size={13} />{e.runtime} min</span>}
                          {now && <span className="ep-now"><Icon name="play" size={11} fill />Now playing</span>}
                        </span>
                        <p>{e.overview || 'No description available.'}</p>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

      </div>

      <PosterRow title="Recommended Next" items={more} />
    </div>
  );
}
