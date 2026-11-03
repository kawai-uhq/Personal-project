/** Badges shown next to a name, earned automatically from what someone has watched and read. */
import type { IconName } from '../components/Icon';
import type { WatchStats } from './stats';

export interface Badge {
  id: string;
  name: string;
  how: string; // how it's earned
  icon: IconName;
  color: string;
}

export const BADGES: Badge[] = [
  { id: 'early', name: 'Early Member', how: 'Joined Comvie in 2026', icon: 'rocket', color: '#ff9a2e' },
  { id: 'discord', name: 'Discord Member', how: 'Connected Discord', icon: 'message', color: '#5865F2' },
  { id: 'anime', name: 'Anime Fan', how: 'Watched 100 anime episodes', icon: 'sparkles', color: '#ff8fb8' },
  { id: 'cinephile', name: 'Cinephile', how: 'Watched 50 movies', icon: 'film', color: '#f5c542' },
  { id: 'binge', name: 'Binge Watcher', how: 'Watched 100 hours', icon: 'tv', color: '#3dde97' },
  { id: 'streak', name: 'On Fire', how: 'Reached a 7 day streak', icon: 'flame', color: '#ff6b57' },
  { id: 'bookworm', name: 'Bookworm', how: 'Read 100 manga chapters', icon: 'book', color: '#8f86ff' },
  { id: 'owl', name: 'Night Owl', how: 'Watched 10 things after midnight', icon: 'moon', color: '#7FB0FF' }
];

/** Which badges someone has earned */
export function earnedBadges(s: Partial<WatchStats> | null | undefined, extra: { joined?: string; discord?: boolean }): string[] {
  const out: string[] = [];
  if (extra.joined && new Date(extra.joined).getFullYear() <= 2026) out.push('early');
  if (extra.discord) out.push('discord');
  if ((s?.animeEpisodes ?? 0) >= 100) out.push('anime');
  if ((s?.movies ?? 0) >= 50) out.push('cinephile');
  if ((s?.hours ?? 0) >= 100) out.push('binge');
  if ((s?.bestStreak ?? 0) >= 7) out.push('streak');
  if ((s?.chapters ?? 0) >= 100) out.push('bookworm');
  if ((s?.nightWatches ?? 0) >= 10) out.push('owl');
  return out;
}
