import { useEffect, useRef, useState } from 'react';
import { serverSlug } from '../lib/providers';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { isSmooth } from '../lib/perf';
import { IMG, posterSet, posterSrc, tmdb } from '../lib/tmdb';
import { mediaKey, progressLabel } from '../lib/types';
import type { Details, Media, WatchEntry } from '../lib/types';

export function Row({ title, children, to }: { title: string; children: ReactNode; to?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };
  return (
    <section className="row">
      <div className="row-head">
        <h2><span className="bar" aria-hidden="true" />{title}</h2>
        <div className="row-ctrl">
          {to && <Link to={to} className="explore">Explore All<Icon name="arrowRight" size={14} /></Link>}
          <button className="rbtn" aria-label="Scroll left" onClick={() => scroll(-1)}><Icon name="chevronLeft" size={18} /></button>
          <button className="rbtn" aria-label="Scroll right" onClick={() => scroll(1)}><Icon name="chevronRight" size={18} /></button>
        </div>
      </div>
      <div className="row-scroll" ref={ref}>{children}</div>
    </section>
  );
}

/** Rating chip colour: green for 7+, amber for 5+, red below. */
export const rateTone = (r: number) => (r >= 7 ? 'good' : r >= 5 ? 'mid' : 'low');

const canHover = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

type Phase = 'idle' | 'prep' | 'open' | 'closing';
interface Dims { pw: number; iw: number; ih: number; tw: number }

/**
 * Poster card. On devices with a mouse, hovering for a moment grows the card sideways into a landscape
 * tile (neighbours move aside, the tile stays centred) and plays the trailer inside it, without controls.
 */
