import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { Row, rateTone } from './Rows';
import { FORMAT_LABEL, aniList } from '../lib/anilist';
import type { Ani, AniLite, AniQuery } from '../lib/anilist';

/** Poster-style card for an anime (same look as the movie cards). */
export function AnimeCard({ a, tag, to }: { a: AniLite; tag?: string; to?: string }) {
  const score = a.score / 10;
  return (
    <Link to={to ?? `/anime/title/${a.id}`} className="poster">
      <span className="poster-img">
        {a.cover ? <img src={a.cover} alt={a.title} loading="lazy" decoding="async" /> : <span className="poster-missing">{a.title}</span>}
        <span className="pbadge tv">{tag ?? (a.format ? FORMAT_LABEL[a.format] ?? a.format : 'ANIME')}</span>
        {score > 0 && <span className={`prate ${rateTone(score)}`}><Icon name="star" size={11} fill />{score.toFixed(1)}</span>}
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
