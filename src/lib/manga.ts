import { gql } from './anilist';

/** Manga, manhwa and manhua: details from AniList, chapters and pages from MangaDex (through our /api/md relay). */

export interface MangaLite {
  id: number;
  title: string;
  cover: string;
  score: number; // 0-100
  format: string | null;
  year: number | null;
  chapters: number | null;
  country: string | null;
}

export interface Manga extends MangaLite {
  mal: number | null;
  alt: string;
  color: string | null;
  banner: string | null;
  desc: string;
  status: string | null;
  volumes: number | null;
  genres: string[];
  authors: string[];
  /** story / art creators with their AniList ids */
  creators: { id: number; name: string }[];
  /** other titles (native, synonyms) used to find it on MangaDex */
  names: string[];
}

export interface MangaFull extends Manga {
  related: { relation: string; item: Manga }[];
  recs: Manga[];
  /** official places to read it (MANGA Plus, VIZ, Webtoon, …), from AniList */
  official: { site: string; url: string; color: string | null; language: string | null }[];
}

/** Manga / Manhwa / Manhua, from where the series comes from. */
export function kindOf(m: { country: string | null; format: string | null }): string {
  if (m.format === 'ONE_SHOT') return 'One-shot';
  if (m.country === 'KR') return 'Manhwa';
  if (m.country === 'CN' || m.country === 'TW' || m.country === 'HK') return 'Manhua';
  return 'Manga';
}

export const MANGA_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror', 'Mahou Shoujo', 'Mecha', 'Music', 'Mystery',
  'Psychological', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Hentai'
];
export const MANGA_STATUS: Record<string, string> = { RELEASING: 'Ongoing', FINISHED: 'Finished', NOT_YET_RELEASED: 'Upcoming', CANCELLED: 'Cancelled', HIATUS: 'On hiatus' };

const MEDIA = `id idMal synonyms title { romaji english native } coverImage { extraLarge large color } bannerImage description(asHtml: false)
  averageScore format status chapters volumes countryOfOrigin startDate { year } genres
  staff(perPage: 3, sort: RELEVANCE){ edges{ role node{ id name{ full } } } }`;
const LT = `id idMal title { romaji english } coverImage { extraLarge large color } averageScore format status chapters volumes countryOfOrigin startDate { year } genres`;

const clean = (s: string | null | undefined) =>
  (s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim();

export function mapManga(o: any): Manga {
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
    chapters: o.chapters ?? null,
    volumes: o.volumes ?? null,
    year: o.startDate?.year ?? null,
    country: o.countryOfOrigin ?? null,
    genres: o.genres ?? [],
    names: [o.title?.native, ...((o.synonyms ?? []) as string[])].filter(Boolean).slice(0, 5),
    creators: ((o.staff?.edges ?? []) as any[]).filter((e) => /story|art/i.test(e.role || '') && e.node?.id).map((e) => ({ id: e.node.id, name: e.node.name?.full ?? '' })).filter((c, i, a) => a.findIndex((x) => x.id === c.id) === i).slice(0, 2),
    authors: ((o.staff?.edges ?? []) as any[]).filter((e) => /story|art/i.test(e.role || '')).map((e) => e.node?.name?.full).filter(Boolean).slice(0, 2)
  };
}

export const liteManga = (m: Manga | MangaLite): MangaLite => ({
  id: m.id, title: m.title, cover: m.cover, score: m.score, format: m.format, year: m.year, chapters: m.chapters, country: m.country
});

export interface MangaQuery {
  sort?: string;
  search?: string;
  genre?: string;
  country?: string; // JP, KR, CN
  format?: string; // MANGA, ONE_SHOT
  status?: string;
  popularityGreater?: number;
  /** an AniList tag, e.g. "Iyashikei" */
  tag?: string;
  /** only titles on this reading site (an AniList link-source id) */
  licensedById?: number;
  page?: number;
  perPage?: number;
}

