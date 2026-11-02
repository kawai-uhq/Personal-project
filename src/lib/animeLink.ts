/** Anime found on the main site (from TMDB) belong in the anime section: this finds the same title on AniList
 *  and gives its address, so the main site can send viewers there. Results are remembered on this device. */
import { useEffect, useState } from 'react';
import { aniCandidates } from './anilist';
import type { Media } from './types';

const KEY = 'comvie.tmdb2ani';
const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');

function remembered(k: string): number | null | undefined {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '{}')[k];
    return v === undefined ? undefined : v || null;
  } catch {
    return undefined;
  }
}
function remember(k: string, id: number | null) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || '{}');
    all[k] = id ?? 0;
    const keys = Object.keys(all);
    if (keys.length > 400) keys.slice(0, keys.length - 400).forEach((x) => delete all[x]);
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage blocked */
  }
}

/** The AniList id of a TMDB anime, or null when there's no confident match. */
export async function aniIdFor(m: Media): Promise<number | null> {
  const k = `${m.type}:${m.id}`;
  const hit = remembered(k);
  if (hit !== undefined) return hit;
  const year = Number(m.year) || null;
  const want = [m.title, m.orig].filter(Boolean).map((x) => norm(x as string));
  const formats = m.type === 'movie' ? ['MOVIE'] : ['TV', 'TV_SHORT', 'ONA', 'OVA'];
  let best: { id: number; score: number } | null = null;
  // the original (Japanese) title matches most reliably, then the English one
  for (const q of [m.orig, m.title].filter((x, i, a) => x && a.indexOf(x) === i) as string[]) {
    const list = await aniCandidates(q).catch(() => []);
    for (const c of list) {
      const titleHit = c.titles.some((t) => want.includes(norm(t)));
      let score = titleHit ? 4 : 0;
      if (year && c.year === year) score += 2;
      else if (year && c.year && Math.abs(c.year - year) === 1) score += 1;
      if (c.format && formats.includes(c.format)) score += 1;
      if (!best || score > best.score) best = { id: c.id, score };
    }
    if (best && best.score >= 6) break; // title + year: sure enough
  }
  // a title match, or a near-certain year + format match on the original-title search
  const id = best && best.score >= 5 ? best.id : null;
  remember(k, id);
  return id;
}

/** For a TMDB title flagged as anime: where it lives in the anime section (null while looking or when not found).
 *  Add ?stay=1 to an address to stay on the main site. */
export function useAnimeHome(m: Media | null | undefined, path: (aniId: number) => string): { looking: boolean; to: string | null } {
  const [state, setState] = useState<{ looking: boolean; to: string | null }>({ looking: false, to: null });
  const stay = typeof location !== 'undefined' && new URLSearchParams(location.search).get('stay') === '1';
  const key = m ? `${m.type}:${m.id}` : '';
  useEffect(() => {
    if (!m || !m.anime || stay) return setState({ looking: false, to: null });
    let live = true;
    setState({ looking: true, to: null });
    aniIdFor(m).then((id) => live && setState({ looking: false, to: id ? path(id) : null }));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, m?.anime, stay]);
  return state;
}
