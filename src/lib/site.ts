import type { Section } from './section';

/** The site lives on two sub-domains: cinema.comvie.lol and anime.comvie.lol (comvie.lol sends you to cinema). */
const ROOT = 'comvie.lol';
export const CINEMA_ORIGIN = `https://cinema.${ROOT}`;
export const ANIME_ORIGIN = `https://anime.${ROOT}`;
export const MANGA_ORIGIN = `https://manga.${ROOT}`;
export const ORIGINS: Record<Section, string> = { cinema: CINEMA_ORIGIN, anime: ANIME_ORIGIN, manga: MANGA_ORIGIN };

const host = () => (typeof location === 'undefined' ? '' : location.hostname);

/** true on comvie.lol and its sub-domains (false on localhost and preview links) */
export const onProd = () => host() === ROOT || host().endsWith('.' + ROOT);

/** Which section the current host stands for, or null when the host doesn't say (localhost, previews). */
export function hostSection(): Section | null {
  const h = host();
  if (!onProd()) return null;
  return h.startsWith('anime.') ? 'anime' : h.startsWith('manga.') ? 'manga' : 'cinema';
}

/** Where a section's home is: its own sub-domain on the real site, a plain path elsewhere. */
export const sectionHome = (s: Section) => (onProd() ? `${ORIGINS[s]}/` : s === 'cinema' ? '/' : `/${s}`);

/** Pages both sub-domains share */
export const SHARED = ['/account', '/contact', '/about', '/help', '/legal', '/terms', '/privacy', '/takedown'];
export const isShared = (p: string) => SHARED.some((s) => p === s || p.startsWith(s + '/'));

// ---- clean addresses: anime.comvie.lol/explore instead of anime.comvie.lol/anime/explore ----
// Inside the app every anime page still lives under /anime/… and every manga page under /manga/…;
// on their own sub-domain the prefix is simply left out of the address bar.

/** "/anime/explore" -> "/explore" (for the given section) */
export function stripSection(path: string, s: Section): string {
  if (s === 'cinema') return path;
  const p = '/' + s;
  if (path === p) return '/';
  return path.startsWith(p + '/') ? path.slice(p.length) : path;
}

/** The address to show for an in-app path (prefix dropped on its own sub-domain). Use for links. */
export function toPublic(path: string): string {
  const hs = hostSection();
  return hs && hs !== 'cinema' ? stripSection(path, hs) : path;
}

/** The in-app path for the current address (prefix added back on the anime / manga sub-domains). */
export function toLogical(path: string): string {
  const hs = hostSection();
  if (!hs || hs === 'cinema' || isShared(path) || path === '/' + hs || path.startsWith('/' + hs + '/')) return path;
  return path === '/' ? '/' + hs : '/' + hs + path;
}

/** Cinema-only addresses (they always open on cinema.comvie.lol). */
export function isCinemaPath(p: string): boolean {
  return (
    ['/movies', '/tv', '/live', '/list', '/providers', '/collections'].includes(p) ||
    /^\/(person|provider|explore|genres|collection)\//.test(p) ||
    /^\/(title|watch)\/(movie|tv)\//.test(p)
  );
}

// ---- carrying saved data over from comvie.lol to cinema.comvie.lol (browser storage is per address) ----
const SKIP = 'comvie.ani.';
const TAG = '#cvmig=';

/** On comvie.lol: pack this browser's Comvie data into the link that opens cinema.comvie.lol. */
export function migrationHash(): string {
  try {
    const out: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('comvie.') && !k.startsWith(SKIP)) out[k] = localStorage.getItem(k) ?? '';
    }
    if (!Object.keys(out).length) return '';
    return TAG + btoa(unescape(encodeURIComponent(JSON.stringify(out))));
  } catch {
    return '';
  }
}

/** On arrival: unpack data from comvie.lol (never overwrites what's already here), then tidy the address bar. Run before the app starts. */
export function importMigration() {
  try {
    if (!location.hash.startsWith(TAG)) return;
    const data = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(TAG.length))))) as Record<string, string>;
    for (const [k, v] of Object.entries(data)) {
      if (k.startsWith('comvie.') && localStorage.getItem(k) === null) localStorage.setItem(k, v);
    }
  } catch {
    /* bad or blocked: ignore */
  }
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* ignore */
  }
}
