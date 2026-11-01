import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { Row } from './Rows';
import { ANIME_MOODS, CINEMA_MOODS, MANGA_MOODS, surprise } from '../lib/discover';
import { COLLECTION_KEYS } from '../lib/collections';
import { CollectionCardByKey } from './CollectionCard';
import type { Mood } from '../lib/discover';
import { useSection } from '../lib/section';
import { toPublic as P } from '../lib/site';
import { IMG } from '../lib/tmdb';

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

/** Home-page row of collections: poster-fan cards (loads when near the screen). */
export function CollectionsRow() {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={host} className="cf-row" style={near ? undefined : { minHeight: 300 }}>
      {near && (
        <Row title="Collections" to="/collections">
          {COLLECTION_KEYS.slice(0, 12).map((k, i) => <CollectionCardByKey key={k} k={k} delay={(i % 3) * 1200} />)}
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
      className={`nav-dice ${busy ? 'busy' : ''}`}
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
      <Icon name="dice" size={18} />
      <span className="nav-dice-tip" aria-hidden="true">Surprise me</span>
    </button>
  );
}