export async function mangaList(q: MangaQuery): Promise<{ items: Manga[]; more: boolean; last: number }> {
  const query = `query($page:Int,$perPage:Int,$sort:[MediaSort],$search:String,$genre:String,$country:CountryCode,$format:MediaFormat,$status:MediaStatus,$pg:Int,$lic:Int,$tag:String)
{ Page(page:$page, perPage:$perPage){ pageInfo{ hasNextPage lastPage }
  media(type:MANGA, format_not:NOVEL, sort:$sort, search:$search, genre:$genre, countryOfOrigin:$country, format:$format, status:$status, popularity_greater:$pg, licensedById:$lic, tag:$tag){ ${MEDIA} } } }`;
  const { sort, popularityGreater, licensedById, ...rest } = q;
  const vars: Record<string, unknown> = { page: 1, perPage: 24, ...rest, pg: popularityGreater, lic: licensedById };
  if (sort && !q.search) vars.sort = [sort];
  Object.keys(vars).forEach((k) => (vars[k] === undefined || vars[k] === '') && delete vars[k]);
  const d = await gql(query, vars);
  return { items: ((d?.Page?.media ?? []) as any[]).map(mapManga), more: !!d?.Page?.pageInfo?.hasNextPage, last: d?.Page?.pageInfo?.lastPage ?? 1 };
}

export async function mangaFull(id: number): Promise<MangaFull> {
  const d = await gql(
    `query($id:Int){ Media(id:$id, type:MANGA){ ${MEDIA}
      relations{ edges{ relationType node{ ${LT} type } } }
      externalLinks{ site url type color language }
      recommendations(perPage:14, sort:RATING_DESC){ nodes{ mediaRecommendation{ ${LT} type } } } } }`,
    { id }
  );
  const m = d?.Media;
  if (!m) throw new Error('Title not found.');
  return {
    ...mapManga(m),
    related: ((m.relations?.edges ?? []) as any[])
      .filter((e) => e.node?.type === 'MANGA')
      .map((e) => ({ relation: String(e.relationType).replace(/_/g, ' ').toLowerCase(), item: mapManga(e.node) })),
    recs: ((m.recommendations?.nodes ?? []) as any[]).map((n) => n.mediaRecommendation).filter((x) => x?.type === 'MANGA').map(mapManga),
    // AniList marks reading sites as "STREAMING" links
    official: ((m.externalLinks ?? []) as any[])
      .filter((l) => l?.type === 'STREAMING' && typeof l.url === 'string' && /^https:\/\//.test(l.url))
      .map((l) => ({ site: String(l.site), url: String(l.url), color: l.color ?? null, language: l.language ?? null }))
  };
}

/* ------------------------------ MangaDex: chapters and pages ------------------------------ */

export interface Chapter {
  id: string;
  num: string; // "12", "12.5" or "" for a one-shot
  vol: string;
  title: string;
  pages: number;
  at: number; // ms
  /** set when MangaDex only links to an official site (e.g. MANGA Plus) for this chapter */
  ext: string | null;
}

const RATINGS = ['safe', 'suggestive', 'erotica', 'pornographic'];

async function md(path: string, params: Record<string, string | string[]>): Promise<any> {
  const u = new URLSearchParams({ p: path });
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((x) => u.append(`${k}[]`, x));
    else u.append(k, v);
  }
  let lastErr = "Couldn't load chapters. Try again in a moment.";
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch('/api/md?' + u.toString());
      if (r.ok) return r.json();
      lastErr = `The chapter source answered with an error (${r.status}). Try again in a moment.`;
      if (r.status !== 429 && r.status < 500) break;
      await new Promise((res) => setTimeout(res, 1500));
    } catch {
      lastErr = "Can't reach the chapter source. Check your connection.";
    }
  }
  throw new Error(lastErr);
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
const MAPKEY = 'comvie.md.';

