import { useEffect, useState } from 'react';
import { animeStore } from './animeStore';
import type { AniLite } from './anilist';
import { mangaStore } from './mangaStore';
import type { MangaLite } from './manga';
import { onSharedHost } from './shared';
import { hostSection, onProd } from './site';
import type { MangaRead } from './mangaStore';
import type { AnimeWatch } from './animeStore';

/**
 * Connect an AniList account (AniList's "implicit grant" sign-in): import your AniList lists into Comvie,
 * and update your AniList progress as you watch and read. Needs VITE_ANILIST_CLIENT_ID (a free AniList API client
 * whose redirect URL is https://anime.comvie.lol/account).
 */
export const ANILIST_CLIENT_ID = ((import.meta.env.VITE_ANILIST_CLIENT_ID as string | undefined) ?? '').trim();
export const anilistReady = /^\d+$/.test(ANILIST_CLIENT_ID);
export const connectUrl = () => `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=token`;

export interface AniLink { token: string; exp: number; id: number; name: string; avatar: string | null; sync: boolean; importAt?: number }

const KEY = 'comvie.anilist';
const COOKIE = 'cv_anilist';
const EVT = 'comvie:anilist';

function readCookie(): AniLink | null | 'out' {
  try {
    const m = document.cookie.match(/(?:^|; )cv_anilist=([^;]*)/);
    if (!m) return null;
    const v = decodeURIComponent(m[1]);
    return v === 'out' ? 'out' : (JSON.parse(v) as AniLink);
  } catch {
    return null;
  }
}

export function getLink(): AniLink | null {
  let l: AniLink | null = null;
  const c = onSharedHost() ? readCookie() : null;
  if (c === 'out') return null;
  if (c) l = c;
  else {
    try { l = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { l = null; }
  }
  return l && l.exp > Date.now() ? l : null;
}

function saveLink(l: AniLink | null) {
  try {
    if (l) localStorage.setItem(KEY, JSON.stringify(l));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  if (onSharedHost()) {
    try {
      const age = l ? Math.max(60, Math.floor((l.exp - Date.now()) / 1000)) : 400 * 86400;
      document.cookie = `${COOKIE}=${l ? encodeURIComponent(JSON.stringify(l)) : 'out'}; Domain=.comvie.lol; Path=/; Secure; SameSite=Lax; Max-Age=${age}`;
    } catch { /* ignore */ }
  }
  window.dispatchEvent(new Event(EVT));
}

export function useAniLink(): AniLink | null {
  const [l, setL] = useState(getLink);
  useEffect(() => {
    const f = () => setL(getLink());
    window.addEventListener(EVT, f);
    window.addEventListener('focus', f);
    return () => {
      window.removeEventListener(EVT, f);
      window.removeEventListener('focus', f);
    };
  }, []);
  return l;
}

async function call(token: string, query: string, variables: Record<string, unknown> = {}) {
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables })
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.errors) throw new Error(j?.errors?.[0]?.message || `AniList error (${r.status}).`);
  return j.data;
}

/** Back from AniList with "#access_token=…" in the address: save the connection. Run before the app starts. */
export async function captureAniListReturn(): Promise<void> {
  const h = location.hash;
  if (!h.includes('access_token=')) return;
  const p = new URLSearchParams(h.slice(1));
  const token = p.get('access_token') || '';
  const secs = Number(p.get('expires_in')) || 365 * 86400;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* ignore */ }
  if (!token) return;
  try {
    const d = await call(token, 'query{ Viewer{ id name avatar{ medium } } }');
    saveLink({ token, exp: Date.now() + secs * 1000, id: d.Viewer.id, name: d.Viewer.name, avatar: d.Viewer.avatar?.medium ?? null, sync: true, importAt: Date.now() });
  } catch {
    /* token rejected: stay disconnected */
  }
}

export const disconnectAniList = () => saveLink(null);
export function setAniListSync(on: boolean) {
  const l = getLink();
  if (l) saveLink({ ...l, sync: on });
}

const LT = 'id title{ romaji english } coverImage{ extraLarge large } averageScore format episodes chapters countryOfOrigin startDate{ year } seasonYear';
const DONE = 'comvie.anilist.imported';

export interface ImportResult { anime: number; manga: number; history: number }

const titleOf = (o: any) => o.title?.english || o.title?.romaji || 'Untitled';
const coverOf = (o: any) => o.coverImage?.extraLarge || o.coverImage?.large || '';
const aniLite = (o: any): AniLite => ({ id: o.id, title: titleOf(o), cover: coverOf(o), score: o.averageScore ?? 0, format: o.format ?? null, year: o.seasonYear ?? o.startDate?.year ?? null, episodes: o.episodes ?? null });
const mangaLite = (o: any): MangaLite => ({ id: o.id, title: titleOf(o), cover: coverOf(o), score: o.averageScore ?? 0, format: o.format ?? null, year: o.startDate?.year ?? null, chapters: o.chapters ?? null, country: o.countryOfOrigin ?? null });

/**
 * Copy your AniList library into Comvie:
 *  - Watching / Reading, Paused, Rewatching and Completed → History (and Continue Watching / Reading), newest first
 *  - episodes and chapters you've seen → marked watched / read
 *  - Watching / Reading, Paused, Rewatching and Planning → Watchlist / Saved
 *  - AniList favourites → Favorites
 * part: which half to import ('anime' on the anime site, 'manga' on the manga site, both elsewhere).
 */
