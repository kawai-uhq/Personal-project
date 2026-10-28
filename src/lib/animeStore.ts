import { useEffect, useState } from 'react';
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
  window.dispatchEvent(new Event(EVT));
}

export const animeStore = {
  history: () => read<AnimeWatch[]>(K.history, []),
  list: () => read<AniLite[]>(K.list, []),
  loved: () => read<AniLite[]>(K.loved, []),
  addWatch: (a: AniLite, episode: number, server: number, lang: string) =>
    write(K.history, [{ ...a, episode, server, lang, at: Date.now() }, ...animeStore.history().filter((w) => w.id !== a.id)].slice(0, 60)),
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