/** Find this title on MangaDex (AniList / MAL links first, then the same title, then a close title). Remembered on this device. */
export async function mdFind(m: Manga): Promise<string | null> {
  try {
    const hit = localStorage.getItem(MAPKEY + m.id);
    if (hit) return hit;
  } catch { /* ignore */ }
  const names = [m.title, m.alt, ...m.names].filter((x, i, a) => x && a.indexOf(x) === i).slice(0, 4);
  const want = names.map(norm).filter((x) => x.length > 1);
  const titlesOf = (r: any): string[] =>
    ([...Object.values(r.attributes?.title ?? {}), ...((r.attributes?.altTitles ?? []) as any[]).flatMap((x) => Object.values(x))] as string[]).map((x) => norm(String(x)));
  let found: string | null = null;
  for (const name of names) {
    let rows: any[] = [];
    try {
      rows = ((await md('/manga', { title: name, limit: '10', contentRating: RATINGS, 'order[relevance]': 'desc' }))?.data ?? []) as any[];
    } catch (e) {
      if (name === names[0]) throw e;
      continue;
    }
    const byLink = rows.find((r) => String(r.attributes?.links?.al) === String(m.id) || (m.mal && String(r.attributes?.links?.mal) === String(m.mal)));
    const byName = rows.find((r) => titlesOf(r).some((t) => want.includes(t)));
    const close = rows.find((r) => titlesOf(r).some((t) => t.length >= 5 && want.some((w) => w.length >= 5 && (t.includes(w) || w.includes(t)))));
    found = (byLink ?? byName ?? close)?.id ?? null;
    if (found) break;
  }
  if (found) {
    try { localStorage.setItem(MAPKEY + m.id, found); } catch { /* ignore */ }
  }
  return found;
}

const chCache = new Map<string, Promise<Chapter[]>>();

/** Chapters in one language, one per chapter number, in reading order. Official-site-only chapters are kept with their link. */
export function mdChapters(mdId: string, lang = 'en'): Promise<Chapter[]> {
  const key = mdId + ':' + lang;
  const hit = chCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const out: Chapter[] = [];
    let offset = 0;
    let total = 1;
    while (offset < total && offset < 5000) {
      const j = await md(`/manga/${mdId}/feed`, {
        limit: '500', offset: String(offset), translatedLanguage: [lang], contentRating: RATINGS,
        'order[chapter]': 'asc', 'order[volume]': 'asc', includeExternalUrl: '1', includeEmptyPages: '1'
      });
      total = j?.total ?? 0;
      const rows = (j?.data ?? []) as any[];
      if (!rows.length) break;
      for (const r of rows) {
        const a = r.attributes ?? {};
        const ext = typeof a.externalUrl === 'string' && a.externalUrl ? a.externalUrl : null;
        if (!a.pages && !ext) continue;
        out.push({ id: r.id, num: a.chapter ?? '', vol: a.volume ?? '', title: a.title ?? '', pages: a.pages || 0, at: Date.parse(a.publishAt || a.createdAt || '') || 0, ext });
      }
      offset += rows.length;
    }
    // one entry per chapter number (several groups often upload the same one); a readable copy beats an outside link
    const best = new Map<string, Chapter>();
    const loose: Chapter[] = [];
    for (const c of out) {
      if (!c.num) {
        loose.push(c);
        continue;
      }
      const cur = best.get(c.num);
      if (!cur || (cur.ext && !c.ext)) best.set(c.num, c);
    }
    return [...best.values()].sort((a, b) => parseFloat(a.num) - parseFloat(b.num)).concat(loose);
  })();
  chCache.set(key, p);
  p.catch(() => chCache.delete(key));
  return p;
}

/** Languages this title has chapters in on MangaDex (English first). */
export async function mdLanguages(mdId: string): Promise<string[]> {
  const j = await md(`/manga/${mdId}`, {});
  const langs = ((j?.data?.attributes?.availableTranslatedLanguages ?? []) as (string | null)[]).filter(Boolean) as string[];
  return [...new Set(langs)].sort((a, b) => (a === 'en' ? -1 : b === 'en' ? 1 : langName(a).localeCompare(langName(b))));
}

const SPECIAL: Record<string, string> = { 'es-la': 'Spanish (Latin America)', 'pt-br': 'Portuguese (Brazil)', 'zh-hk': 'Chinese (Hong Kong)', 'ja-ro': 'Japanese (romanized)', 'ko-ro': 'Korean (romanized)', 'zh-ro': 'Chinese (romanized)' };
let dn: Intl.DisplayNames | null | undefined;
export function langName(code: string): string {
  if (SPECIAL[code]) return SPECIAL[code];
  if (dn === undefined) {
    try { dn = new Intl.DisplayNames(['en'], { type: 'language' }); } catch { dn = null; }
  }
  try { return dn?.of(code) ?? code.toUpperCase(); } catch { return code.toUpperCase(); }
}