export async function importAniList(part: 'anime' | 'manga' | 'both' = 'both'): Promise<ImportResult> {
  const l = getLink();
  if (!l) throw new Error('Connect AniList first.');
  const res: ImportResult = { anime: 0, manga: 0, history: 0 };
  const lists = (type: 'ANIME' | 'MANGA') =>
    call(l.token, `query($u:Int,$t:MediaType){ MediaListCollection(userId:$u, type:$t){ lists{ entries{ status progress updatedAt media{ ${LT} } } } } }`, { u: l.id, t: type });
  const favs = () =>
    call(l.token, `query($u:Int){ User(id:$u){ favourites{ anime(perPage:50){ nodes{ ${LT} } } manga(perPage:50){ nodes{ ${LT} } } } } }`, { u: l.id }).catch(() => null);
  const entries = (d: any) => ((d?.MediaListCollection?.lists ?? []) as any[]).flatMap((x) => x.entries ?? []).filter((e: any) => e?.media?.id);
  const [fav] = await Promise.all([favs()]);
  const ACTIVE = ['CURRENT', 'PAUSED', 'REPEATING'];

  if (part !== 'manga') {
    const all = entries(await lists('ANIME'));
    const hist: AnimeWatch[] = [];
    for (const e of all) {
      const prog = Number(e.progress) || 0;
      if (prog > 0) animeStore.seenUpTo(e.media.id, prog);
      if ((ACTIVE.includes(e.status) && prog > 0) || e.status === 'COMPLETED') {
        const total = e.media.episodes ?? null;
        const next = e.status === 'COMPLETED' ? Math.max(1, total ?? prog) : total ? Math.min(prog + 1, total) : prog + 1;
        hist.push({ ...aniLite(e.media), episode: next, server: 1, lang: 'sub', at: (Number(e.updatedAt) || 0) * 1000 || Date.now() });
      }
    }
    // keep the shows you're still watching ahead of the finished ones
    hist.sort((a, b) => b.at - a.at);
    animeStore.mergeHistory(hist);
    res.history += hist.length;
    res.anime += animeStore.addMany('list', all.filter((e) => [...ACTIVE, 'PLANNING'].includes(e.status)).map((e) => aniLite(e.media)));
    animeStore.addMany('loved', ((fav?.User?.favourites?.anime?.nodes ?? []) as any[]).filter((o) => o?.id).map(aniLite));
  }

  if (part !== 'anime') {
    const all = entries(await lists('MANGA')).filter((e) => e.media.format !== 'NOVEL');
    const hist: MangaRead[] = [];
    for (const e of all) {
      const prog = Number(e.progress) || 0;
      if ((ACTIVE.includes(e.status) && prog > 0) || e.status === 'COMPLETED') {
        hist.push({ ...mangaLite(e.media), chapterId: '', label: `Chapter ${Math.max(prog, 1)}`, progress: prog, lang: 'en', at: (Number(e.updatedAt) || 0) * 1000 || Date.now() });
      }
    }
    mangaStore.mergeHistory(hist);
    res.history += hist.length;
    res.manga += mangaStore.addMany(all.filter((e) => [...ACTIVE, 'PLANNING'].includes(e.status)).map((e) => mangaLite(e.media)));
    mangaStore.addMany(((fav?.User?.favourites?.manga?.nodes ?? []) as any[]).filter((o) => o?.id && o.format !== 'NOVEL').map(mangaLite));
  }
  try { localStorage.setItem(DONE, String(Date.now())); } catch { /* ignore */ }
  return res;
}

/** Ask every part of the site (anime and manga) to import again on its next visit, and import here now. */
export async function importEverywhere(): Promise<ImportResult> {
  const l = getLink();
  if (l) saveLink({ ...l, importAt: Date.now() });
  return importAniList(partHere());
}

const partHere = (): 'anime' | 'manga' | 'both' => {
  const h = onProd() ? hostSection() : null;
  return h === 'anime' ? 'anime' : h === 'manga' ? 'manga' : 'both';
};

/**
 * Each site keeps its own lists, so the anime site imports the anime half and the manga site the manga half,
 * the first time you open it after connecting AniList (or after pressing "Import" anywhere).
 */
export async function autoImport(): Promise<void> {
  const l = getLink();
  if (!l?.importAt) return;
  let done = 0;
  try { done = Number(localStorage.getItem(DONE)) || 0; } catch { /* ignore */ }
  if (done >= l.importAt) return;
  const part = partHere();
  if (onProd() && part === 'both') return; // the cinema site has no anime / manga lists to fill
  try {
    await importAniList(part);
  } catch { /* try again next visit */ }
}

const pushed = new Set<string>();

/** Watched episode N / read chapter N: raise your AniList progress to N (never lowers it). Quietly does nothing when off. */
export async function reportProgress(mediaId: number, progress: number, total: number | null) {
  const l = getLink();
  if (!l || !l.sync || !(progress > 0)) return;
  const tag = `${mediaId}:${progress}`;
  if (pushed.has(tag)) return;
  pushed.add(tag);
  try {
    const d = await call(l.token, 'query($id:Int){ Media(id:$id){ mediaListEntry{ progress status } } }', { id: mediaId });
    const cur = d?.Media?.mediaListEntry;
    if (cur && (Number(cur.progress) || 0) >= progress) return;
    const status = total && progress >= total ? 'COMPLETED' : 'CURRENT';
    await call(l.token, 'mutation($id:Int,$p:Int,$s:MediaListStatus){ SaveMediaListEntry(mediaId:$id, progress:$p, status:$s){ id } }', { id: mediaId, p: progress, s: status });
  } catch {
    pushed.delete(tag); // try again next time
  }
}
