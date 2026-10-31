import type { IconName } from '../components/Icon';
import { aniList } from './anilist';
import type { AniQuery } from './anilist';
import { mangaList } from './manga';
import type { MangaQuery } from './manga';
import type { Section } from './section';
import { tmdb } from './tmdb';

/** Discovery: browse by mood, film series ("collections") and "Surprise me". */

export interface Mood {
  id: string;
  label: string;
  blurb: string;
  icon: IconName;
  hue: number;
}

export interface CinemaMood extends Mood { path: string }
export interface AniMood extends Mood { q: AniQuery }
export interface MangaMood extends Mood { q: MangaQuery }

// TMDB genre ids: 28 Action, 12 Adventure, 16 Animation, 35 Comedy, 80 Crime, 99 Documentary, 18 Drama, 10751 Family,
// 14 Fantasy, 27 Horror, 9648 Mystery, 10749 Romance, 878 Sci-Fi, 53 Thriller (a comma means "all of these")
const D = (q: string) => `/discover/movie?${q}&sort_by=popularity.desc&vote_count.gte=300`;
export const CINEMA_MOODS: CinemaMood[] = [
  { id: 'feel-good', label: 'Feel-good', blurb: 'Light, funny and warm', icon: 'smile', hue: 45, path: D('with_genres=35,10751') },
  { id: 'date-night', label: 'Date night', blurb: 'Romance with a smile', icon: 'heart', hue: 340, path: D('with_genres=10749,35') },
  { id: 'mind-bending', label: 'Mind-bending', blurb: 'Twisty sci-fi and mysteries', icon: 'sparkles', hue: 265, path: D('with_genres=878,9648') },
  { id: 'edge-of-your-seat', label: 'Edge of your seat', blurb: 'Tense thrillers', icon: 'zap', hue: 200, path: D('with_genres=53,80') },
  { id: 'late-night-horror', label: 'Late-night horror', blurb: 'Lights off', icon: 'moon', hue: 0, path: D('with_genres=27') },
  { id: 'tearjerker', label: 'Tearjerker', blurb: 'Bring tissues', icon: 'mask', hue: 220, path: `/discover/movie?with_genres=18,10749&sort_by=vote_average.desc&vote_count.gte=1500` },
  { id: 'adrenaline', label: 'Adrenaline', blurb: 'Big action, big set pieces', icon: 'flame', hue: 20, path: D('with_genres=28,12') },
  { id: 'family-night', label: 'Family night', blurb: 'For every age', icon: 'users', hue: 150, path: D('with_genres=10751,16') },
  { id: 'epic-worlds', label: 'Epic worlds', blurb: 'Fantasy adventures', icon: 'compass', hue: 110, path: D('with_genres=14,12') },
  { id: 'true-stories', label: 'True stories', blurb: 'Documentaries worth it', icon: 'video', hue: 180, path: `/discover/movie?with_genres=99&sort_by=vote_average.desc&vote_count.gte=300` }
];

export const ANIME_MOODS: AniMood[] = [
  { id: 'cozy', label: 'Cozy & calm', blurb: 'Iyashikei comfort shows', icon: 'coffee', hue: 40, q: { tag: 'Iyashikei', sort: 'POPULARITY_DESC' } },
  { id: 'hype', label: 'Hype', blurb: 'Big fights, big moments', icon: 'flame', hue: 15, q: { genre: 'Action', tag: 'Shounen', sort: 'POPULARITY_DESC' } },
  { id: 'tearjerker', label: 'Tearjerker', blurb: 'It will hurt (nicely)', icon: 'mask', hue: 220, q: { genre: 'Drama', tag: 'Tragedy', sort: 'SCORE_DESC' } },
  { id: 'mind-bending', label: 'Mind-bending', blurb: 'Psychological puzzles', icon: 'brain', hue: 265, q: { genre: 'Psychological', sort: 'POPULARITY_DESC' } },
  { id: 'spooky', label: 'Spooky', blurb: 'Horror and dread', icon: 'ghost', hue: 0, q: { genre: 'Horror', sort: 'POPULARITY_DESC' } },
  { id: 'romance', label: 'Butterflies', blurb: 'Romance and rom-coms', icon: 'heart', hue: 340, q: { genre: 'Romance', sort: 'POPULARITY_DESC' } },
  { id: 'isekai', label: 'Another world', blurb: 'Isekai adventures', icon: 'wand', hue: 110, q: { tag: 'Isekai', sort: 'POPULARITY_DESC' } },
  { id: 'laugh', label: 'Just laugh', blurb: 'Pure comedy', icon: 'smile', hue: 50, q: { genre: 'Comedy', sort: 'POPULARITY_DESC' } },
  { id: 'time', label: 'Time twists', blurb: 'Loops and time travel', icon: 'clock', hue: 200, q: { tag: 'Time Manipulation', sort: 'POPULARITY_DESC' } },
  { id: 'sports', label: 'Underdog sports', blurb: 'Train, lose, win', icon: 'trophy', hue: 150, q: { genre: 'Sports', sort: 'POPULARITY_DESC' } }
];

