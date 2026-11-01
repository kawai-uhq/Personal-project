/** Collections: hand-picked studios, directors and film series, plus the rest of the TMDB film series.
 *  Addressed as /collection/<slug> (picks) or /collection/<TMDB collection id> (series). */
import { COLLECTION_IDS } from './discover';
import { tmdb } from './tmdb';
import type { Media } from './types';

type Source = { collection: number } | { company: number } | { director: number };

interface Pick {
  slug: string;
  name: string;
  tagline: string;
  src: Source;
}

export const PICKS: Pick[] = [
  { slug: 'studio-ghibli', name: 'Studio Ghibli', tagline: 'Hand-drawn worlds full of wonder', src: { company: 10342 } },
  { slug: 'christopher-nolan', name: 'Christopher Nolan', tagline: 'Mind-bending blockbusters', src: { director: 525 } },
  { slug: 'spider-verse', name: 'The Spider-Verse', tagline: 'Every universe has a Spider-Man', src: { collection: 573436 } },
  { slug: 'marvel-studios', name: 'Marvel Studios', tagline: 'The heroes of the MCU', src: { company: 420 } },
  { slug: 'harry-potter', name: 'Harry Potter', tagline: 'Magic begins at Hogwarts', src: { collection: 1241 } },
  { slug: 'pixar', name: 'Pixar', tagline: 'Stories for every age', src: { company: 3 } },
  { slug: 'star-wars', name: 'Star Wars', tagline: 'A galaxy far, far away', src: { collection: 10 } },
  { slug: 'denis-villeneuve', name: 'Denis Villeneuve', tagline: 'Vast worlds, quiet tension', src: { director: 137427 } },
  { slug: 'a24', name: 'A24', tagline: 'Bold, strange and unforgettable', src: { company: 41077 } },
  { slug: 'lord-of-the-rings', name: 'The Lord of the Rings', tagline: 'The long road to Mordor', src: { collection: 119 } },
  { slug: 'hayao-miyazaki', name: 'Hayao Miyazaki', tagline: 'The master of hand-drawn wonder', src: { director: 608 } },
  { slug: 'john-wick', name: 'John Wick', tagline: 'Never touch his dog', src: { collection: 404609 } }
];

// short lines for the other film series (TMDB collection id → tagline)
const SERIES_TAGLINES: Record<number, string> = {
  263: 'Gotham needs a hero',
  86311: "Earth's mightiest, assembled",
  131635: 'Survive the arena',
  295: 'Adventure on the high seas',
  645: 'Licensed to thrill',
  9485: 'Family, cars and pure speed',
  2344: "Question what's real",
  264: 'Time travel in a DeLorean',
  84: 'Whips, hats and lost relics',
  87359: "Stunts that shouldn't be possible",
  328: 'Dinosaurs, back from extinction',
  8091: 'Terror in deep space',
  528: 'Machines from the future',
  8945: 'Fury on the wasteland roads',
  230: 'Family, loyalty and power',
  1575: 'The heart of a fighter',
  10194: 'Toys with big feelings',
  2150: 'Ogres have layers',
  86066: 'Villains, Minions and mayhem',
  8354: 'A prehistoric family adventure',
  77816: 'Kung fu with a big heart',
  89137: 'A boy and his dragon',
  33514: 'Vampires, wolves and first love',
  8650: 'Giant robots, epic battles'
};

const pickedSeries = new Set(PICKS.flatMap((p) => ('collection' in p.src ? [p.src.collection] : [])));

/** Every collection, picks first, as the keys used in addresses */
export const COLLECTION_KEYS: string[] = [...PICKS.map((p) => p.slug), ...COLLECTION_IDS.filter((id) => !pickedSeries.has(id)).map(String)];

export interface Coll {
  key: string;
  name: string;
  tagline: string;
  overview: string;
  backdrop: string | null;
  /** every film, in release order */
  items: Media[];
  /** the best-known posters, for the card's poster fan */
  fan: Media[];
  kind: 'series' | 'studio' | 'director';
}

const byRelease = (a: Media, b: Media) => (a.year || '9999').localeCompare(b.year || '9999');
const byVotes = (a: Media, b: Media) => (b.votes ?? 0) - (a.votes ?? 0);
const years = (items: Media[]) => {
  const ys = items.map((m) => m.year).filter(Boolean).sort();
  return ys.length ? (ys[0] === ys[ys.length - 1] ? ys[0] : `${ys[0]}–${ys[ys.length - 1]}`) : '';
};

const cache = new Map<string, Promise<Coll | null>>();

/** One collection by its key; null when it can't be loaded or has too few films. */
export function loadCollection(key: string): Promise<Coll | null> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async (): Promise<Coll | null> => {
    const pick = PICKS.find((x) => x.slug === key);
    const seriesId = pick ? ('collection' in pick.src ? pick.src.collection : null) : Number(key);
    let name = pick?.name ?? '';
    let overview = '';
    let backdrop: string | null = null;
    let all: Media[] = [];
    let kind: Coll['kind'] = 'series';
    if (seriesId) {
      if (!Number.isFinite(seriesId) || seriesId <= 0) return null;
      const c = await tmdb.collection(seriesId);
      name = name || c.name.replace(/ Collection$/, '');
      overview = c.overview;
      backdrop = c.backdrop;
      all = c.items;
    } else if (pick && 'company' in pick.src) {
      kind = 'studio';
      all = await tmdb.companyFilms(pick.src.company);
    } else if (pick && 'director' in pick.src) {
      kind = 'director';
      all = await tmdb.directorFilms(pick.src.director);
    }
    const withPoster = all.filter((m) => m.poster);
    if (!name || withPoster.length < 2) return null;
    const fan = [...withPoster].sort(byVotes).slice(0, 5);
    const items = [...withPoster].sort(byRelease);
    const tagline = pick?.tagline ?? SERIES_TAGLINES[seriesId as number] ?? `${items.length} films · ${years(items)}`;
    return { key, name, tagline, overview, backdrop: backdrop ?? fan.find((m) => m.backdrop)?.backdrop ?? null, items, fan, kind };
  })().catch(() => null);
  cache.set(key, p);
  return p;
}

export const collectionLink = (key: string) => `/collection/${key}`;
