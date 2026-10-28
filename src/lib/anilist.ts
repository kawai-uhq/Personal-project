import type { Media } from './types';

/** AniList (anilist.co) GraphQL client: the data source for the anime section. */

export interface AniLite {
  id: number;
  title: string;
  cover: string;
  score: number; // 0-100
  format: string | null;
  year: number | null;
  episodes: number | null;
}

export interface Ani extends AniLite {
  mal: number | null;
  alt: string;
  color: string | null;
  banner: string | null;
  desc: string;
  status: string | null;
  duration: number | null;
  genres: string[];
  next: { episode: number; at: number } | null;
}

export interface AniFull extends Ani {
  studio: string;
  links: { site: string; url: string; color: string | null }[];
  related: { relation: string; item: Ani }[];
  recs: Ani[];
}

const URL = 'https://graphql.anilist.co';
const cache = new Map<string, Promise<any>>();

async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = query + JSON.stringify(variables);
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    let r: Response;
    try {
      r = await fetch(URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables })
      });
    } catch {
      throw new Error("Can't reach AniList. Check your internet connection.");
    }
    if (r.status === 429) throw new Error('AniList is busy right now. Wait a minute and try again.');
    let j: any = null;
    try {
      j = await r.json();
    } catch {
      /* not json */
    }
    if (!r.ok || j?.errors) throw new Error(j?.errors?.[0]?.message || `AniList error (${r.status}).`);
    return j.data as T;
  })();
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  return p;
}

const MEDIA = `id idMal title { romaji english } coverImage { extraLarge large color } bannerImage description(asHtml: false)
  averageScore format status episodes duration seasonYear startDate { year } genres nextAiringEpisode { episode airingAt }`;

const clean = (s: string | null | undefined) =>
  (s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();

export function mapAni(o: any): Ani {
  return {
    id: o.id,
    mal: o.idMal ?? null,
    title: o.title?.english || o.title?.romaji || 'Untitled',
    alt: o.title?.english && o.title?.romaji && o.title.english !== o.title.romaji ? o.title.romaji : '',
    cover: o.coverImage?.extraLarge || o.coverImage?.large || '',
    color: o.coverImage?.color ?? null,
    banner: o.bannerImage ?? null,
    desc: clean(o.description),
    score: o.averageScore ?? 0,
    format: o.format ?? null,
    status: o.status ?? null,
    episodes: o.episodes ?? null,
    duration: o.duration ?? null,
    year: o.seasonYear ?? o.startDate?.year ?? null,
    genres: o.genres ?? [],
    next: o.nextAiringEpisode ? { episode: o.nextAiringEpisode.episode, at: o.nextAiringEpisode.airingAt } : null
  };
}

export const lite = (a: Ani | AniLite): AniLite => ({
  id: a.id, title: a.title, cover: a.cover, score: a.score, format: a.format, year: a.year, episodes: a.episodes
});

export interface AniQuery {
  sort?: string; // e.g. TRENDING_DESC
  search?: string;
  genre?: string;
  season?: string;
  seasonYear?: number;
  format?: string;
  status?: string;
  popularityGreater?: number;
  page?: number;
  perPage?: number;
}

/** A page of anime. Adult titles are always left out. */
export async function aniList(q: AniQuery): Promise<{ items: Ani[]; more: boolean }> {
  const query = `query($page:Int,$perPage:Int,$sort:[MediaSort],$search:String,$genre:String,$season:MediaSeason,$seasonYear:Int,$format:MediaFormat,$status:MediaStatus,$pg:Int){
    Page(page:$page, perPage:$perPage){ pageInfo{ hasNextPage }
      media(type:ANIME, isAdult:false, sort:$sort, search:$search, genre:$genre, season:$season, seasonYear:$seasonYear, format:$format, status:$status, popularity_greater:$pg){ ${MEDIA} } } }`;
  const { sort, popularityGreater, ...rest } = q;
  const vars: Record<string, unknown> = { page: 1, perPage: 24, ...rest, pg: popularityGreater };
  if (sort && !q.search) vars.sort = [sort];
  Object.keys(vars).forEach((k) => (vars[k] === undefined || vars[k] === '') && delete vars[k]);
  const d = await gql(query, vars);
  return { items: ((d?.Page?.media ?? []) as any[]).map(mapAni), more: !!d?.Page?.pageInfo?.hasNextPage };
}

export async function aniFull(id: number): Promise<AniFull> {
  const lt = `id title { romaji english } coverImage { extraLarge large color } averageScore format seasonYear startDate { year } episodes status`;
  const d = await gql(
    `query($id:Int){ Media(id:$id, type:ANIME){ ${MEDIA}
      studios(isMain:true){ nodes{ name } }
      externalLinks{ site url type color }
      relations{ edges{ relationType node{ ${lt} type } } }
      recommendations(perPage:14, sort:RATING_DESC){ nodes{ mediaRecommendation{ ${lt} } } } } }`,
    { id }
  );
  const m = d?.Media;
  if (!m) throw new Error('Anime not found.');
  return {
    ...mapAni(m),
    studio: m.studios?.nodes?.[0]?.name ?? '',
    links: ((m.externalLinks ?? []) as any[]).filter((l) => l.type === 'STREAMING').map((l) => ({ site: l.site, url: l.url, color: l.color ?? null })),
    related: ((m.relations?.edges ?? []) as any[])
      .filter((e) => e.node?.type === 'ANIME')
      .map((e) => ({ relation: String(e.relationType).replace(/_/g, ' ').toLowerCase(), item: mapAni(e.node) })),
    recs: ((m.recommendations?.nodes ?? []) as any[]).map((n) => n.mediaRecommendation).filter(Boolean).map(mapAni)
  };
}

export type Season = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL';
export function seasonNow(offset = 0): { season: Season; year: number } {
  const d = new Date();
  const order: Season[] = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
  const idx = Math.floor(d.getMonth() / 3) + offset;
  return { season: order[((idx % 4) + 4) % 4], year: d.getFullYear() + Math.floor(idx / 4) };
}

export const FORMAT_LABEL: Record<string, string> = {
  TV: 'TV', TV_SHORT: 'TV SHORT', MOVIE: 'MOVIE', SPECIAL: 'SPECIAL', OVA: 'OVA', ONA: 'ONA', MUSIC: 'MUSIC'
};
export const STATUS_LABEL: Record<string, string> = {
  RELEASING: 'Airing', FINISHED: 'Finished', NOT_YET_RELEASED: 'Upcoming', CANCELLED: 'Cancelled', HIATUS: 'On hiatus'
};
export const GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
  'Mystery', 'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

/** Episodes that can be watched right now. */
export function availableEpisodes(a: Ani): number {
  if (a.status === 'NOT_YET_RELEASED') return 0;
  if (a.status === 'RELEASING' && a.next) return Math.max(0, a.next.episode - 1);
  return a.episodes ?? (a.next ? a.next.episode - 1 : 1);
}

/** Shape an anime like a Media so shared widgets (search suggestions) can show it. */
export const aniToMedia = (a: Ani | AniLite): Media => ({
  id: a.id, title: a.title, poster: null, backdrop: null, overview: '', type: 'tv', rating: a.score / 10,
  year: a.year ? String(a.year) : '', anime: true, ani: true, img: a.cover
});
