/** "Airing this week": anime episodes from AniList's airing schedule, TV episodes from TMDB. */
import { gql } from './anilist';
import { animeStore } from './animeStore';
import { store } from './storage';
import { tmdb } from './tmdb';
import type { Media } from './types';

export interface Airing {
  /** unique per episode */
  key: string;
  at: number; // ms; for TV only the day is known (set to local noon)
  timeKnown: boolean;
  title: string;
  image: string | null;
  label: string; // "Episode 5" / "S2 · E5"
  name: string; // episode name, when known
  to: string; // in-app link
  mine: boolean; // in the viewer's list or history
  aired: boolean;
}

const DAY = 86400000;
export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Anime airing from the start of today for 7 days (no adult titles). */
export async function animeWeek(): Promise<Airing[]> {
  const from = Math.floor(startOfDay(Date.now()) / 1000);
  const to = from + 7 * 86400;
  const mine = new Set([...animeStore.list(), ...animeStore.history()].map((x: any) => Number(x.id ?? x.anime?.id)));
  const out: Airing[] = [];
  for (let page = 1; page <= 8; page++) {
    const d = await gql(
      `query($from:Int,$to:Int,$page:Int){ Page(page:$page, perPage:50){ pageInfo{ hasNextPage }
        airingSchedules(airingAt_greater:$from, airingAt_lesser:$to, sort:TIME){ episode airingAt
          media{ id title{ romaji english } coverImage{ large } isAdult } } } }`,
      { from, to, page }
    );
    for (const s of (d?.Page?.airingSchedules ?? []) as any[]) {
      const m = s.media;
      if (!m || m.isAdult) continue;
      const at = s.airingAt * 1000;
      out.push({
        key: `a${m.id}:${s.episode}`,
        at,
        timeKnown: true,
        title: m.title?.english || m.title?.romaji || 'Untitled',
        image: m.coverImage?.large ?? null,
        label: `Episode ${s.episode}`,
        name: '',
        to: at <= Date.now() ? `/anime/watch/${m.id}?e=${s.episode}` : `/anime/title/${m.id}`,
        mine: mine.has(m.id),
        aired: at <= Date.now()
      });
    }
    if (!d?.Page?.pageInfo?.hasNextPage) break;
  }
  return out;
}

/** TV episodes airing in the next 7 days (and earlier today): shows from the watchlist and history, plus what's on air now. */
export async function tvWeek(): Promise<Airing[]> {
  const from = startOfDay(Date.now());
  const to = from + 7 * DAY;
  const mineShows = [...store.getFavorites(), ...store.getHistory().map((h) => h.media)].filter((m: Media) => m.type === 'tv');
  const mine = new Set(mineShows.map((m) => m.id));
  const onAir = await tmdb.feed('on-air').then((r) => r.items).catch(() => [] as Media[]);
  const ids = [...new Set([...mineShows.map((m) => m.id), ...onAir.map((m) => m.id)])].slice(0, 40);
  const shows = await Promise.all(ids.map((id) => tmdb.episodesAround(id).catch(() => null)));
  const out: Airing[] = [];
  for (const s of shows) {
    if (!s) continue;
    for (const e of s.eps) {
      const [y, mo, da] = e.date.split('-').map(Number);
      const at = new Date(y, mo - 1, da, 12).getTime();
      if (at < from || at >= to) continue;
      out.push({
        key: `t${s.media.id}:${e.season}:${e.episode}`,
        at,
        timeKnown: false,
        title: s.media.title,
        image: s.media.poster ? `https://image.tmdb.org/t/p/w185${s.media.poster}` : null,
        label: `S${e.season} · E${e.episode}`,
        name: e.name && !/^Episode \d+$/.test(e.name) ? e.name : '',
        to: startOfDay(at) <= startOfDay(Date.now()) ? `/watch/tv/${s.media.id}?s=${e.season}&e=${e.episode}` : `/title/tv/${s.media.id}`,
        mine: mine.has(s.media.id),
        aired: startOfDay(at) < startOfDay(Date.now())
      });
    }
  }
  return out.sort((a, b) => a.at - b.at || a.title.localeCompare(b.title));
}
