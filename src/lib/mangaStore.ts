import { useEffect, useState } from 'react';
import { store } from './storage';
import { markChanged } from './cloudData';
import type { MangaLite } from './manga';

/** The manga section's library, kept on this device. */
export interface MangaRead extends MangaLite {
  chapterId: string;
  label: string; // "Chapter 12"
  lang?: string;
  at: number;
}

const K = { history: 'comvie.manga.history', list: 'comvie.manga.list', seen: 'comvie.manga.seen' };
const EVT = 'comvie:manga';
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

const lite = (m: MangaLite): MangaLite => ({ id: m.id, title: m.title, cover: m.cover, score: m.score, format: m.format, year: m.year, chapters: m.chapters, country: m.country });

export const mangaStore = {
  history: () => read<MangaRead[]>(K.history, []),
  list: () => read<MangaLite[]>(K.list, []),
  addRead: (m: MangaLite, chapterId: string, label: string, lang = 'en') =>
    !remember() ? undefined : write(K.history, [{ ...lite(m), chapterId, label, lang, at: Date.now() }, ...mangaStore.history().filter((w) => w.id !== m.id)].slice(0, 60)),
  removeRead: (id: number) => write(K.history, mangaStore.history().filter((w) => w.id !== id)),
  clearHistory: () => write(K.history, []),
  last: (id: number) => mangaStore.history().find((w) => w.id === id) ?? null,
  toggleList: (m: MangaLite) => {
    const cur = mangaStore.list();
    write(K.list, cur.some((x) => x.id === m.id) ? cur.filter((x) => x.id !== m.id) : [lite(m), ...cur]);
  },
  seen: (id: number) => read<Record<string, string[]>>(K.seen, {})[id] ?? [],
  markSeen: (id: number, chapterId: string) => {
    const all = read<Record<string, string[]>>(K.seen, {});
    const cur = all[id] ?? [];
    if (cur.includes(chapterId)) return;
    all[id] = [...cur, chapterId];
    write(K.seen, all);
  }
};

/** Re-render when the manga library changes (this tab or another). */
export function useMangaStore() {
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
  return mangaStore;
}
