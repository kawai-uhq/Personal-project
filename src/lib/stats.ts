/** Watch stats from what's saved on this device (and synced to the account): ticks, history and read marks. */
import { animeStore } from './animeStore';
import { mangaStore } from './mangaStore';
import { store } from './storage';

export interface WatchStats {
  movies: number;
  episodes: number;
  animeEpisodes: number;
  chapters: number;
  hours: number; // estimate
  streak: number; // days in a row with something watched or read, up to today
  activeThisMonth: number; // days this month with something watched or read
  titles: number; // different movies, shows and anime started
  bestStreak: number; // longest run of days in a row, ever
  nightWatches: number; // things watched between midnight and 4 am
}

const read = <T,>(k: string, fb: T): T => {
  try { return (JSON.parse(localStorage.getItem(k) || 'null') as T) ?? fb; } catch { return fb; }
};
const day = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export function watchStats(): WatchStats {
  const watched = store.getWatched(); // "movie:603" / "tv:1399:1:2" -> when ticked
  const keys = Object.keys(watched);
  const movies = keys.filter((k) => k.startsWith('movie:')).length;
  const episodes = keys.filter((k) => k.startsWith('tv:')).length;
  const animeSeen = read<Record<string, number[]>>('comvie.anime.seen', {});
  const animeEpisodes = Object.values(animeSeen).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
  const mangaSeen = read<Record<string, string[]>>('comvie.manga.seen', {});
  const chapters = Object.values(mangaSeen).reduce((n, a) => n + (Array.isArray(a) ? a.length : 0), 0);
  // rough running times: a film ~2h, a TV episode ~45 min, an anime episode ~24 min
  const hours = Math.round((movies * 115 + episodes * 45 + animeEpisodes * 24) / 60);

  const history = store.getHistory();
  const animeHist = animeStore.history();
  const mangaHist = mangaStore.history();
  const times = [...Object.values(watched), ...history.map((h) => h.watchedAt), ...animeHist.map((a) => a.at), ...mangaHist.map((m) => m.at)].filter(
    (t) => typeof t === 'number' && t > 0
  );
  const days = new Set(times.map(day));
  let streak = 0;
  const cur = new Date();
  // a streak still counts if today hasn't had anything yet
  if (!days.has(day(cur.getTime()))) cur.setDate(cur.getDate() - 1);
  while (days.has(day(cur.getTime()))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  // longest run ever (never goes down, so unlocks stay unlocked)
  const sorted = [...days].map((k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m, d).getTime(); }).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && Math.round((sorted[i] - sorted[i - 1]) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  let saved = 0;
  try { saved = Number(localStorage.getItem('comvie.beststreak') || 0); } catch { /* ignore */ }
  const bestStreak = Math.max(best, streak, saved);
  if (bestStreak > saved) { try { localStorage.setItem('comvie.beststreak', String(bestStreak)); } catch { /* ignore */ } }
  const nightWatches = times.filter((t) => new Date(t).getHours() < 4).length;
  const now = new Date();
  const monthDays = new Set(times.filter((t) => { const d = new Date(t); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); }).map(day));
  const titles = new Set([
    ...history.map((h) => `${h.media.type}:${h.media.id}`),
    ...keys.map((k) => k.split(':').slice(0, 2).join(':')),
    ...animeHist.map((a) => `a:${a.id}`),
    ...Object.keys(animeSeen).filter((id) => (animeSeen[id] ?? []).length).map((id) => `a:${id}`)
  ]).size;
  return { movies, episodes, animeEpisodes, chapters, hours, streak, activeThisMonth: monthDays.size, titles, bestStreak, nightWatches };
}
