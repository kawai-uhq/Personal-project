/** Anime episode names (and filler / recap flags) from Jikan, the free MyAnimeList API. Best effort: when
 *  Jikan is down or slow, the episode list just shows "Episode N". */
import { useEffect, useState } from 'react';

export interface EpInfo {
  title: string;
  filler: boolean;
  recap: boolean;
}

export type EpTitles = Record<number, EpInfo>;

const API = 'https://api.jikan.moe/v4/anime';
const PAGE = 100; // Jikan returns 100 episodes per page
const KEEP = 'comvie.eptitles.';
const DAY = 86400000;

const pages = new Map<string, Promise<{ eps: EpTitles; more: boolean }>>();
let queue: Promise<unknown> = Promise.resolve();

// Jikan allows about 3 requests a second: requests go out one at a time with a small gap
const throttled = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => new Promise((r) => setTimeout(r, 400)),
    () => new Promise((r) => setTimeout(r, 400))
  );
  return run;
};

function saved(key: string): { eps: EpTitles; more: boolean } | null {
  try {
    const raw = localStorage.getItem(KEEP + key);
    if (!raw) return null;
    const v = JSON.parse(raw);
    return Date.now() - v.at < 3 * DAY ? v.d : null;
  } catch {
    return null;
  }
}

function save(key: string, d: { eps: EpTitles; more: boolean }) {
  try {
    const idxKey = KEEP + 'index';
    const idx: string[] = JSON.parse(localStorage.getItem(idxKey) || '[]').filter((k: string) => k !== key);
    idx.push(key);
    while (idx.length > 30) localStorage.removeItem(KEEP + idx.shift());
    localStorage.setItem(KEEP + key, JSON.stringify({ at: Date.now(), d }));
    localStorage.setItem(idxKey, JSON.stringify(idx));
  } catch {
    /* storage full or blocked: titles are fetched again next time */
  }
}

/** One page (100 episodes) of an anime's episode list */
function page(mal: number, n: number) {
  const key = `${mal}:${n}`;
  let p = pages.get(key);
  if (p) return p;
  const kept = saved(key);
  if (kept) {
    p = Promise.resolve(kept);
  } else {
    p = throttled(async () => {
      const r = await fetch(`${API}/${mal}/episodes?page=${n}`);
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      const eps: EpTitles = {};
      for (const x of Array.isArray(j?.data) ? j.data : []) {
        const no = Number(x?.mal_id);
        const title = typeof x?.title === 'string' ? x.title.trim() : '';
        if (no > 0 && title) eps[no] = { title, filler: !!x.filler, recap: !!x.recap };
      }
      const d = { eps, more: !!j?.pagination?.has_next_page };
      save(key, d);
      return d;
    });
    p.catch(() => pages.delete(key)); // a failed page can be tried again later
  }
  pages.set(key, p);
  return p;
}

/** Episode names for the given MyAnimeList id, loading the pages that cover episodes `from`..`to`. */
export function useEpisodeTitles(mal: number | null | undefined, from: number, to: number): EpTitles {
  const [eps, setEps] = useState<EpTitles>({});
  useEffect(() => setEps({}), [mal]);
  useEffect(() => {
    if (!mal || to < from) return;
    let live = true;
    const first = Math.floor((Math.max(1, from) - 1) / PAGE) + 1;
    const last = Math.floor((Math.max(1, to) - 1) / PAGE) + 1;
    (async () => {
      for (let n = first; n <= last && live; n++) {
        try {
          const r = await page(mal, n);
          if (!live) return;
          setEps((cur) => ({ ...cur, ...r.eps }));
          if (!r.more) return;
        } catch {
          return; // Jikan unavailable: keep plain "Episode N"
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [mal, from, to]);
  return eps;
}
