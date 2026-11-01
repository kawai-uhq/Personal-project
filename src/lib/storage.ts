import type { Media, Session, WatchEntry } from './types';
import { isSharedKey, sharedGet, sharedSet } from './shared';

export interface Reminder {
  media: Media;
  /** Release date (YYYY-MM-DD) */
  date: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const shared = isSharedKey(key) ? sharedGet(key) : undefined;
    const raw = shared !== undefined ? shared : localStorage.getItem(key);
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
  if (isSharedKey(key)) sharedSet(key, value === null ? null : JSON.stringify(value));
}

export const MAX_HISTORY = 30;

export interface Progress {
  t: number;
  d: number;
  at: number;
}

// ---- one sign-in for cinema., anime. and manga.comvie.lol ----
// Browser storage is separate per sub-domain, but a cookie set on ".comvie.lol" is visible to all of them,
// so the sign-in lives there. Signing out leaves an "out" marker so the other sub-domains sign out too.
const COOKIE = 'cv_session';
const SHARED_DAYS = 60;
const sharedHost = () => typeof location !== 'undefined' && /(^|\.)comvie\.lol$/.test(location.hostname);

function readShared(): Session | 'out' | null {
  try {
    const m = document.cookie.match(/(?:^|; )cv_session=([^;]*)/);
    if (!m) return null;
    const v = decodeURIComponent(m[1]);
    if (v === 'out') return 'out';
    const s = JSON.parse(v) as Session;
    return s?.refreshToken && s?.email ? s : null;
  } catch {
    return null;
  }
}

function writeShared(s: Session | null) {
  try {
    const base = `; Domain=.comvie.lol; Path=/; Secure; SameSite=Lax; Max-Age=${SHARED_DAYS * 86400}`;
    document.cookie = `${COOKIE}=${s ? encodeURIComponent(JSON.stringify(s)) : 'out'}${base}`;
  } catch {
    /* cookies blocked: sign-in stays on this sub-domain only */
  }
}

export const store = {
  getFavorites: () => read<Media[]>('comvie.favorites', []),
  saveFavorites: (v: Media[]) => write('comvie.favorites', v),
  getLoved: () => read<Media[]>('comvie.loved', []),
  saveLoved: (v: Media[]) => write('comvie.loved', v),
  getRecentSearches: () => read<string[]>('comvie.recentsearch', []),
  saveRecentSearches: (v: string[]) => write('comvie.recentsearch', v),
  /** "Remember what I watch": off = nothing new is added to history / Continue Watching */
  /** Switch to the next server on its own when one doesn't load */
  getAutoSwitch: () => read<boolean>('comvie.autoswitch', true),
  saveAutoSwitch: (v: boolean) => write('comvie.autoswitch', v),
  /** Seconds before the next episode starts */
  getNextDelay: () => read<number>('comvie.nextdelay', 10),
  saveNextDelay: (v: number) => write('comvie.nextdelay', v),
  /** The server that last worked for each title ("movie:603", "anime:16498") */
  getGoodServer: (key: string) => read<Record<string, string>>('comvie.goodserver', {})[key] ?? null,
  saveGoodServer: (key: string, server: string) => {
    const all = read<Record<string, string>>('comvie.goodserver', {});
    if (all[key] === server) return;
    all[key] = server;
    const keys = Object.keys(all);
    if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete all[k]);
    write('comvie.goodserver', all);
  },
  /** Servers hidden from the player's server list (and skipped by auto-switch), per section ("movie", "anime") */
  getHiddenServers: (section: string) => read<Record<string, string[]>>('comvie.serverhide', {})[section] ?? [],
  saveHiddenServers: (section: string, ids: string[]) => {
    const all = read<Record<string, string[]>>('comvie.serverhide', {});
    all[section] = ids;
    write('comvie.serverhide', all);
  },
  /** Servers that have played something on this device (the green dots), per section */
  getWorkedServers: (section: string) => read<Record<string, string[]>>('comvie.serverok', {})[section] ?? [],
  saveWorkedServer: (section: string, id: string) => {
    const all = read<Record<string, string[]>>('comvie.serverok', {});
    const cur = all[section] ?? [];
    if (cur.includes(id)) return;
    all[section] = [...cur, id];
    write('comvie.serverok', all);
  },
  getRemember: () => read<boolean>('comvie.remember', true),
  saveRemember: (v: boolean) => write('comvie.remember', v),
  getHistory: () => read<WatchEntry[]>('comvie.history', []),
  saveHistory: (v: WatchEntry[]) => write('comvie.history', v),
  getProgress: () => read<Record<string, Progress>>('comvie.progress', {}),
  saveProgress: (v: Record<string, Progress>) => write('comvie.progress', v),
  getPromoHide: () => read<boolean>('comvie.promohide', false),
  savePromoHide: (v: boolean) => write('comvie.promohide', v ? true : null),
  getDiscordHide: () => read<boolean>('comvie.discordhide', false),
  saveDiscordHide: (v: boolean) => write('comvie.discordhide', v ? true : null),
  getWatched: () => read<Record<string, number>>('comvie.watched', {}),
  saveWatched: (v: Record<string, number>) => write('comvie.watched', v),
  getReminders: () => read<Reminder[]>('comvie.reminders', []),
  saveReminders: (v: Reminder[]) => write('comvie.reminders', v),
  getAutoplay: () => read<boolean>('comvie.autoplay2', false),
  saveAutoplay: (v: boolean) => write('comvie.autoplay2', v),
  getAutoskip: () => read<boolean>('comvie.autoskip2', false),
  saveAutoskip: (v: boolean) => write('comvie.autoskip2', v),
  getProvider: () => read<string>('comvie.provider', 'cinesrc'),
  saveProvider: (v: string) => write('comvie.provider', v),
  getProtect: () => read<boolean>('comvie.protect2', true),
  saveProtect: (v: boolean) => write('comvie.protect2', v),
  getTvFavs: () => read<string[]>('comvie.tvfavs', []),
  saveTvFavs: (v: string[]) => write('comvie.tvfavs', v),
  getTvRecent: () => read<string[]>('comvie.tvrecent', []),
  saveTvRecent: (v: string[]) => write('comvie.tvrecent', v),
  getTvLast: () => read<string>('comvie.tvlast', ''),
  saveTvLast: (v: string) => write('comvie.tvlast', v),
  getTvBad: () => read<Record<string, number>>('comvie.tvbad', {}),
  saveTvBad: (v: Record<string, number>) => write('comvie.tvbad', v),
  getSession: (): Session | null => {
    if (!sharedHost()) return read<Session | null>('comvie.session', null);
    const c = readShared();
    if (c === 'out') {
      write('comvie.session', null); // signed out on another part of the site
      return null;
    }
    if (c) return c;
    // no shared sign-in yet: share this browser's earlier sign-in (from before sign-in was shared)
    const local = read<Session | null>('comvie.session', null);
    if (local) writeShared(local);
    return local;
  },
  saveSession: (v: Session | null) => {
    write('comvie.session', v);
    if (sharedHost()) writeShared(v);
  }
};
