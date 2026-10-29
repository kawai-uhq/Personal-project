import { useEffect, useMemo, useRef, useState } from 'react';
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

const CHUNK = 100;

// Popup / redirect protection is remembered per server: 'balanced' (default) stops the player from sending
// this page elsewhere but still lets it open windows, 'strict' blocks both, 'off' runs the player unrestricted.
type Mode = 'balanced' | 'strict' | 'off';
const PKEY = 'comvie.amode';
const readModes = (): Record<string, Mode> => {
  try { return JSON.parse(localStorage.getItem(PKEY) || '{}') || {}; } catch { return {}; }
};
const writeModes = (m: Record<string, Mode>) => {
  try { localStorage.setItem(PKEY, JSON.stringify(m)); } catch { /* storage blocked */ }
};
const NEXT_MODE: Record<Mode, Mode> = { balanced: 'strict', strict: 'off', off: 'balanced' };
const SANDBOX: Record<Mode, string | undefined> = {
  balanced: 'allow-scripts allow-same-origin allow-forms allow-presentation allow-popups allow-popups-to-escape-sandbox allow-modals allow-pointer-lock allow-orientation-lock',
  strict: 'allow-scripts allow-same-origin allow-forms allow-presentation',
  off: undefined
};

/** The anime player page: server and language bar, episode list and recommendations. */
export default function AnimeWatch() {
  const { id } = useParams();
  const aid = Number(id);
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const lib = useAnimeStore();
  const [a, setA] = useState<AniFull | null>(null);
  const [reload, setReload] = useState(0);
  const [modes, setModes] = useState<Record<string, Mode>>(readModes);
  const [range, setRange] = useState(0);
  const [upNext, setUpNext] = useState<number | null>(null);
  const [left, setLeft] = useState(5);
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef<{ t: number; d: number } | null>(null);
  const lastSave = useRef(0);

  const ep = Math.max(1, Number(sp.get('e')) || 1);
  const server = serverAt(sp.get('p'));
  const mode: Mode = modes[String(serverNo(server))] ?? 'balanced';
  const sandboxed = mode !== 'off';
  // With protection off a player can send the whole page elsewhere; ask before the browser leaves
  useEffect(() => {
    if (mode !== 'off') return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [mode]);
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

  const src = useMemo(
    () => server.url({ id: aid, ep, lang, start, autoskip }),
    // the address must not change while an episode plays
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aid, ep, server, lang, start, reload]
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
      if (r.ended) {
        animeStore.markSeen(aid, ep);
        animeStore.savePos(aid, ep, 0, 0);
        latest.current = null;
        if (autoplay && hasNext) setUpNext(ep + 1);
        return;
      }
      latest.current = r;
      if (r.d > 0 && r.t / r.d > 0.9) animeStore.markSeen(aid, ep);
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
    setLeft(5);
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

  const inList = !!a && lib.list().some((x) => x.id === a.id);
  const loved = !!a && lib.loved().some((x) => x.id === a.id);
  const seen = new Set(lib.seen(aid));
  const nums = Array.from({ length: last }, (_, i) => i + 1);
  const ranges = Math.ceil(nums.length / CHUNK);
  const rangeNow = Math.min(range, Math.max(0, ranges - 1));
  const shown = nums.slice(rangeNow * CHUNK, rangeNow * CHUNK + CHUNK);
  const nextServer = animeServers[serverNo(server) % animeServers.length];

  return (
    <div className="wp">
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

      <iframe
        key={`${src}|${reload}|${mode}`}
        ref={frame}
        className="wp-frame"
        src={src}
        title={a?.title ?? 'Player'}
        allow="autoplay *; fullscreen *; picture-in-picture; encrypted-media *"
        allowFullScreen
        sandbox={SANDBOX[mode]}
      />

      {upNext != null && (
        <div className="wp-upnext" role="status">
          <span><Icon name="play" size={13} fill /> Up next: <b>Episode {upNext}</b> in {Math.max(left, 0)}s</span>
          <button className="pill on" onClick={() => { setUpNext(null); go(upNext); }}>Play now</button>
          <button className="pill" onClick={() => setUpNext(null)}>Cancel</button>
        </div>
      )}

      <div className="wp-servers">
        <b>STREAMING SERVER:</b>
        {animeServers.map((s) => (
          <button key={s.name} className={`pill ${s === server ? 'on' : ''}`} onClick={() => setSp({ e: String(ep), p: String(serverNo(s)), l: s.langs.includes(lang) ? lang : 'sub' }, { replace: true })}>
            {s.name} <small>({s.note})</small>
          </button>
        ))}
        <button className="pill" onClick={() => setReload((n) => n + 1)}><Icon name="refresh" size={14} />Reload</button>
        <button
          className={`pill ${sandboxed ? 'on' : ''}`}
          title="Tap to change: Balanced, Strict or Off"
          onClick={() => {
            const next = { ...modes, [String(serverNo(server))]: NEXT_MODE[mode] };
            setModes(next);
            writeModes(next);
          }}
        >
          <Icon name="shield" size={14} />Protection: {mode === 'balanced' ? 'Balanced' : mode === 'strict' ? 'Strict' : 'Off'}
        </button>
        <span className="chip stat wp-ep">Episode {ep}</span>
      </div>
      <div className="wp-servers">
        <b>AUDIO:</b>
        {server.langs.map((l) => (
          <button key={l} className={`pill ${l === lang ? 'on' : ''}`} onClick={() => setSp({ e: String(ep), p: String(serverNo(server)), l }, { replace: true })}>{LANG_NAME[l]}</button>
        ))}
        <span className="muted small">Player blank or says “sandbox”? Tap Protection to try Strict or Off. </span>
        <span className="muted small">Not loading? Try <button className="link" onClick={() => setSp({ e: String(ep), p: String(serverNo(nextServer)), l: nextServer.langs.includes(lang) ? lang : 'sub' }, { replace: true })}>{nextServer.name}</button>.</span>
      </div>

      <div className="wp-main">
        <div className="wp-left">
          <div className="td-chips">
            {a && a.score > 0 && <span className="chip rate"><Icon name="star" size={14} fill />{(a.score / 10).toFixed(1)}</span>}
            {a?.year && <span className="chip"><Icon name="calendar" size={14} />{a.year}</span>}
            {a?.format && <span className="chip">{FORMAT_LABEL[a.format] ?? a.format}</span>}
            {a?.status && <span className={`chip stat ${a.status === 'FINISHED' || a.status === 'RELEASING' ? 'ok' : ''}`}>{STATUS_LABEL[a.status] ?? a.status}</span>}
          </div>
          <h1>{a?.title ?? 'Loading…'}</h1>
          <AnimeSeasons id={aid} to="/anime/watch/" />
          {a && a.genres.length > 0 && <div className="td-chips">{a.genres.map((g) => <span key={g} className="chip">{g}</span>)}</div>}
          <h3 className="wp-h">Overview</h3>
          <p className="wp-overview">{a?.desc || 'No description available.'}</p>
          <div className="wp-tools">
            {ep > 1 && <button className="btn small ghost" onClick={() => go(ep - 1)}><Icon name="chevronLeft" size={15} />Prev</button>}
            {hasNext && <button className="btn small ghost" onClick={() => go(ep + 1)}>Next<Icon name="chevronRight" size={15} /></button>}
            <Link to={`/anime/title/${aid}`} className="btn small ghost">Details</Link>
          </div>
        </div>

        <aside className="wp-side">
          <section className="wp-eps">
            <div className="season-head">
              <h2 className="section">Episodes</h2>
              {ranges > 1 && (
                <select className="field select dd" value={rangeNow} onChange={(e) => setRange(Number(e.target.value))} aria-label="Episode range">
                  {Array.from({ length: ranges }, (_, i) => (
                    <option key={i} value={i}>{i * CHUNK + 1} – {Math.min((i + 1) * CHUNK, nums.length)}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="aep-grid compact">
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
        </aside>
      </div>

      {a && <AniRow title="You might also like" items={a.recs} />}
    </div>
  );
}