export const hostOf = (url: string) => {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return /mangaplus/.test(h) ? 'MANGA Plus' : h;
  } catch {
    return 'official site';
  }
};

/** Every page, with the addresses to try in order: the assigned image server (full, then data-saver quality),
 *  then MangaDex's own origin server (full, then data-saver). */
export interface PageSet { full: string[]; saver: string[]; tries: string[][] }

const ORIGIN = 'https://uploads.mangadex.org';

export async function mdPages(chapterId: string): Promise<PageSet> {
  let j: any = null;
  try {
    j = await md(`/at-home/server/${chapterId}`, {});
  } catch {
    // some networks block the image servers' unusual ports: ask for a server on the standard HTTPS port
    j = await md(`/at-home/server/${chapterId}`, { forcePort443: 'true' });
  }
  const base: string = j?.baseUrl;
  const ch = j?.chapter;
  if (!base || !ch?.hash) throw new Error("This chapter's pages aren't available right now.");
  const data = (ch.data ?? []) as string[];
  const saverFiles = (ch.dataSaver ?? []) as string[];
  const full = data.map((f) => `${base}/data/${ch.hash}/${f}`);
  const saver = saverFiles.map((f) => `${base}/data-saver/${ch.hash}/${f}`);
  const tries = data.map((f, i) =>
    [
      full[i],
      saver[i],
      `${ORIGIN}/data/${ch.hash}/${f}`,
      saverFiles[i] ? `${ORIGIN}/data-saver/${ch.hash}/${saverFiles[i]}` : ''
    ].filter((u, k, a) => u && a.indexOf(u) === k)
  );
  return { full, saver, tries };
}

export const chapterLabel = (c: Chapter) => (c.num ? `Chapter ${c.num}` : 'Oneshot');

/** Cover pictures of popular manga for the "we also have manga" pop-up (never adult titles). */
export async function mangaCovers(): Promise<string[]> {
  const d = await gql(
    `query{ Page(perPage:30){ media(type:MANGA, format_not:NOVEL, sort:TRENDING_DESC, isAdult:false, genre_not_in:["Hentai","Ecchi"]){ coverImage{ extraLarge large } } } }`
  );
  return ((d?.Page?.media ?? []) as any[]).map((m) => m.coverImage?.extraLarge || m.coverImage?.large).filter(Boolean);
}


/* ------------------------------ mangaka ------------------------------ */

export interface Creator { id: number; name: string; image: string | null; art: string | null; role?: string }

// well-known manga, manhwa and manhua creators (AniList's spelling)
const MANGAKA = [
  'Eiichirou Oda', 'Masashi Kishimoto', 'Tite Kubo', 'Akira Toriyama', 'Hajime Isayama', 'Gege Akutami', 'Tatsuki Fujimoto',
  'Koyoharu Gotouge', 'Kouhei Horikoshi', 'Yoshihiro Togashi', 'Kentarou Miura', 'Naoki Urasawa', 'Hiromu Arakawa', 'Yuusuke Murata',
  'Junji Itou', 'Rumiko Takahashi', 'Takehiko Inoue', 'Inio Asano', 'Hirohiko Araki', 'Sui Ishida', 'Tsugumi Ooba', 'Takeshi Obata',
  'Makoto Yukimura', 'Kaiu Shirai', 'Yukinobu Tatsu', 'Chugong'
];

let creatorsCache: Promise<Creator[]> | null = null;

/** Famous mangaka, looked up on AniList in one request. */
export function topCreators(): Promise<Creator[]> {
  if (creatorsCache) return creatorsCache;
  const fields = 'id name{ full } image{ large } staffMedia(type:MANGA, sort:POPULARITY_DESC, perPage:1){ nodes{ bannerImage coverImage{ large } } }';
  const body = MANGAKA.map((n, i) => `s${i}: Staff(search:${JSON.stringify(n)}){ ${fields} }`).join('\n');
  creatorsCache = gql(`query{ ${body} }`).then((d) => {
    const out: Creator[] = [];
    MANGAKA.forEach((_, i) => {
      const x = d?.['s' + i];
      if (!x?.id || out.some((c) => c.id === x.id)) return;
      const n = x.staffMedia?.nodes?.[0];
      out.push({ id: x.id, name: x.name?.full ?? '', image: x.image?.large ?? null, art: n?.bannerImage || n?.coverImage?.large || null });
    });
    return out;
  });
  creatorsCache.catch(() => (creatorsCache = null));
  return creatorsCache;
}

