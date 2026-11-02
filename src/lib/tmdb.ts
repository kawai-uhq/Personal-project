import type { CastMember, Details, Episode, Media, MediaType, Person } from './types';

export const IMG = {
  card: 'https://image.tmdb.org/t/p/w342',
  large: 'https://image.tmdb.org/t/p/w780',
  original: 'https://image.tmdb.org/t/p/original',
  still: 'https://image.tmdb.org/t/p/w300',
  logo: 'https://image.tmdb.org/t/p/w500'
};

const B = 'https://image.tmdb.org/t/p/';
/** Responsive image helpers: the browser picks the smallest file that looks sharp. */
export const posterSrc = (p: string) => `${B}w342${p}`;
export const posterSet = (p: string) => `${B}w185${p} 185w, ${B}w342${p} 342w, ${B}w500${p} 500w`;
export const backdropSrc = (p: string) => `${B}w1280${p}`;
export const backdropSet = (p: string) => `${B}w780${p} 780w, ${B}w1280${p} 1280w, ${B}original${p} 1920w`;
export const profileSrc = (p: string) => `${B}w185${p}`;
export const thumbSrc = (p: string) => `${B}w92${p}`;

const cache = new Map<string, Promise<any>>();

function get(path: string): Promise<any> {
  const hit = cache.get(path);
  if (hit) return hit;
  const p = (async () => {
    let r: Response;
    try {
      r = await fetch('/api/tmdb?path=' + encodeURIComponent(path));
    } catch {
      throw new Error("Can't reach the server. Check your internet connection.");
    }
    if (!r.ok) {
      let msg = '';
      try {
        msg = (await r.json()).error ?? '';
      } catch {
        /* not json */
      }
      throw new Error(msg || `Something went wrong (${r.status}).`);
    }
    return r.json();
  })();
  cache.set(path, p);
  p.catch(() => cache.delete(path));
  return p;
}

function parse(o: any, fallback: 'all' | MediaType): Media | null {
  if (!o) return null;
  const type = fallback === 'all' ? o.media_type : fallback;
  if (type !== 'movie' && type !== 'tv') return null;
  const date: string = (type === 'movie' ? o.release_date : o.first_air_date) ?? '';
  return {
    id: o.id,
    title: (type === 'movie' ? o.title : o.name) || 'Untitled',
    poster: o.poster_path || null,
    backdrop: o.backdrop_path || null,
    overview: o.overview ?? '',
    type,
    rating: o.vote_average ?? 0,
    year: date.slice(0, 4),
    votes: (o.vote_count as number) ?? 0,
    orig: (type === 'movie' ? o.original_title : o.original_name) || undefined,
    anime:
      o.original_language === 'ja' &&
      (((o.genre_ids ?? []) as number[]).includes(16) || ((o.genres ?? []) as { id: number }[]).some((g) => g.id === 16))
  };
}

const list = (json: any, fb: 'all' | MediaType): Media[] =>
  ((json?.results ?? []) as any[]).map((o) => parse(o, fb)).filter((m): m is Media => m !== null);

const dayStr = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const JA = 'with_original_language=ja';

