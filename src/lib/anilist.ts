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

const DIRECT = 'https://graphql.anilist.co';
const cache = new Map<string, Promise<any>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + s.length.toString(36);
};

/** Last good answers are kept on the device, so a busy AniList still shows something. */
const SAVED = 'comvie.ani.';
function savedGet(key: string): any {
  try {
    const raw = localStorage.getItem(SAVED + key);
    return raw ? JSON.parse(raw).d : undefined;
  } catch {
    return undefined;
  }
}
function savedSet(key: string, d: unknown) {
  try {
    const idxKey = SAVED + 'index';
    const idx: string[] = JSON.parse(localStorage.getItem(idxKey) || '[]').filter((k: string) => k !== key);
    idx.push(key);
    while (idx.length > 40) localStorage.removeItem(SAVED + idx.shift());
    localStorage.setItem(SAVED + key, JSON.stringify({ d }));
    localStorage.setItem(idxKey, JSON.stringify(idx));
  } catch {
    /* storage full or blocked */
  }
}

async function send(query: string, variables: Record<string, unknown>): Promise<Response> {
  // Preferred: our own cached relay. Fallback: AniList directly.
  try {
    const r = await fetch('/api/anime?q=' + encodeURIComponent(JSON.stringify({ query, variables })));
    if (r.status !== 404 && r.status < 500) return r;
  } catch {
    /* fall through */
  }
  return fetch(DIRECT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables })
  });
}

async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const key = hash(query + JSON.stringify(variables));
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    let lastErr = 'AniList is busy right now. Wait a minute and try again.';
    for (let attempt = 0; attempt < 3; attempt++) {
      let r: Response;
      try {
        r = await send(query, variables);
      } catch {
        lastErr = "Can't reach AniList. Check your internet connection.";
        break;
      }
      if (r.status === 429) {
        const wait = Math.min(Math.max(Number(r.headers.get('retry-after')) || 0, 2 + attempt * 3), 12);
        if (attempt < 2) {
          await sleep(wait * 1000);
          continue;
        }
        break;
      }
      let j: any = null;
      try {
        j = await r.json();
      } catch {
        /* not json */
      }
      if (!r.ok || j?.errors) {
        lastErr = j?.errors?.[0]?.message || j?.error || `AniList error (${r.status}).`;
        break;
      }
      savedSet(key, j.data);
      return j.data as T;
    }
    const old = savedGet(key);
    if (old !== undefined) return old as T;
    throw new Error(lastErr);
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

/** A page of anime (all titles, including those AniList marks as adult). */
export async function aniList(q: AniQuery): Promise<{ items: Ani[]; more: boolean; last: number }> {
  const query = `query($page:Int,$perPage:Int,$sort:[MediaSort],$search:String,$genre:String,$season:MediaSeason,$seasonYear:Int,$format:MediaFormat,$status:MediaStatus,$pg:Int)
{
    Page(page:$page, perPage:$perPage){ pageInfo{ hasNextPage lastPage }
      media(type:ANIME, sort:$sort, search:$search, genre:$genre, season:$season, seasonYear:$seasonYear, format:$format, status:$status, popularity_greater:$pg){ ${MEDIA} } } }`;
  const { sort, popularityGreater, ...rest } = q;
  const vars: Record<string, unknown> = { page: 1, perPage: 24, ...rest, pg: popularityGreater, };
  if (sort && !q.search) vars.sort = [sort];
  Object.keys(vars).forEach((k) => (vars[k] === undefined || vars[k] === '') && delete vars[k]);
  const d = await gql(query, vars);
  return { items: ((d?.Page?.media ?? []) as any[]).map(mapAni), more: !!d?.Page?.pageInfo?.hasNextPage, last: d?.Page?.pageInfo?.lastPage ?? 1 };
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
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Hentai', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music',
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
