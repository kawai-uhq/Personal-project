import { useEffect, useState } from 'react';
import { onSharedHost } from './shared';

/**
 * Cookie consent. Comvie itself only stores what it needs to work (sign-in, settings, your lists). The optional
 * part is third-party media: the video players and YouTube trailers load from other sites, which can set their
 * own cookies. With "Essential only", those wait until you tap to load them.
 * The choice is shared by cinema., anime. and manga.comvie.lol.
 */
export interface Consent { media: boolean; at: number; v: 1 }

const KEY = 'comvie.consent';
const COOKIE = 'cv_consent';
const EVT = 'comvie:consent';
const OPEN = 'comvie:consent-open';

export function getConsent(): Consent | null {
  try {
    if (onSharedHost()) {
      const m = document.cookie.match(/(?:^|; )cv_consent=([^;]*)/);
      if (m) return JSON.parse(decodeURIComponent(m[1])) as Consent;
    }
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch {
    return null;
  }
}

export function setConsent(media: boolean) {
  const c: Consent = { media, at: Date.now(), v: 1 };
  const raw = JSON.stringify(c);
  try { localStorage.setItem(KEY, raw); } catch { /* ignore */ }
  if (onSharedHost()) {
    try {
      document.cookie = `${COOKIE}=${encodeURIComponent(raw)}; Domain=.comvie.lol; Path=/; Secure; SameSite=Lax; Max-Age=${180 * 86400}`;
    } catch { /* ignore */ }
  }
  window.dispatchEvent(new Event(EVT));
}

/** Show the banner again (footer "Cookie settings"). */
export const openConsent = () => window.dispatchEvent(new Event(OPEN));
export const onOpenConsent = (f: () => void) => {
  window.addEventListener(OPEN, f);
  return () => window.removeEventListener(OPEN, f);
};

/** Current choice, re-rendering when it changes. null = not chosen yet (treated as "load media" so nothing breaks). */
export function useConsent(): Consent | null {
  const [c, setC] = useState(getConsent);
  useEffect(() => {
    const f = () => setC(getConsent());
    window.addEventListener(EVT, f);
    window.addEventListener('focus', f);
    return () => {
      window.removeEventListener(EVT, f);
      window.removeEventListener('focus', f);
    };
  }, []);
  return c;
}

/** May third-party players / trailers load on their own? */
export const mediaAllowed = (c: Consent | null) => !c || c.media;
