import type { MediaType } from './types';

/** Genres offered in the anime section. TMDB uses different ids for movies and TV; null = not available there. */
export interface AGenre { slug: string; name: string; movie: number | null; tv: number | null; hue: number; icon: string }

export const A_GENRES: AGenre[] = [
  { slug: 'action', name: 'Action', movie: 28, tv: 10759, hue: 8, icon: 'zap' },
  { slug: 'adventure', name: 'Adventure', movie: 12, tv: 10759, hue: 28, icon: 'compass' },
  { slug: 'comedy', name: 'Comedy', movie: 35, tv: 35, hue: 48, icon: 'smile' },
  { slug: 'drama', name: 'Drama', movie: 18, tv: 18, hue: 320, icon: 'ticket' },
  { slug: 'fantasy', name: 'Fantasy', movie: 14, tv: 10765, hue: 265, icon: 'moon' },
  { slug: 'scifi', name: 'Sci-Fi', movie: 878, tv: 10765, hue: 190, icon: 'rocket' },
  { slug: 'mystery', name: 'Mystery', movie: 9648, tv: 9648, hue: 240, icon: 'search' },
  { slug: 'crime', name: 'Crime', movie: 80, tv: 80, hue: 350, icon: 'shield' },
  { slug: 'family', name: 'Family', movie: 10751, tv: 10751, hue: 140, icon: 'users' },
  { slug: 'romance', name: 'Romance', movie: 10749, tv: null, hue: 335, icon: 'heart' },
  { slug: 'horror', name: 'Horror', movie: 27, tv: null, hue: 0, icon: 'ghost' },
  { slug: 'thriller', name: 'Thriller', movie: 53, tv: null, hue: 15, icon: 'flame' }
];

export type ASort = 'pop' | 'rated' | 'new' | 'votes';
const today = () => new Date().toISOString().slice(0, 10);

/** Discover path for anime of one kind, or null when the genre doesn't exist for that kind. */
export function animePath(kind: MediaType, o: { genre?: AGenre; sort: ASort; year: string }): string | null {
  const gid = o.genre ? o.genre[kind] : undefined;
  if (o.genre && gid == null) return null;
  const dk = kind === 'movie' ? 'primary_release_date' : 'first_air_date';
  const q = [`with_original_language=ja`, `with_genres=${gid ? `16,${gid}` : '16'}`];
  q.push(
    `sort_by=${o.sort === 'rated' ? 'vote_average.desc' : o.sort === 'new' ? `${dk}.desc` : o.sort === 'votes' ? 'vote_count.desc' : 'popularity.desc'}`
  );
  if (o.sort === 'rated') q.push(`vote_count.gte=${kind === 'movie' ? 200 : 150}`);
  if (o.sort === 'new') q.push(`vote_count.gte=3`, `${dk}.lte=${today()}`);
  if (o.year) q.push(`${dk}.gte=${o.year}-01-01`, `${dk}.lte=${o.year}-12-31`);
  return `/discover/${kind}?${q.join('&')}`;
}
