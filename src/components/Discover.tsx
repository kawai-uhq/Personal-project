import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { Row } from './Rows';
import { ANIME_MOODS, CINEMA_MOODS, COLLECTION_IDS, MANGA_MOODS, surprise } from '../lib/discover';
import type { Mood } from '../lib/discover';
import { useSection } from '../lib/section';
import { toPublic as P } from '../lib/site';
import { IMG, posterSrc, tmdb } from '../lib/tmdb';

export const moodsFor = (s: 'cinema' | 'anime' | 'manga'): Mood[] => (s === 'anime' ? ANIME_MOODS : s === 'manga' ? MANGA_MOODS : CINEMA_MOODS);
export const moodPath = (s: 'cinema' | 'anime' | 'manga', id: string) => P(s === 'cinema' ? `/mood/${id}` : `/${s}/mood/${id}`);

/** A coloured mood tile. */
export function MoodCard({ m, to }: { m: Mood; to: string }) {
  return (
    <Link to={to} className="mood" style={{ ['--h' as any]: m.hue }}>
      <span className="mood-icon"><Icon name={m.icon} size={20} /></span>
      <strong>{m.label}</strong>
      <small>{m.blurb}</small>
    </Link>
  );
}

/** Home-page row: "Browse by mood". */
export function MoodRow({ section }: { section: 'cinema' | 'anime' | 'manga' }) {
  return (
    <Row title="Browse by Mood">
      {moodsFor(section).map((m) => <MoodCard key={m.id} m={m} to={moodPath(section, m.id)} />)}
    </Row>
  );
}

/** Home-page row of film series (loads when near the screen). */
export function CollectionsRow() {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [items, setItems] = useState<{ id: number; name: string; poster: string | null; count: number }[]>([]);
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!near) return;
    let live = true;
    Promise.all(COLLECTION_IDS.slice(0, 14).map((id) => tmdb.collection(id).catch(() => null))).then((r) => {
      if (live) setItems(r.filter((c): c is NonNullable<typeof c> => !!c && !!c.name && c.items.length > 1).map((c) => ({ id: c.id, name: c.name, poster: c.poster, count: c.items.length })));
    });
    return () => { live = false; };
  }, [near]);
  return (
    <div ref={host} style={items.length ? undefined : { minHeight: near ? 40 : 300 }}>
      {items.length > 0 && (
        <Row title="Collections" to="/collections">
          {items.map((c) => (
            <Link key={c.id} to={`/collection/${c.id}`} className="poster">
              <span className="poster-img">{c.poster ? <img src={posterSrc(c.poster)} alt={c.name} loading="lazy" /> : <span className="poster-missing">{c.name}</span>}<span className="pbadge">{c.count} FILMS</span></span>
              <span className="ptitle">{c.name.replace(/ Collection$/, '')}</span>
            </Link>
          ))}
        </Row>
      )}
    </div>
  );
}
void IMG;

/** Top-bar button: open a random well-liked title. */
export function SurpriseButton() {
  const section = useSection();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={`gear surprise ${busy ? 'busy' : ''}`}
      aria-label="Surprise me: open a random title"
      title="Surprise me"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const to = await surprise(section);
          if (to) nav(to);
        } catch { /* try again */ }
        setBusy(false);
      }}
    >
      <Icon name="shuffle" size={18} />
    </button>
  );
}
