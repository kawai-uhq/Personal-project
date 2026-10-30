import { useEffect, useState } from 'react';
import type { Channel } from './iptv';

/** [start, end, title] in unix seconds */
type Prog = [number, number, string];
interface Guide {
  t: number;
  p: Record<string, Prog[]>;
}

let cache: Promise<Guide | null> | null = null;
/** The TV guide the site rebuilds twice a day (public/epg.json). Null when it isn't there yet. */
export function loadGuide(): Promise<Guide | null> {
  if (!cache) {
    cache = fetch('/epg.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => (g && g.p && typeof g.p === 'object' ? (g as Guide) : null))
      .catch(() => null);
  }
  return cache;
}

export function useGuide() {
  const [g, setG] = useState<Guide | null>(null);
  useEffect(() => {
    let live = true;
    loadGuide().then((x) => live && setG(x));
    return () => {
      live = false;
    };
  }, []);
  return g;
}

/** Re-renders once a minute so "on now" stays right */
export function useClock() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 60000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export interface Airing {
  channel: Channel;
  title: string;
  start: number;
  end: number;
  live: boolean;
}

export function nowOn(g: Guide | null, id: string, now: number): { cur: Prog | null; next: Prog | null } {
  const list = g?.p[id];
  if (!list) return { cur: null, next: null };
  const i = list.findIndex((p) => p[1] > now);
  if (i < 0) return { cur: null, next: null };
  return list[i][0] <= now ? { cur: list[i], next: list[i + 1] ?? null } : { cur: null, next: list[i] };
}

const FILLER = new Set(['vs', 'v', 'versus', 'vs.', 'v.', 'live', 'the', 'at', 'on', 'in', 'of']);
const tokens = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w));

/** Programmes that are on now or start within a day whose title contains every word searched */
export function searchGuide(g: Guide | null, byId: Map<string, Channel>, term: string, now: number, limit = 40): Airing[] {
  const need = tokens(term);
  if (!g || !need.length) return [];
  const out: Airing[] = [];
  for (const [id, list] of Object.entries(g.p)) {
    const ch = byId.get(id);
    if (!ch) continue;
    for (const [s, e, title] of list) {
      if (e <= now || s > now + 24 * 3600) continue;
      const hay = ' ' + tokens(title).join(' ') + ' ' + tokens(ch.name).join(' ');
      if (need.every((w) => hay.includes(w))) out.push({ channel: ch, title, start: s, end: e, live: s <= now });
    }
  }
  return out.sort((a, b) => Number(b.live) - Number(a.live) || a.start - b.start).slice(0, limit);
}

/** Words that mean "a kind of channel" even when no guide lists them */
const ALIASES: [RegExp, string][] = [
  [/\b(cricket|ipl|t20|odi|test match|football|soccer|premier league|la liga|champions league|f1|formula ?1|formula one|motogp|nba|nfl|nhl|mlb|ufc|wwe|boxing|tennis|golf|rugby|hockey|olympics|match|vs)\b/i, 'sports'],
  [/\b(oggy|cockroach|cartoon|kids|tom and jerry|doraemon|shinchan|peppa|pokemon|animation)\b/i, 'kids'],
  [/\b(news|headlines|breaking)\b/i, 'news'],
  [/\b(movie|film|cinema)\b/i, 'movies'],
  [/\b(song|songs|music|hits)\b/i, 'music']
];
export function aliasCategory(term: string): string | null {
  for (const [re, cat] of ALIASES) if (re.test(term)) return cat;
  return null;
}

export const clock = (sec: number) => new Date(sec * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
export function when(sec: number, now: number) {
  const d = new Date(sec * 1000);
  const same = d.toDateString() === new Date(now * 1000).toDateString();
  return same ? clock(sec) : `${d.toLocaleDateString([], { weekday: 'short' })} ${clock(sec)}`;
}
