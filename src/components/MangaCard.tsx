import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { Row, rateTone } from './Rows';
import { kindOf, mangaList } from '../lib/manga';
import type { Manga, MangaLite, MangaQuery } from '../lib/manga';

/** Poster-style card for a manga, manhwa or manhua (same look as the other cards). */
export function MangaCard({ m, tag, to }: { m: MangaLite; tag?: string; to?: string }) {
  const score = m.score / 10;
  return (
    <Link to={to ?? `/manga/title/${m.id}`} className="poster">
      <span className="poster-img">
        {m.cover ? <img src={m.cover} alt={m.title} loading="lazy" decoding="async" /> : <span className="poster-missing">{m.title}</span>}
        <span className="pbadge tv">{tag ?? kindOf(m)}</span>
        {score > 0 && <span className={`prate ${rateTone(score)}`}><Icon name="star" size={11} fill />{score.toFixed(1)}</span>}
      </span>
      <span className="ptitle">{m.title}</span>
      <span className="pyear"><Icon name="calendar" size={12} />{[m.year, m.chapters ? `${m.chapters} ch` : ''].filter(Boolean).join(' · ') || 'TBA'}</span>
    </Link>
  );
}

export function MangaRow({ title, items, to }: { title: string; items: (Manga | MangaLite)[]; to?: string }) {
  if (!items.length) return null;
  return (
    <Row title={title} to={to}>
      {items.map((m) => <MangaCard key={m.id} m={m} />)}
    </Row>
  );
}

/** A row that only loads once it is near the screen. */
export function MangaFeedRow({ title, q, to }: { title: string; q: MangaQuery; to?: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [items, setItems] = useState<Manga[]>([]);
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
    mangaList({ ...q, perPage: 20 }).then((r) => live && setItems(r.items)).catch(() => undefined);
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near]);
  return (
    <div ref={host} style={items.length ? undefined : { minHeight: near ? 40 : 360 }}>
      <MangaRow title={title} items={items} to={to} />
    </div>
  );
}
