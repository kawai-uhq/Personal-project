import { useEffect, useMemo, useRef, useState } from 'react';
import { usePageTitle } from '../lib/title';
import ConsentGate from '../components/ConsentGate';
import { mediaAllowed, useConsent } from '../lib/consent';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AniRow } from '../components/AnimeCard';
import Icon from '../components/Icon';
import AnimeSeasons from '../components/AnimeSeasons';
import WatchedTick from '../components/WatchedTick';
import { FORMAT_LABEL, STATUS_LABEL, aniFull, availableEpisodes, lite } from '../lib/anilist';
import type { AniFull } from '../lib/anilist';
import { animeServers, serverAt, serverNo } from '../lib/animeProviders';
import type { Lang } from '../lib/animeProviders';
import { animeStore, resumeFrom, useAnimeStore } from '../lib/animeStore';
import { store as settings } from '../lib/storage';
import { reportProgress } from '../lib/anilistAccount';
import Select from '../components/Select';
import ServerPanel from '../components/ServerPanel';

const QUIET_MS = 25000;
const SWITCH_IN = 8;

const CHUNK = 100;

const LANG_NAME: Record<Lang, string> = { sub: 'Sub', dub: 'Dub', hsub: 'Hard-sub' };

/** The anime player page: server and language bar, episode list and recommendations. */
export default function AnimeWatch() {
  const { id } = useParams();
  const aid = Number(id);
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const lib = useAnimeStore();
  const [a, setA] = useState<AniFull | null>(null);
  const [reload, setReload] = useState(0);
  const [range, setRange] = useState(0);
  const [upNext, setUpNext] = useState<number | null>(null);
  const [left, setLeft] = useState(5);
  const consent = useConsent();
  const [gateOpen, setGateOpen] = useState(false);
  const mediaOk = mediaAllowed(consent) || gateOpen; // player actually on the page
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [alive, setAlive] = useState(false);
  const [switched, setSwitched] = useState<string | null>(null);
  const [tried, setTried] = useState<number[]>([]); // servers that didn't work for this episode
  const [autoSwitch, setAutoSwitch] = useState(settings.getAutoSwitch());
  const [hidden, setHidden] = useState(settings.getHiddenServers('anime'));
  const [worked, setWorked] = useState(() => new Set(settings.getWorkedServers('anime')));
  const [quiet, setQuiet] = useState(false);
  const [stay, setStay] = useState(false);
  const [quietLeft, setQuietLeft] = useState<number | null>(null);
  const [poke, setPoke] = useState(0);
  const frame = useRef<HTMLIFrameElement>(null);
  const epGrid = useRef<HTMLDivElement>(null);
  const latest = useRef<{ t: number; d: number } | null>(null);
  const lastSave = useRef(0);

  const ep = Math.max(1, Number(sp.get('e')) || 1);
  usePageTitle(a ? `${a.title} Episode ${ep}` : null);
  const goodKey = `anime:${aid}`;
  // no server in the address: the one that last worked for this anime, else Server 1
  const server = serverAt(sp.get('p') ?? settings.getGoodServer(goodKey));
  const wanted = sp.get('l') as Lang | null;
  const lang: Lang = wanted && server.langs.includes(wanted) ? wanted : 'sub';
  const autoplay = settings.getAutoplay();
  const autoskip = settings.getAutoskip();

  useEffect(() => {
    let live = true;
    setA(null);
    aniFull(aid).then((r) => live && setA(r)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [aid]);

  const avail = a ? availableEpisodes(a) : 0;
  const total = a ? Math.max(a.episodes ?? 0, avail) : 0;
  const last = a ? avail || total : 0;
  const hasNext = !!a && ep < (avail || total);

  // Where to start: the saved spot minus 5 seconds (only players that accept a start time)
  const start = useMemo(() => {
    if (!server.resumes) return 0;
    const p = animeStore.pos(aid, ep);
    return p ? resumeFrom(p.t, p.d) : 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aid, ep, server, reload]);

  // Servers addressed by MyAnimeList id wait for the anime's details (and are skipped when it has no MAL id)
  const mal = a && a.id === aid ? a.mal : undefined;
  const missing = !!server.needsMal && mal === null;
  const src = useMemo(
    () => (server.needsMal && !mal ? '' : server.url({ id: aid, mal, ep, lang, start, autoskip })),
    // the address must not change while an episode plays
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aid, ep, server, lang, start, reload, mal]
  );

  // History entry (the "Continue Watching" row)
  useEffect(() => {
    if (a) animeStore.addWatch(lite(a), ep, serverNo(server), lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, ep, server, lang]);

  const go = (n: number, extra?: Record<string, string>) => {
    setSp({ e: String(n), p: String(serverNo(server)), l: lang, ...extra }, { replace: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const flush = () => {
    const l = latest.current;
    if (l && l.t > 0) animeStore.savePos(aid, ep, l.t, l.d);
  };

  // Player messages: remember the position, mark watched near the end, move on when it finishes
  useEffect(() => {
    latest.current = null;
    setUpNext(null);
    const onMsg = (ev: MessageEvent) => {
      if (!frame.current || ev.source !== frame.current.contentWindow) return;
      const r = server.parse(ev);
      if (!r) return;
      setAlive(true);
      if (r.ended) {
        animeStore.markSeen(aid, ep);
        void reportProgress(aid, ep, a?.episodes ?? null);
        animeStore.savePos(aid, ep, 0, 0);
        latest.current = null;
        if (autoplay && hasNext) setUpNext(ep + 1);
        return;
      }
      latest.current = r;
      if (r.d > 0 && r.t / r.d > 0.9) {
        animeStore.markSeen(aid, ep);
        void reportProgress(aid, ep, a?.episodes ?? null);
      }
      const now = Date.now();
      if (now - lastSave.current > 5000) {
        lastSave.current = now;
        flush();
      }
    };
    window.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('message', onMsg);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aid, ep, server, hasNext, autoplay]);

  // "Up next" countdown
  useEffect(() => {
    if (upNext == null) return;
    setLeft(settings.getNextDelay());
    const t = window.setInterval(() => setLeft((n) => n - 1), 1000);
    return () => window.clearInterval(t);
  }, [upNext]);
  useEffect(() => {
    if (upNext != null && left <= 0) {
      const n = upNext;
      setUpNext(null);
      go(n);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, upNext]);

  // Source reliability: watch whether the server's page loads at all
  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    setAlive(false);
    if (!mediaOk || !src) return;
    const h = window.setTimeout(() => setSlow(true), 20000);
    return () => window.clearTimeout(h);
  }, [src, reload, mediaOk]);
  useEffect(() => {
    setTried([]);
    setSwitched(null);
  }, [aid, ep]);
  // the player is talking to us, so this server works: remember it for this anime (and give it a green dot)
  useEffect(() => {
    if (!alive) return;
    const k = String(serverNo(server));
    settings.saveGoodServer(goodKey, k);
    settings.saveWorkedServer('anime', k);
    setWorked((w) => (w.has(k) ? w : new Set(w).add(k)));
    setQuiet(false);
  }, [alive, goodKey, server]);

  const pickServer = (n: number) => {
    const s = animeServers[n - 1];
    setSp({ e: String(ep), p: String(n), l: s.langs.includes(lang) ? lang : 'sub' }, { replace: true });
  };
  // the next server to try: the visible ones after this one, servers that worked before first
  const pickNext = (skip: Set<number>) => {
    const cur = serverNo(server);
    const order = animeServers
      .map((_, i) => ((cur + i) % animeServers.length) + 1)
      .filter((n) => n !== cur && !skip.has(n) && !hidden.includes(String(n)));
    return order.find((n) => worked.has(String(n))) ?? order[0] ?? null;
  };
  const switchAway = (why: string) => {
    const skip = new Set([...tried, serverNo(server)]);
    setTried([...skip]);
    const fresh = pickNext(skip);
    if (!fresh) {
      setSwitched(`Tried every server in your list and none started this one. Try Reload, or show more servers with Customize.`);
      return;
    }
    setSwitched(`${server.name} ${why}, so we switched to ${animeServers[fresh - 1].name}.`);
    pickServer(fresh);
  };

  // a server that never loads (or can't play this anime) is swapped for the next untried one
  useEffect(() => {
    const failed = (slow && !loaded && !alive) || missing;
    if (!failed || !autoSwitch) return;
    switchAway(missing ? "doesn't have this anime" : "didn't load");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slow, loaded, alive, autoSwitch, missing]);

  // a player that loaded but never started a video is probably broken; tapping inside it restarts the wait
  useEffect(() => {
    setQuiet(false);
    setStay(false);
  }, [src, reload]);
  useEffect(() => {
    if (!loaded || alive || !mediaOk || stay) return;
    setQuiet(false);
    const h = window.setTimeout(() => (document.hidden ? setPoke((n) => n + 1) : setQuiet(true)), QUIET_MS);
    return () => window.clearTimeout(h);
  }, [loaded, alive, server, mediaOk, stay, poke]);
  useEffect(() => {
    const onBlur = () =>
      window.setTimeout(() => {
        if (frame.current && document.activeElement === frame.current) setPoke((n) => n + 1);
      }, 0);
    window.addEventListener('blur', onBlur);
    return () => window.removeEventListener('blur', onBlur);
  }, []);
  useEffect(() => {
    if (!quiet || !autoSwitch) {
      setQuietLeft(null);
      return;
    }
    setQuietLeft(SWITCH_IN);
    const h = window.setInterval(() => setQuietLeft((n) => (n == null ? n : n - 1)), 1000);
    return () => window.clearInterval(h);
  }, [quiet, autoSwitch]);
  useEffect(() => {
    if (quietLeft == null || quietLeft > 0 || !quiet) return;
    setQuietLeft(null);
    setQuiet(false);
    switchAway('never started the video');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quietLeft, quiet]);

  const inList = !!a && lib.list().some((x) => x.id === a.id);
  const loved = !!a && lib.loved().some((x) => x.id === a.id);
  const seen = new Set(lib.seen(aid));
  const nums = Array.from({ length: last }, (_, i) => i + 1);
  const ranges = Math.ceil(nums.length / CHUNK);
  const rangeNow = Math.min(range, Math.max(0, ranges - 1));
  const shown = nums.slice(rangeNow * CHUNK, rangeNow * CHUNK + CHUNK);
  const nextServer = animeServers[(pickNext(new Set(tried)) ?? (serverNo(server) % animeServers.length) + 1) - 1];

  // keep the playing episode in view inside the episode column (without moving the page)
  useEffect(() => {
    const g = epGrid.current;
    const now = g?.querySelector<HTMLElement>('.aep.now');
    if (!g || !now) return;
    const top = now.offsetTop - g.offsetTop;
    if (top < g.scrollTop || top + now.offsetHeight > g.scrollTop + g.clientHeight) g.scrollTop = top - g.clientHeight / 2 + now.offsetHeight / 2;
  }, [ep, last, rangeNow]);

  return (
    <div className="wp wide">
      <div className="wp-top">
        <button className="btn small ghost" onClick={() => (window.history.length > 1 ? nav(-1) : nav(`/anime/title/${aid}`))}><Icon name="arrowLeft" size={15} />Back</button>
        {a && (
          <>
            <span style={{ flex: 1 }} />
            <button className="btn small ghost" aria-pressed={inList} onClick={() => lib.toggle('list', a)}><Icon name={inList ? 'check' : 'bookmark'} size={15} />Watchlist</button>
            <button className="btn small ghost" aria-label={loved ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={loved} onClick={() => lib.toggle('loved', a)}><Icon name="heart" size={17} fill={loved} /></button>
          </>
        )}
      </div>

      <div className="wp-stage anime">
        <aside className="wp-col wp-col-eps">
          <div className="wp-fill">
            <AnimeSeasons id={aid} to="/anime/watch/" />
            <section className="wp-eps wp-eps-side">
              <div className="season-head">
                <h2 className="section">Episodes</h2>
                {ranges > 1 && (
                  <Select className="field select dd" value={rangeNow} onChange={(e) => setRange(Number(e.target.value))} aria-label="Episode range">
                    {Array.from({ length: ranges }, (_, i) => (
                      <option key={i} value={i}>{i * CHUNK + 1} – {Math.min((i + 1) * CHUNK, nums.length)}</option>
                    ))}
                  </Select>
                )}
              </div>
              <div className="aep-grid compact" ref={epGrid}>
                {shown.map((n) => {
                  const done = seen.has(n);
                  return (
                    <button key={n} className={`aep ${done ? 'seen' : ''} ${n === ep ? 'now' : ''}`} onClick={() => go(n)}>
                      <WatchedTick on={done} onToggle={() => animeStore.setSeen(aid, n, !done)} />
                      <b>EP {n}</b>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </aside>
        <div className="wp-player">
          <ConsentGate label="Load the player" className="wp-frame" onOpen={() => setGateOpen(true)}>

          {src ? (
          <iframe
            key={`${src}|${reload}`}
            ref={frame}
            className="wp-frame"
            src={src}
            title={a?.title ?? 'Player'}
            allow="autoplay *; fullscreen *; picture-in-picture; encrypted-media *"
            allowFullScreen
            onLoad={(e) => {
              setLoaded(true);
              // players that resume by message (Server 5) get the saved spot now
              const r = server.onFrameLoad?.(start);
              if (r) e.currentTarget.contentWindow?.postMessage(r.msg, r.origin);
            }}
          />
          ) : (
            <div className="gate wp-frame" role="status">
              <Icon name={missing ? 'play' : 'refresh'} size={28} />
              <strong>{missing ? `${server.name} doesn't have this anime` : 'Loading the player…'}</strong>
              {missing && (
                <button className="btn primary" onClick={() => setSp({ e: String(ep), p: String(serverNo(nextServer)), l: nextServer.langs.includes(lang) ? lang : 'sub' }, { replace: true })}>
                  Try {nextServer.name}
                </button>
              )}
            </div>
          )}

          </ConsentGate>

          {switched && (
            <div className="wp-slow" role="status">
              <span><Icon name="refresh" size={14} /> {switched}</span>
              <button className="pill" onClick={() => setSwitched(null)}>OK</button>
            </div>
          )}
          {slow && !loaded && !switched && !!src && (
            <div className="wp-slow" role="status">
              <span>{server.name} is taking a while to load.</span>
              <button className="pill warn" onClick={() => setSp({ e: String(ep), p: String(serverNo(nextServer)), l: nextServer.langs.includes(lang) ? lang : 'sub' }, { replace: true })}>Try {nextServer.name}</button>
              <button className="pill" onClick={() => setReload((n) => n + 1)}><Icon name="refresh" size={14} />Reload</button>
            </div>
          )}

          {quiet && !alive && (
            <div className="wp-slow" role="status">
              <span>
                {quietLeft != null
                  ? <>No video from {server.name} yet. Switching to {nextServer.name} in {Math.max(quietLeft, 0)}s</>
                  : <>{server.name} hasn't started a video.</>}
              </span>
              <button className="pill warn" onClick={() => { setQuiet(false); switchAway('never started the video'); }}>
                {quietLeft != null ? 'Switch now' : `Try ${nextServer.name}`}
              </button>
              <button className="pill" onClick={() => { setQuiet(false); setStay(true); }}>Stay here</button>
            </div>
          )}

          {upNext != null && (
            <div className="wp-upnext" role="status">
              <span><Icon name="play" size={13} fill /> Up next: <b>Episode {upNext}</b> in {Math.max(left, 0)}s</span>
              <button className="pill on" onClick={() => { setUpNext(null); go(upNext); }}>Play now</button>
              <button className="pill" onClick={() => setUpNext(null)}>Cancel</button>
            </div>
          )}
        </div>
        <aside className="wp-col wp-col-sv">
          <div className="wp-fill">
              <ServerPanel
                items={animeServers.map((x) => ({ key: String(serverNo(x)), name: x.name, note: x.note }))}
                current={String(serverNo(server))}
                onPick={(k) => { setSwitched(null); pickServer(Number(k)); }}
                onReload={() => setReload((n) => n + 1)}
                worked={worked}
                failed={new Set(tried.map(String))}
                hidden={hidden}
                onHidden={(v) => { setHidden(v); settings.saveHiddenServers('anime', v); }}
                autoSwitch={autoSwitch}
                onAutoSwitch={(v) => { setAutoSwitch(v); settings.saveAutoSwitch(v); }}
              >
                <div className="sv-lang">
                  <span>Audio</span>
                  <div className="seg" role="radiogroup" aria-label="Audio">
                    {server.langs.map((l) => (
                      <button key={l} type="button" role="radio" aria-checked={l === lang} className={l === lang ? 'on' : ''} onClick={() => setSp({ e: String(ep), p: String(serverNo(server)), l }, { replace: true })}>{LANG_NAME[l]}</button>
                    ))}
                  </div>
                </div>
                <p className="sv-now">Playing <b>Episode {ep}</b></p>
              </ServerPanel>
          </div>
        </aside>
      </div>

      <div className="wp-main solo">
        <div className="wp-left">
          <div className="td-chips">
            {a && a.score > 0 && <span className="chip rate"><Icon name="star" size={14} fill />{(a.score / 10).toFixed(1)}</span>}
            {a?.year && <span className="chip"><Icon name="calendar" size={14} />{a.year}</span>}
            {a?.format && <span className="chip">{FORMAT_LABEL[a.format] ?? a.format}</span>}
            {a?.status && <span className={`chip stat ${a.status === 'FINISHED' || a.status === 'RELEASING' ? 'ok' : ''}`}>{STATUS_LABEL[a.status] ?? a.status}</span>}
          </div>
          <h1>{a?.title ?? 'Loading…'}</h1>
          {a && a.genres.length > 0 && <div className="td-chips">{a.genres.map((g) => <span key={g} className="chip">{g}</span>)}</div>}
          <h3 className="wp-h">Overview</h3>
          <p className="wp-overview">{a?.desc || 'No description available.'}</p>
          <div className="wp-tools">
            {ep > 1 && <button className="btn small ghost" onClick={() => go(ep - 1)}><Icon name="chevronLeft" size={15} />Prev</button>}
            {hasNext && <button className="btn small ghost" onClick={() => go(ep + 1)}>Next<Icon name="chevronRight" size={15} /></button>}
            <Link to={`/anime/title/${aid}`} className="btn small ghost">Details</Link>
          </div>
        </div>

      </div>

      {a && <AniRow title="You might also like" items={a.recs} />}
    </div>
  );
}
