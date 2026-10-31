import { useEffect, useState } from 'react';
import { animeStore } from './animeStore';
import type { AniLite } from './anilist';
import { mangaStore } from './mangaStore';
import type { MangaLite } from './manga';
import { onSharedHost } from './shared';

/**
 * Connect an AniList account (AniList's "implicit grant" sign-in): import your AniList lists into Comvie,
 * and update your AniList progress as you watch and read. Needs VITE_ANILIST_CLIENT_ID (a free AniList API client
 * whose redirect URL is https://anime.comvie.lol/account).
 */
export const ANILIST_CLIENT_ID = ((import.meta.env.VITE_ANILIST_CLIENT_ID as string | undefined) ?? '').trim();
export const anilistReady = /^\d+$/.test(ANILIST_CLIENT_ID);
export const connectUrl = () => `https://anilist.co/api/v2/oauth/authorize?client_id=${ANILIST_CLIENT_ID}&response_type=token`;

export interface AniLink { token: string; exp: number; id: number; name: string; avatar: string | null; sync: boolean }

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
    saveLink({ token, exp: Date.now() + secs * 1000, id: d.Viewer.id, name: d.Viewer.name, avatar: d.Viewer.avatar?.medium ?? null, sync: true });
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

/** Copy your AniList "Watching / Reading" and "Planning" lists into Comvie. Returns how many titles were added. */
export async function importAniList(): Promise<{ anime: number; manga: number }> {
  const l = getLink();
  if (!l) throw new Error('Connect AniList first.');
  const q = (type: 'ANIME' | 'MANGA') =>
    call(l.token, `query($u:Int,$t:MediaType){ MediaListCollection(userId:$u, type:$t, status_in:[CURRENT, PLANNING, REPEATING]){ lists{ entries{ status progress media{ ${LT} } } } } }`, { u: l.id, t: type });
  const [a, m] = await Promise.all([q('ANIME'), q('MANGA')]);
  const entries = (d: any) => ((d?.MediaListCollection?.lists ?? []) as any[]).flatMap((x) => x.entries ?? []);
  const title = (o: any) => o.title?.english || o.title?.romaji || 'Untitled';
  const cover = (o: any) => o.coverImage?.extraLarge || o.coverImage?.large || '';

  let na = 0;
  const haveA = new Set(animeStore.list().map((x) => x.id));
  for (const e of entries(a)) {
    const o = e.media;
    if (!o?.id) continue;
    const lite: AniLite = { id: o.id, title: title(o), cover: cover(o), score: o.averageScore ?? 0, format: o.format ?? null, year: o.seasonYear ?? o.startDate?.year ?? null, episodes: o.episodes ?? null };
    if (!haveA.has(o.id)) { animeStore.toggle('list', lite); haveA.add(o.id); na++; }
    const prog = Number(e.progress) || 0;
    if (prog > 0) animeStore.seenUpTo(o.id, prog);
  }
  let nm = 0;
  const haveM = new Set(mangaStore.list().map((x) => x.id));
  for (const e of entries(m)) {
    const o = e.media;
    if (!o?.id || haveM.has(o.id)) continue;
    const lite: MangaLite = { id: o.id, title: title(o), cover: cover(o), score: o.averageScore ?? 0, format: o.format ?? null, year: o.startDate?.year ?? null, chapters: o.chapters ?? null, country: o.countryOfOrigin ?? null };
    mangaStore.toggleList(lite);
    haveM.add(o.id);
    nm++;
  }
  return { anime: na, manga: nm };
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
