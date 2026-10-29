import type { Media, Session, WatchEntry } from './types';

export interface Reminder {
  media: Media;
  /** Release date (YYYY-MM-DD) */
  date: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the site still works for this visit */
  }
}

export const MAX_HISTORY = 30;

export interface Progress {
  t: number;
  d: number;
  at: number;
}

export const store = {
  getFavorites: () => read<Media[]>('comvie.favorites', []),
  saveFavorites: (v: Media[]) => write('comvie.favorites', v),
  getLoved: () => read<Media[]>('comvie.loved', []),
  saveLoved: (v: Media[]) => write('comvie.loved', v),
  getRecentSearches: () => read<string[]>('comvie.recentsearch', []),
  saveRecentSearches: (v: string[]) => write('comvie.recentsearch', v),
  getHistory: () => read<WatchEntry[]>('comvie.history', []),
  saveHistory: (v: WatchEntry[]) => write('comvie.history', v),
  getProgress: () => read<Record<string, Progress>>('comvie.progress', {}),
  saveProgress: (v: Record<string, Progress>) => write('comvie.progress', v),
  getDiscordHide: () => read<boolean>('comvie.discordhide', false),
  saveDiscordHide: (v: boolean) => write('comvie.discordhide', v ? true : null),
  getWatched: () => read<Record<string, number>>('comvie.watched', {}),
  saveWatched: (v: Record<string, number>) => write('comvie.watched', v),
  getReminders: () => read<Reminder[]>('comvie.reminders', []),
  saveReminders: (v: Reminder[]) => write('comvie.reminders', v),
  getAutoplay: () => read<boolean>('comvie.autoplay', true),
  saveAutoplay: (v: boolean) => write('comvie.autoplay', v),
  getAutoskip: () => read<boolean>('comvie.autoskip', false),
  saveAutoskip: (v: boolean) => write('comvie.autoskip', v),
  getProvider: () => read<string>('comvie.provider', 'cinesrc'),
  saveProvider: (v: string) => write('comvie.provider', v),
  getProtect: () => read<boolean>('comvie.protect', true),
  saveProtect: (v: boolean) => write('comvie.protect', v),
  getTvFavs: () => read<string[]>('comvie.tvfavs', []),
  saveTvFavs: (v: string[]) => write('comvie.tvfavs', v),
  getTvRecent: () => read<string[]>('comvie.tvrecent', []),
  saveTvRecent: (v: string[]) => write('comvie.tvrecent', v),
  getTvLast: () => read<string>('comvie.tvlast', ''),
  saveTvLast: (v: string) => write('comvie.tvlast', v),
  getTvBad: () => read<Record<string, number>>('comvie.tvbad', {}),
  saveTvBad: (v: Record<string, number>) => write('comvie.tvbad', v),
  getSession: () => read<Session | null>('comvie.session', null),
  saveSession: (v: Session | null) => write('comvie.session', v)
};