const STAFF_FIELDS = 'id name{ full } image{ large } primaryOccupations staffMedia(type:MANGA, sort:POPULARITY_DESC, perPage:1){ nodes{ bannerImage coverImage{ large } } }';
const toCreator = (x: any): Creator => {
  const n = x.staffMedia?.nodes?.[0];
  return { id: x.id, name: x.name?.full ?? '', image: x.image?.large ?? null, art: n?.bannerImage || n?.coverImage?.large || null, role: (x.primaryOccupations ?? [])[0] };
};
const MAKES_COMICS = /mangaka|manga|manhwa|manhua|webtoon|comic|illustrator|artist|author|writer|novelist/i;

/** Search every creator on AniList (people who have worked on manga come first). */
export async function searchCreators(search: string, page = 1): Promise<{ items: Creator[]; more: boolean }> {
  const d = await gql(
    `query($page:Int,$search:String){ Page(page:$page, perPage:40){ pageInfo{ hasNextPage } staff(search:$search, sort:[SEARCH_MATCH]){ ${STAFF_FIELDS} } } }`,
    { page, search }
  );
  const all = ((d?.Page?.staff ?? []) as any[]).map((x) => ({ c: toCreator(x), manga: !!x.staffMedia?.nodes?.length }));
  return { items: [...all.filter((x) => x.manga), ...all.filter((x) => !x.manga)].map((x) => x.c), more: !!d?.Page?.pageInfo?.hasNextPage };
}

/**
 * More popular creators beyond the hand-picked list: AniList's most-favourited people, keeping those who make
 * manga / manhwa / manhua (two pages of 50 per call, since most of that list is voice actors).
 */
export async function popularCreators(page = 1): Promise<{ items: Creator[]; more: boolean }> {
  const q = (p: number) =>
    gql(`query($page:Int){ Page(page:$page, perPage:50){ pageInfo{ hasNextPage } staff(sort:[FAVOURITES_DESC]){ ${STAFF_FIELDS} } } }`, { page: p });
  const [a, b] = await Promise.all([q(page * 2 - 1), q(page * 2)]);
  const rows = [...((a?.Page?.staff ?? []) as any[]), ...((b?.Page?.staff ?? []) as any[])];
  return {
    items: rows.filter((x) => (x.primaryOccupations ?? []).some((o: string) => MAKES_COMICS.test(o)) && x.staffMedia?.nodes?.length).map(toCreator),
    more: !!b?.Page?.pageInfo?.hasNextPage
  };
}

export interface CreatorPage { name: string; native: string; image: string | null; about: string; items: Manga[]; more: boolean }

/** A mangaka's works, most popular first. */
export async function creatorWorks(id: number, page = 1): Promise<CreatorPage> {
  const d = await gql(
    `query($id:Int,$page:Int){ Staff(id:$id){ name{ full native } image{ large } description(asHtml:false)
      staffMedia(type:MANGA, sort:POPULARITY_DESC, page:$page, perPage:30){ pageInfo{ hasNextPage } nodes{ ${MEDIA} } } } }`,
    { id, page }
  );
  const st = d?.Staff;
  if (!st) throw new Error('Creator not found.');
  const seen = new Set<number>();
  return {
    name: st.name?.full ?? '',
    native: st.name?.native ?? '',
    image: st.image?.large ?? null,
    about: clean(st.description).replace(/__|~!|!~/g, ''),
    items: ((st.staffMedia?.nodes ?? []) as any[]).filter((n) => n && !seen.has(n.id) && seen.add(n.id) && n.format !== 'NOVEL').map(mapManga),
    more: !!st.staffMedia?.pageInfo?.hasNextPage
  };
}