/** Home-page and Explore feeds: a TMDB list plus how its items are typed. */
export const FEEDS: Record<string, { title: string; path: string; type: 'all' | MediaType }> = {
  'trending-day': { title: 'Trending Today', path: '/trending/all/day', type: 'all' },
  'trending-week': { title: 'Trending This Week', path: '/trending/all/week', type: 'all' },
  'trending-movie': { title: 'Trending Movies', path: '/trending/movie/day', type: 'movie' },
  'trending-tv': { title: 'Trending TV Series', path: '/trending/tv/day', type: 'tv' },
  'popular-movie': { title: 'Popular Movies', path: '/movie/popular', type: 'movie' },
  'popular-tv': { title: 'Popular TV Series', path: '/tv/popular', type: 'tv' },
  'top-movie': { title: 'Top Rated Movies', path: '/movie/top_rated', type: 'movie' },
  'top-tv': { title: 'Top Rated TV Series', path: '/tv/top_rated', type: 'tv' },
  upcoming: { title: 'Upcoming Movies', path: '/movie/upcoming', type: 'movie' },
  'now-playing': { title: 'Now Playing in Theaters', path: '/movie/now_playing', type: 'movie' },
  'on-air': { title: 'Currently Airing TV Shows', path: '/tv/on_the_air', type: 'tv' },
  'airing-today': { title: 'Airing Today', path: '/tv/airing_today', type: 'tv' },
  action: { title: 'Action & Explosive Hits', path: '/discover/movie?with_genres=28&sort_by=popularity.desc', type: 'movie' },
  scifi: { title: 'Sci-Fi & Futuristic Worlds', path: '/discover/movie?with_genres=878&sort_by=popularity.desc', type: 'movie' },
  animated: { title: 'Animated Masterpieces', path: '/discover/tv?with_genres=16&sort_by=popularity.desc', type: 'tv' },
  // ---- anime (Japanese animation) ----
  'anime-trending': { title: 'Trending Right Now', path: `/discover/tv?with_genres=16&${JA}&sort_by=popularity.desc`, type: 'tv' },
  'anime-season': {
    title: 'Popular This Season',
    path: `/discover/tv?with_genres=16&${JA}&first_air_date.gte=${dayStr(-110)}&first_air_date.lte=${dayStr(0)}&sort_by=popularity.desc`,
    type: 'tv'
  },
  'anime-top': { title: 'All-Time Highest Rated', path: `/discover/tv?with_genres=16&${JA}&sort_by=vote_average.desc&vote_count.gte=400`, type: 'tv' },
  'anime-popular': { title: 'Most Popular Anime', path: `/discover/tv?with_genres=16&${JA}&sort_by=vote_count.desc`, type: 'tv' },
  'anime-upcoming': {
    title: 'Upcoming Anime Releases',
    path: `/discover/tv?with_genres=16&${JA}&first_air_date.gte=${dayStr(1)}&sort_by=popularity.desc`,
    type: 'tv'
  },
  'anime-films': { title: 'Top Anime Feature Films', path: `/discover/movie?with_genres=16&${JA}&sort_by=vote_average.desc&vote_count.gte=200`, type: 'movie' },
  'anime-action': { title: 'High-Octane Action', path: `/discover/tv?with_genres=16,10759&${JA}&sort_by=popularity.desc`, type: 'tv' },
  'anime-fantasy': { title: 'Epic Fantasy Worlds', path: `/discover/tv?with_genres=16,10765&${JA}&sort_by=popularity.desc`, type: 'tv' },
  'anime-romance': { title: 'Heartwarming Romance', path: `/discover/movie?with_genres=16,10749&${JA}&sort_by=popularity.desc`, type: 'movie' },
  'anime-scifi': { title: 'Sci-Fi & Cyberpunk', path: `/discover/movie?with_genres=16,878&${JA}&sort_by=popularity.desc`, type: 'movie' },
  drama: {
    title: 'Critically Acclaimed Dramas',
    path: '/discover/movie?with_genres=18&sort_by=vote_average.desc&vote_count.gte=800',
    type: 'movie'
  }
};

const provCache = new Map<string, Promise<{ id: number; name: string; logo: string | null; prio: number }[]>>();

