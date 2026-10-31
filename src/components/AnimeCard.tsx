import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import ConsentGate from './ConsentGate';
import { Row, rateTone } from './Rows';
import { FORMAT_LABEL, aniList } from '../lib/anilist';
import type { Ani, AniLite, AniQuery } from '../lib/anilist';

/** Poster-style card for an anime (same look as the movie cards). */
const canHover = () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

export function AnimeCard({ a, tag, to, onRemove }: { a: AniLite; tag?: string; to?: string; onRemove?: () => void }) {
  const score = a.score / 10;
  // trailer preview: hold the pointer on a cover for a moment (computers only, when AniList has a trailer)
  const trailer = 'trailer' in a ? (a as Ani).trailer : null;
  const [play, setPlay] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef<number>();
  const enter = () => {
    if (!trailer || !canHover() || document.documentElement.classList.contains('no-motion')) return;
    timer.current = window.setTimeout(() => setPlay(true), 750);
  };
  const leave = () => {
    window.clearTimeout(timer.current);
    setPlay(false);
    setReady(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Link to={to ?? `/anime/title/${a.id}`} className={`poster ${play ? 'previewing' : ''}`} onMouseEnter={enter} onMouseLeave={leave}>
      <span className="poster-img">
        {play && trailer && (
          <ConsentGate label="Trailer" compact>
            <span className={`acard-trailer ${ready ? 'on' : ''}`} aria-hidden="true">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer}?autoplay=1&mute=1&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&fs=0&loop=1&playlist=${trailer}`}
                allow="autoplay; encrypted-media"
                tabIndex={-1}
                title=""
                onLoad={() => window.setTimeout(() => setReady(true), 900)}
              />
            </span>
          </ConsentGate>
        )}
        {a.cover ? <img src={a.cover} alt={a.title} loading="lazy" decoding="async" /> : <span className="poster-missing">{a.title}</span>}
        <span className="pbadge tv">{tag ?? (a.format ? FORMAT_LABEL[a.format] ?? a.format : 'ANIME')}</span>
        {onRemove ? (
          <button
            className="card-x"
            aria-label={`Remove ${a.title}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
          >
            <Icon name="x" size={14} />
          </button>
        ) : score > 0 && <span className={`prate ${rateTone(score)}`}><Icon name="star" size={11} fill />{score.toFixed(1)}</span>}
      </span>
      <span className="ptitle">{a.title}</span>
      <span className="pyear"><Icon name="calendar" size={12} />{[a.year, a.episodes ? `${a.episodes} eps` : ''].filter(Boolean).join(' · ') || 'TBA'}</span>
    </Link>
  );
}

export function AniRow({ title, items, to }: { title: string; items: (Ani | AniLite)[]; to?: string }) {
  if (!items.length) return null;
  return (
    <Row title={title} to={to}>
      {items.map((a) => <AnimeCard key={a.id} a={a} />)}
    </Row>
  );
}

/** A row that only loads once it is near the screen (keeps the AniList request count down). */
export function AniFeedRow({ title, q, to }: { title: string; q: AniQuery; to?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [items, setItems] = useState<Ani[]>([]);
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((e) => {
      if (e.some((x) => x.isIntersecting)) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: '500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    let live = true;
    aniList({ ...q, perPage: 20 }).then((r) => live && setItems(r.items)).catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);
  return (
    <div ref={host} style={items.length ? undefined : { minHeight: near ? 40 : 360 }}>
      <AniRow title={title} items={items} to={to} />
    </div>
  );
}