export const MANGA_MOODS: MangaMood[] = [
  { id: 'cozy', label: 'Cozy & calm', blurb: 'Gentle slice of life', icon: 'coffee', hue: 40, q: { tag: 'Iyashikei', sort: 'POPULARITY_DESC' } },
  { id: 'hype', label: 'Hype', blurb: 'Big fights, big moments', icon: 'flame', hue: 15, q: { genre: 'Action', sort: 'POPULARITY_DESC' } },
  { id: 'leveling', label: 'Level up', blurb: 'Hunters, systems and dungeons', icon: 'zap', hue: 260, q: { tag: 'Video Games', country: 'KR', sort: 'POPULARITY_DESC' } },
  { id: 'revenge', label: 'Revenge', blurb: 'Payback stories', icon: 'swords', hue: 0, q: { tag: 'Revenge', sort: 'POPULARITY_DESC' } },
  { id: 'tearjerker', label: 'Tearjerker', blurb: 'It will hurt (nicely)', icon: 'mask', hue: 220, q: { genre: 'Drama', tag: 'Tragedy', sort: 'SCORE_DESC' } },
  { id: 'romance', label: 'Butterflies', blurb: 'Romance and rom-coms', icon: 'heart', hue: 340, q: { genre: 'Romance', sort: 'POPULARITY_DESC' } },
  { id: 'isekai', label: 'Another world', blurb: 'Isekai and reincarnation', icon: 'wand', hue: 110, q: { tag: 'Isekai', sort: 'POPULARITY_DESC' } },
  { id: 'horror', label: 'Horror', blurb: 'Read with the lights on', icon: 'ghost', hue: 300, q: { genre: 'Horror', sort: 'POPULARITY_DESC' } },
  { id: 'mind-bending', label: 'Mind-bending', blurb: 'Psychological puzzles', icon: 'brain', hue: 265, q: { genre: 'Psychological', sort: 'POPULARITY_DESC' } },
  { id: 'laugh', label: 'Just laugh', blurb: 'Pure comedy', icon: 'smile', hue: 50, q: { genre: 'Comedy', sort: 'POPULARITY_DESC' } }
];

/** Well-known film series on TMDB (their names, posters and films come from TMDB itself). */
export const COLLECTION_IDS = [
  10, 119, 1241, 263, 86311, 131635, 295, 645, 9485, 2344, 264, 84, 87359, 404609, 328, 8091, 528, 8945, 230, 1575,
  10194, 2150, 86066, 8354, 77816, 89137, 33514, 8650
];

const pick = <T,>(a: T[]): T | null => (a.length ? a[Math.floor(Math.random() * a.length)] : null);
const rand = (n: number) => 1 + Math.floor(Math.random() * n);

/** "Surprise me": a random well-liked title for the section you're in. Returns its in-app address. */
export async function surprise(section: Section): Promise<string | null> {
  if (section === 'anime') {
    const r = await aniList({ sort: 'POPULARITY_DESC', page: rand(40), perPage: 25 });
    const a = pick(r.items);
    return a ? `/anime/title/${a.id}` : null;
  }
  if (section === 'manga') {
    const r = await mangaList({ sort: 'POPULARITY_DESC', page: rand(40), perPage: 25 });
    const m = pick(r.items);
    return m ? `/manga/title/${m.id}` : null;
  }
  const type = Math.random() < 0.6 ? 'movie' : 'tv';
  const r = await tmdb.list(`/discover/${type}?sort_by=popularity.desc&vote_count.gte=${type === 'movie' ? 800 : 300}&vote_average.gte=6.5`, type, rand(15));
  const m = pick(r.items.filter((x) => x.poster));
  return m ? `/title/${m.type}/${m.id}` : null;
}