export const tmdb = {
  /** Every streaming service TMDB lists (movies + TV merged), most popular first; for one country or worldwide. */
  providers: (region = ''): Promise<{ id: number; name: string; logo: string | null; prio: number }[]> => {
    let p = provCache.get(region);
    if (!p) {
      const q = region ? `?watch_region=${region}` : '';
      p = Promise.all([get(`/watch/providers/movie${q}`), get(`/watch/providers/tv${q}`)]).then(([m, t]) => {
        const by = new Map<number, { id: number; name: string; logo: string | null; prio: number }>();
        for (const r of [...(m?.results ?? []), ...(t?.results ?? [])] as any[]) {
          if (!r.provider_id || by.has(r.provider_id)) continue;
          by.set(r.provider_id, {
            id: r.provider_id,
            name: r.provider_name,
            logo: r.logo_path ?? null,
            prio: region ? (r.display_priorities?.[region] ?? r.display_priority ?? 999) : (r.display_priority ?? 999)
          });
        }
        return [...by.values()].sort((a, b) => a.prio - b.prio);
      });
      p.catch(() => provCache.delete(region));
      provCache.set(region, p);
    }
    return p;
  },
  /** Title search limited to one streaming service: TMDB can't filter a search itself, so each hit's availability is checked. */
  searchOn: async (t: MediaType, q: string, id: number, region: string, page: number, anime = false) => {
    const enc = encodeURIComponent(q).replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    const j = await get(`/search/${t}?query=${enc}&include_adult=false&language=en-US&page=${page}`);
    const hits = list(j, t).filter((m) => !anime || m.anime);
    const on = (m: Media) =>
      get(`/${t}/${m.id}/watch/providers`)
        .then((w) => {
          const r = w?.results?.[region];
          return [r?.flatrate, r?.free, r?.ads].some((a: any[] | undefined) => a?.some((x) => x.provider_id === id));
        })
        .catch(() => false);
    const keep: Media[] = [];
    for (let i = 0; i < hits.length; i += 10) {
      const chunk = hits.slice(i, i + 10);
      const ok = await Promise.all(chunk.map(on));
      chunk.forEach((m, k) => ok[k] && keep.push(m));
    }
    return { items: keep, pages: Math.min((j?.total_pages as number) || 1, 500) };
  },
  /** Countries TMDB has streaming data for. */
  regions: (): Promise<{ code: string; name: string }[]> =>
    get('/watch/providers/regions').then((j) =>
      ((j?.results ?? []) as any[])
        .map((r) => ({ code: r.iso_3166_1 as string, name: r.english_name as string }))
        .sort((a, b) => a.name.localeCompare(b.name))
    ),
  /** A random well-rated title (optionally of one type and genre). */
  surprise: async (type?: MediaType, genre?: string): Promise<Media | null> => {
    const t: MediaType = type ?? (Math.random() < 0.5 ? 'movie' : 'tv');
    const votes = t === 'movie' ? 1500 : 500;
    const g = genre ? `&with_genres=${genre}` : '';
    const url = (page: number) =>
      `/discover/${t}?sort_by=vote_average.desc&vote_count.gte=${votes}${g}&language=en-US&include_adult=false&page=${page}`;
    let items = await get(url(1 + Math.floor(Math.random() * 5))).then((j) => list(j, t));
    if (!items.length) items = await get(url(1)).then((j) => list(j, t));
    const pool = items.filter((m) => m.poster);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  },
  /** Any TMDB list path, paged. */
  list: (path: string, type: 'all' | MediaType, page = 1) => {
    const sep = path.includes('?') ? '&' : '?';
    return get(`${path}${sep}language=en-US&include_adult=false&page=${page}`).then((j) => ({
      items: list(j, type),
      pages: Math.min((j?.total_pages as number) || 1, 500)
    }));
  },
  /** A film series (TMDB "collection"): its name, artwork and films in release order. */
  collection: async (id: number): Promise<{ id: number; name: string; poster: string | null; backdrop: string | null; overview: string; items: Media[] }> => {
    const j = await get(`/collection/${id}?language=en-US`);
    const items = list({ results: j?.parts ?? [] }, 'movie').sort((a, b) => (a.year || '9999').localeCompare(b.year || '9999'));
    return { id, name: j?.name ?? '', poster: j?.poster_path ?? null, backdrop: j?.backdrop_path ?? null, overview: j?.overview ?? '', items };
  },
  /** Best-known films from a studio (TMDB company id), most-voted first. */
  companyFilms: async (company: number): Promise<Media[]> => {
    const j = await get(`/discover/movie?with_companies=${company}&sort_by=vote_count.desc&language=en-US&include_adult=false&page=1`);
    return list(j, 'movie');
  },
  /** Films a person directed, most-voted first. */
  directorFilms: async (person: number): Promise<Media[]> => {
    const j = await get(`/person/${person}/movie_credits?language=en-US`);
    const seen = new Set<number>();
    const crew = ((j?.crew ?? []) as any[]).filter((c) => c.job === 'Director' && !seen.has(c.id) && seen.add(c.id));
    return list({ results: crew }, 'movie').sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
  },
  feed: (key: string, page = 1) => {
    const f = FEEDS[key];
    if (!f) return Promise.resolve({ items: [] as Media[], pages: 1 });
    return tmdb.list(f.path, f.type, page);
  },
  /** Title logo image (transparent PNG) for the billboard, when TMDB has one. */
  logo: async (t: MediaType, id: number): Promise<string | null> => {
    const j = await get(`/${t}/${id}/images?include_image_language=en,null`);
    const l = ((j?.logos ?? []) as any[]).filter((x) => x.file_path && !String(x.file_path).endsWith('.svg'));
    const pick = l.find((x) => x.iso_639_1 === 'en') ?? l[0];
    return (pick?.file_path as string | undefined) ?? null;
  },
  trending: () => get('/trending/all/day?language=en-US').then((j) => list(j, 'all')),
  popular: (t: MediaType) => get(`/${t}/popular?language=en-US&page=1`).then((j) => list(j, t)),
  topRated: (t: MediaType) => get(`/${t}/top_rated?language=en-US&page=1`).then((j) => list(j, t)),
  /** Search titles; with `anime`, only Japanese animation (series and films, first two result pages of each). */
  search: (q: string, anime = false) => {
    // encodeURIComponent leaves ! ' ( ) * ~ alone; encode them too so every title is safe to send
    const enc = encodeURIComponent(q).replace(/[!'()*~]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    if (!anime) return get(`/search/multi?query=${enc}&include_adult=false&language=en-US&page=1`).then((j) => list(j, 'all'));
    const one = (t: MediaType, p: number) =>
      get(`/search/${t}?query=${enc}&include_adult=false&language=en-US&page=${p}`).then((j) => list(j, t)).catch(() => [] as Media[]);
    return Promise.all([one('tv', 1), one('tv', 2), one('movie', 1), one('movie', 2)]).then((r) => {
      const by = new Map<string, Media>();
      for (const m of r.flat()) if (m.anime && !by.has(`${m.type}:${m.id}`)) by.set(`${m.type}:${m.id}`, m);
      return [...by.values()].sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
    });
  },
  anime: () =>
    get(
      '/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc&language=en-US&page=1'
    ).then((j) => list(j, 'tv')),
  discover: (t: MediaType, genre: number, page: number) =>
    get(
      `/discover/${t}?with_genres=${genre}&sort_by=popularity.desc&include_adult=false&language=en-US&page=${page}`
    ).then((j) => ({ items: list(j, t), pages: (j?.total_pages as number) || 1 })),
  similar: async (t: MediaType, id: number) => {
    const rec = await get(`/${t}/${id}/recommendations?language=en-US&page=1`).then((j) => list(j, t));
    if (rec.length) return rec;
    return get(`/${t}/${id}/similar?language=en-US&page=1`).then((j) => list(j, t));
  },
  /** A TV show's latest and next episode air dates (same request as its details, so it's shared). */
  episodesAround: async (id: number): Promise<{ media: Media; eps: { season: number; episode: number; name: string; date: string }[] } | null> => {
    const j = await get(`/tv/${id}?language=en-US`);
    const media = parse(j, 'tv');
    if (!media) return null;
    const eps = [j.last_episode_to_air, j.next_episode_to_air]
      .filter((e: any) => e?.air_date && e.season_number)
      .map((e: any) => ({ season: e.season_number as number, episode: e.episode_number as number, name: (e.name as string) ?? '', date: e.air_date as string }));
    return { media, eps };
  },
  details: async (t: MediaType, id: number): Promise<Details> => {
    const j = await get(`/${t}/${id}?language=en-US`);
    const media = parse(j, t);
    if (!media) throw new Error('Title not found.');
    const la = j.last_episode_to_air;
    return {
      media,
      lastAired:
        la?.air_date && la.season_number
          ? { season: la.season_number as number, episode: la.episode_number as number, date: la.air_date as string }
          : null,
      genres: ((j.genres ?? []) as any[]).map((g) => g.name as string),
      runtime: j.runtime || j.episode_run_time?.[0] || 0,
      tagline: j.tagline ?? '',
      status: (j.status as string) ?? '',
      votes: (j.vote_count as number) ?? 0,
      firstAir: ((j.first_air_date ?? j.release_date) as string) ?? '',
      lastAir: ((j.last_air_date ?? '') as string),
      totalEpisodes: (j.number_of_episodes as number) ?? 0,
      studios: [...((j.networks ?? []) as any[]), ...((j.production_companies ?? []) as any[])]
        .map((c) => c.name as string)
        .filter((n, i, a) => n && a.indexOf(n) === i)
        .slice(0, 8),
      seasons: ((j.seasons ?? []) as any[])
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          number: s.season_number as number,
          name: (s.name as string) || `Season ${s.season_number}`,
          episodeCount: (s.episode_count as number) ?? 0
        }))
    };
  },
  trailer: async (t: MediaType, id: number): Promise<string | null> => {
    const j = await get(`/${t}/${id}/videos?language=en-US`);
    const vids = ((j?.results ?? []) as any[]).filter((v) => v.site === 'YouTube' && /^[\w-]{6,20}$/.test(v.key));
    const pick =
      vids.find((v) => v.type === 'Trailer' && v.official) ??
      vids.find((v) => v.type === 'Trailer') ??
      vids.find((v) => v.type === 'Teaser');
    return (pick?.key as string | undefined) ?? null;
  },
  credits: async (t: MediaType, id: number): Promise<{ cast: CastMember[]; directors: string[] }> => {
    const j = await get(`/${t}/${id}/credits?language=en-US`);
    return {
      cast: ((j?.cast ?? []) as any[]).slice(0, 20).map((c) => ({
        id: c.id as number,
        name: c.name as string,
        character: (c.character as string) || '',
        photo: (c.profile_path as string) || null
      })),
      directors: ((j?.crew ?? []) as any[]).filter((c) => c.job === 'Director').map((c) => c.name as string)
    };
  },
  person: async (id: number): Promise<{ person: Person; knownFor: Media[] }> => {
    const [p, c] = await Promise.all([
      get(`/person/${id}?language=en-US`),
      get(`/person/${id}/combined_credits?language=en-US`)
    ]);
    const seen = new Set<string>();
    const knownFor = ((c?.cast ?? []) as any[])
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .map((o) => parse(o, 'all'))
      .filter((m): m is Media => {
        if (!m) return false;
        const k = `${m.type}:${m.id}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 40);
    return {
      person: {
        id,
        name: p.name ?? '',
        bio: p.biography ?? '',
        photo: p.profile_path || null,
        born: p.birthday ?? '',
        place: p.place_of_birth ?? '',
        knownFor: p.known_for_department ?? ''
      },
      knownFor
    };
  },
  episodes: async (id: number, season: number): Promise<Episode[]> => {
    const j = await get(`/tv/${id}/season/${season}?language=en-US`);
    return ((j.episodes ?? []) as any[]).map((e, i) => ({
      number: e.episode_number ?? i + 1,
      name: e.name || `Episode ${i + 1}`,
      overview: e.overview ?? '',
      still: e.still_path || null,
      rating: e.vote_average ?? 0,
      runtime: e.runtime ?? 0,
      airDate: (e.air_date as string) ?? ''
    }));
  }
};