export function Poster({ m, rank, fresh }: { m: Media; rank?: number; fresh?: boolean }) {
  const [phase, setPhaseState] = useState<Phase>('idle');
  const [key, setKey] = useState<string | null>(null);
  const [dm, setDm] = useState<Dims | null>(null);
  const [ready, setReady] = useState(false);
  const phaseRef = useRef<Phase>('idle');
  const timer = useRef<number | undefined>(undefined);
  const endTimer = useRef<number | undefined>(undefined);
  const hovering = useRef(false);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const imgRef = useRef<HTMLSpanElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const scroller = useRef<HTMLElement | null>(null);
  const applied = useRef(0);
  const raf = useRef(0);

  const setPhase = (p: Phase) => {
    phaseRef.current = p;
    setPhaseState(p);
  };

  /** Slide the row sideways by `to` px (eased like the width change) so the tile grows around its own centre. */
  const shiftRow = (to: number) => {
    const sc = scroller.current;
    if (!sc) return;
    cancelAnimationFrame(raf.current);
    const from = applied.current;
    const base = sc.scrollLeft - from;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 280);
      const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      applied.current = from + (to - from) * e;
      sc.scrollLeft = base + applied.current;
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  const close = () => {
    hovering.current = false;
    window.clearTimeout(timer.current);
    if (phaseRef.current === 'idle' || phaseRef.current === 'closing') return;
    setPhase('closing');
    setReady(false);
    shiftRow(0);
    endTimer.current = window.setTimeout(() => {
      setPhase('idle');
      setKey(null);
      setDm(null);
      if (scroller.current) scroller.current.style.scrollSnapType = '';
      scroller.current = null;
      applied.current = 0;
    }, 320);
  };

  const expand = (k: string) => {
    const sc = linkRef.current?.closest('.row-scroll') as HTMLElement | null;
    const pr = linkRef.current?.getBoundingClientRect();
    const ir = imgRef.current?.getBoundingClientRect();
    if (!sc || !pr || !ir || phaseRef.current !== 'idle') return;
    const tw = Math.round((ir.height * 16) / 9);
    // grow around the centre, but never past the window edges
    const want = (tw - pr.width) / 2;
    const lo = pr.left + tw - (window.innerWidth - 8);
    const hi = pr.left - 8;
    const shift = Math.max(0, Math.min(Math.max(want, lo), hi));
    scroller.current = sc;
    applied.current = 0;
    sc.style.scrollSnapType = 'none';
    setDm({ pw: pr.width, iw: ir.width, ih: ir.height, tw });
    setKey(k);
    setReady(false);
    setPhase('prep');
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (phaseRef.current !== 'prep') return;
        setPhase('open');
        shiftRow(shift);
      })
    );
  };

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(endTimer.current);
      cancelAnimationFrame(raf.current);
      if (scroller.current) scroller.current.style.scrollSnapType = '';
    },
    []
  );

  // Page scrolling would leave the tile behind the pointer: fold it back
  useEffect(() => {
    if (phase === 'idle') return;
    const f = () => close();
    window.addEventListener('scroll', f);
    return () => window.removeEventListener('scroll', f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // YouTube shows its own pause / skip / title overlay for the first seconds of playback on touch-capable
  // devices, and no embed option hides it. So the trailer plays invisibly and is only revealed once the
  // overlay has gone, with the tile showing the backdrop meanwhile.
  useEffect(() => {
    if (phase !== 'open' || !key) return;
    let reveal: number | undefined;
    const fallback = window.setTimeout(() => setReady(true), 7000);
    const listen = () => frameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    const poll = window.setInterval(listen, 600);
    const onMsg = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow || typeof e.data !== 'string') return;
      let d: any;
      try { d = JSON.parse(e.data); } catch { return; }
      const st = d?.event === 'onStateChange' ? d.info : d?.info?.playerState;
      if (st === 0) {
        // loop by hand: the "playlist" embed option that does it natively also adds prev / next buttons
        const w = frameRef.current?.contentWindow;
        w?.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [6, true] }), '*');
        w?.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      }
      if (st === 1 && reveal === undefined) {
        window.clearInterval(poll);
        window.clearTimeout(fallback);
        reveal = window.setTimeout(() => setReady(true), 2500);
      }
    };
    window.addEventListener('message', onMsg);
    return () => {
      window.removeEventListener('message', onMsg);
      window.clearInterval(poll);
      window.clearTimeout(fallback);
      window.clearTimeout(reveal);
    };
  }, [phase, key]);

  // Warm the title page so it opens instantly
  const warm = () => {
    if (!isSmooth()) return;
    tmdb.details(m.type, m.id).catch(() => undefined);
  };

  const enter = () => {
    warm();
    if (!canHover()) return;
    hovering.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      tmdb
        .trailer(m.type, m.id)
        .then((k) => {
          if (hovering.current && k) expand(k);
        })
        .catch(() => undefined);
    }, 500);
  };

  const landscape = phase !== 'idle' && dm;
  const wide = phase === 'open';
  const backdrop = m.backdrop ? `${IMG.large}${m.backdrop}` : null;

  return (
    <Link
      ref={linkRef}
      to={`/title/${m.type}/${m.id}`}
      className={`poster ${rank ? 'ranked' : ''} ${landscape ? 'lscape' : ''} ${wide ? 'expanded' : ''}`}
      style={landscape ? { width: wide ? dm.tw : dm.pw } : undefined}
      onMouseEnter={enter}
      onTouchStart={warm}
      onMouseLeave={close}
    >
      {rank ? <span className="rank" aria-hidden="true">{rank}</span> : null}
      <span className="poster-img" ref={imgRef} style={landscape ? { width: wide ? dm.tw : dm.iw, height: dm.ih } : undefined}>
        {m.poster ? (
          <img
            src={posterSrc(m.poster)}
            srcSet={posterSet(m.poster)}
            sizes="(max-width: 760px) 34vw, 190px"
            alt={m.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="poster-missing">{m.title}</span>
        )}
        {landscape && <img className={`pbd ${wide ? 'on' : ''}`} src={backdrop ?? (m.poster ? posterSrc(m.poster) : '')} alt="" />}
        {wide && key && (
          <>
            <iframe
              ref={frameRef}
              className={`ptrailer ${ready ? 'on' : ''}`}
              src={`https://www.youtube-nocookie.com/embed/${key}?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&fs=0&cc_load_policy=0&showinfo=0&start=6&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
              allow="autoplay; encrypted-media"
              tabIndex={-1}
              title=""
            />
            <span className="pshield" aria-hidden="true" />
          </>
        )}
        {fresh && <span className="pnew">NEW EP</span>}
        <span className={`pbadge ${m.type}`}>{m.type === 'tv' ? 'TV SERIES' : 'MOVIE'}</span>
        <span className={`prate ${rateTone(m.rating)}`}><Icon name="star" size={11} fill />{m.rating.toFixed(1)}</span>
      </span>
      <span className="ptitle">{m.title}</span>
      {m.year && <span className="pyear"><Icon name="calendar" size={12} />{m.year}</span>}
    </Link>
  );
}

export function PosterRow({ title, items, top10, to, fresh }: { title: string; items: Media[]; top10?: boolean; to?: string; fresh?: Set<string> }) {
  if (!items.length) return null;
  const shown = top10 ? items.slice(0, 10) : items;
  return (
    <Row title={title} to={to}>
      {shown.map((m, i) => (
        <Poster key={mediaKey(m)} m={m} rank={top10 ? i + 1 : undefined} fresh={fresh?.has(mediaKey(m))} />
      ))}
    </Row>
  );
}

/** True when a newer episode than the one last watched aired in the past three weeks. */
function hasNewEpisode(w: WatchEntry, d: Details): boolean {
  const la = d.lastAired;
  if (!la || w.media.type !== 'tv' || !w.season || !w.episode) return false;
  const age = Date.now() - new Date(la.date).getTime();
  if (!(age >= 0 && age < 21 * 86_400_000)) return false;
  return la.season > w.season || (la.season === w.season && la.episode > w.episode);
}

function ContinueCard({ w, onRemove }: { w: WatchEntry; onRemove: (key: string) => void }) {
  const m = w.media;
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    if (m.type !== 'tv') return;
    let live = true;
    tmdb.details('tv', m.id).then((d) => live && setFresh(hasNewEpisode(w, d))).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [m.id, m.type, w]);

  const to = `/watch/${m.type}/${m.id}?s=${w.season ?? 1}&e=${w.episode ?? 1}&p=${serverSlug(w.providerId)}`;
  const img = m.backdrop ? IMG.large + m.backdrop : m.poster ? posterSrc(m.poster) : null;
  return (
    <div className="continue">
      <Link to={to} className="continue-img" aria-label={`Resume ${m.title}`}>
        {img && <img src={img} alt="" loading="lazy" />}
        {fresh && <span className="new-badge">New episode</span>}
        <span className="play-badge" aria-hidden="true"><Icon name="play" size={22} fill /></span>
      </Link>
      <div className="continue-meta">
        <div>
          <strong>{m.title}</strong>
          <small>{progressLabel(w)}</small>
        </div>
        <button className="x" aria-label={`Remove ${m.title} from Continue Watching`} onClick={() => onRemove(mediaKey(m))}><Icon name="x" size={14} /></button>
      </div>
    </div>
  );
}

export function ContinueRow({ items, onRemove }: { items: WatchEntry[]; onRemove: (key: string) => void }) {
  if (!items.length) return null;
  return (
    <Row title="Continue Watching">
      {items.map((w) => (
        <ContinueCard key={mediaKey(w.media)} w={w} onRemove={onRemove} />
      ))}
    </Row>
  );
}

export function Grid({ items, fresh, cards }: { items: Media[]; fresh?: Set<string>; cards?: boolean }) {
  return (
    <div className={`grid ${cards ? 'cards' : ''}`}>
      {items.map((m) => (
        <Poster key={mediaKey(m)} m={m} fresh={fresh?.has(mediaKey(m))} />
      ))}
    </div>
  );
}

export function Status({ kind, text, retry }: { kind: 'loading' | 'error' | 'empty'; text?: string; retry?: () => void }) {
  if (kind === 'loading') return <div className="status"><div className="spinner" aria-label="Loading" /></div>;
  return (
    <div className="status">
      <p>{text}</p>
      {kind === 'error' && retry && <button className="btn" onClick={retry}>Try again</button>}
    </div>
  );
}

/* Loading placeholders that match the real layout */
export function HomeSkeleton() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading">
      <div className="sk sk-billboard" />
      {[0, 1, 2].map((r) => (
        <section className="row" key={r}>
          <div className="sk sk-title" style={{ marginLeft: 'var(--pad)' }} />
          <div className="row-scroll">
            {Array.from({ length: 9 }, (_, i) => <div key={i} className="sk sk-poster" />)}
          </div>
        </section>
      ))}
    </main>
  );
}

export function DetailSkeleton() {
  return (
    <main className="page" aria-busy="true" aria-label="Loading">
      <div className="sk sk-billboard" />
      <div className="container">
        <div className="sk sk-line" style={{ width: 'min(700px, 100%)', marginTop: 24 }} />
        <div className="sk sk-line" style={{ width: 'min(560px, 90%)' }} />
        <div className="sk sk-line" style={{ width: 'min(620px, 95%)' }} />
      </div>
    </main>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 12 }, (_, i) => <div key={i} className="sk sk-grid" />)}
    </div>
  );
}
