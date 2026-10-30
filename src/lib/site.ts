import type { Section } from './section';

/** The site lives on two sub-domains: cinema.comvie.lol and anime.comvie.lol (comvie.lol sends you to cinema). */
const ROOT = 'comvie.lol';
export const CINEMA_ORIGIN = `https://cinema.${ROOT}`;
export const ANIME_ORIGIN = `https://anime.${ROOT}`;

const host = () => (typeof location === 'undefined' ? '' : location.hostname);

/** true on comvie.lol and its sub-domains (false on localhost and preview links) */
export const onProd = () => host() === ROOT || host().endsWith('.' + ROOT);

/** Which section the current host stands for, or null when the host doesn't say (localhost, previews). */
export function hostSection(): Section | null {
  const h = host();
  if (!onProd()) return null;
  return h.startsWith('anime.') ? 'anime' : 'cinema';
}

/** Where a section's home is: its own sub-domain on the real site, a plain path elsewhere. */
export const sectionHome = (s: Section) => (onProd() ? (s === 'anime' ? `${ANIME_ORIGIN}/anime` : `${CINEMA_ORIGIN}/`) : s === 'anime' ? '/anime' : '/');

/** Pages both sub-domains share */
export const SHARED = ['/contact', '/about', '/help', '/legal', '/terms', '/privacy', '/takedown'];
export const isShared = (p: string) => SHARED.some((s) => p === s || p.startsWith(s + '/'));

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
