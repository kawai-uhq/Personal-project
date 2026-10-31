import { useEffect, useState } from 'react';
import { store } from './storage';
import { markChanged } from './cloudData';
import type { AniLite } from './anilist';

/** The anime section's library, kept on this device (separate from the movie / TV library). */
export interface AnimeWatch extends AniLite {
  episode: number;
  server: number; // 1-based server number
  lang: string;
  at: number;
}

const K = { history: 'comvie.anime.history', list: 'comvie.anime.list', loved: 'comvie.anime.loved', progress: 'comvie.anime.progress', seen: 'comvie.anime.seen' };
const EVT = 'comvie:anime';
const remember = () => store.getRemember();

function read<T>(k: string, fb: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fb;
  } catch {
    return fb;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch { /* storage blocked */ }
  markChanged(k); // account sync
  window.dispatchEvent(new Event(EVT));
}

export const animeStore = {
  history: () => read<AnimeWatch[]>(K.history, []),
  list: () => read<AniLite[]>(K.list, []),
  loved: () => read<AniLite[]>(K.loved, []),
  addWatch: (a: AniLite, episode: number, server: number, lang: string) =>
    !remember() ? undefined : write(K.history, [{ ...a, episode, server, lang, at: Date.now() }, ...animeStore.history().filter((w) => w.id !== a.id)].slice(0, 60)),
  /** Add many history entries at once (AniList import): newest per anime wins, newest first. */
  mergeHistory: (items: AnimeWatch[]) => {
    const byId = new Map<number, AnimeWatch>();
    for (const w of [...animeStore.history(), ...items]) {
      const cur = byId.get(w.id);
      if (!cur || w.at > cur.at) byId.set(w.id, w);
    }
    write(K.history, [...byId.values()].sort((a, b) => b.at - a.at).slice(0, 150));
  },
  /** Add many titles to the watchlist or favorites at once (skips ones already there). */
  addMany: (which: 'list' | 'loved', items: AniLite[]) => {
    const cur = animeStore[which]();
    const have = new Set(cur.map((x) => x.id));
    const fresh = items.filter((x) => !have.has(x.id) && (have.add(x.id), true)).map(lite);
    if (fresh.length) write(K[which], [...cur, ...fresh]);
    return fresh.length;
  },
  removeWatch: (id: number) => write(K.history, animeStore.history().filter((w) => w.id !== id)),
  clearHistory: () => write(K.history, []),
  toggle: (which: 'list' | 'loved', a: AniLite) => {
    const cur = animeStore[which]();
    write(K[which], cur.some((x) => x.id === a.id) ? cur.filter((x) => x.id !== a.id) : [lite(a), ...cur]);
  },
  // playback position per episode
  pos: (id: number, ep: number) => read<Record<string, { t: number; d: number }>>(K.progress, {})[`${id}:${ep}`] ?? null,
  savePos: (id: number, ep: number, t: number, d: number) => {
    const all = read<Record<string, { t: number; d: number }>>(K.progress, {});
    all[`${id}:${ep}`] = { t, d };
    try { localStorage.setItem(K.progress, JSON.stringify(all)); } catch { /* ignore */ }
  },
  seen: (id: number) => read<Record<string, number[]>>(K.seen, {})[id] ?? [],
  markSeen: (id: number, ep: number) => animeStore.setSeen(id, ep, true),
  /** Mark episodes 1…n watched in one go (AniList import). */
  seenUpTo: (id: number, n: number) => {
    if (!(n > 0)) return;
    const all = read<Record<string, number[]>>(K.seen, {});
    const cur = new Set(all[id] ?? []);
    for (let e = 1; e <= Math.min(n, 2000); e++) cur.add(e);
    all[id] = [...cur].sort((a, b) => a - b);
    write(K.seen, all);
  },
  setSeen: (id: number, ep: number, on: boolean) => {
    const all = read<Record<string, number[]>>(K.seen, {});
    const cur = all[id] ?? [];
    all[id] = on ? (cur.includes(ep) ? cur : [...cur, ep]) : cur.filter((x) => x !== ep);
    write(K.seen, all);
  }
};

const lite = (a: AniLite): AniLite => ({ id: a.id, title: a.title, cover: a.cover, score: a.score, format: a.format, year: a.year, episodes: a.episodes });

/** Re-render when the anime library changes (this tab or another). */
export function useAnimeStore() {
  const [, setN] = useState(0);
  useEffect(() => {
    const f = () => setN((n) => n + 1);
    window.addEventListener(EVT, f);
    window.addEventListener('storage', f);
    return () => {
      window.removeEventListener(EVT, f);
      window.removeEventListener('storage', f);
    };
  }, []);
  return animeStore;
}

/** Where playback resumes: 5 seconds before where you stopped (same rule as the rest of the site). */
export const resumeFrom = (t: number, d: number) => (t >= 15 && !(d > 0 && d - t < 60) ? Math.max(0, Math.floor(t) - 5) : 0);
