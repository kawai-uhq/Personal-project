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

/** Poster card. On devices with a mouse, hovering for a moment plays the trailer on the picture. */
export function Poster({ m, rank, fresh }: { m: Media; rank?: number; fresh?: boolean }) {
  const [trailer, setTrailer] = useState<string | null>(null);
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const hovering = useRef(false);
  const imgRef = useRef<HTMLSpanElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A fixed preview would drift if the page or a row scrolls: close it instead
  useEffect(() => {
    if (!trailer) return;
    const close = () => {
      hovering.current = false;
      setTrailer(null);
      setBox(null);
    };
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [trailer]);

  /** Landscape preview centred over the poster, kept inside the window. */
  const place = () => {
    const r = imgRef.current?.getBoundingClientRect();
    if (!r) return null;
    const height = Math.round(r.height * 1.08);
    const width = Math.round((height * 16) / 9);
    const left = Math.min(Math.max(r.left + r.width / 2 - width / 2, 8), Math.max(8, window.innerWidth - width - 8));
    const top = Math.min(Math.max(r.top + r.height / 2 - height / 2, 80), Math.max(80, window.innerHeight - height - 8));
    return { left, top, width, height };
  };

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
          if (!hovering.current || !k) return;
          setBox(place());
          setTrailer(k);
        })
        .catch(() => undefined);
    }, 700);
  };
  const leave = () => {
    hovering.current = false;
    window.clearTimeout(timer.current);
    setTrailer(null);
    setBox(null);
  };

  return (
    <Link
      to={`/title/${m.type}/${m.id}`}
      className={`poster ${rank ? 'ranked' : ''}`}
      onMouseEnter={enter}
      onTouchStart={warm}
      onMouseLeave={leave}
    >
      {rank ? <span className="rank" aria-hidden="true">{rank}</span> : null}
      <span className="poster-img" ref={imgRef}>
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
        {fresh && <span className="pnew">NEW EP</span>}
        <span className={`pbadge ${m.type}`}>{m.type === 'tv' ? 'TV SERIES' : 'MOVIE'}</span>
        <span className={`prate ${rateTone(m.rating)}`}><Icon name="star" size={11} fill />{m.rating.toFixed(1)}</span>
      </span>
      {trailer && box && (
        <span className="hover-preview" style={box} aria-hidden="true">
          <iframe
            className="hp-frame"
            src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&fs=0&cc_load_policy=0&loop=1&playlist=${trailer}`}
            allow="autoplay; encrypted-media"
            tabIndex={-1}
            title=""
          />
        </span>
      )}
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

export function Grid({ items, fresh }: { items: Media[]; fresh?: Set<string> }) {
  return (
    <div className="grid">
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
