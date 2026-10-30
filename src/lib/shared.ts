/**
 * Settings shared by cinema., anime. and manga.comvie.lol.
 * Browser storage is separate per sub-domain, so these few small values also live in one cookie on ".comvie.lol"
 * that all three can read. Off the real site (localhost, previews) they simply stay in normal storage.
 */
const COOKIE = 'cv_prefs';
const DAYS = 400;

/** Keys kept in the shared cookie (appearance and playback settings). */
export const SHARED_KEYS = ['comvie.prefs', 'comvie.remember', 'comvie.autoplay2', 'comvie.autoskip2', 'comvie.protect2'];

export const onSharedHost = () => typeof location !== 'undefined' && /(^|\.)comvie\.lol$/.test(location.hostname);
export const isSharedKey = (k: string) => SHARED_KEYS.includes(k);

function readAll(): Record<string, string> {
  try {
    const m = document.cookie.match(/(?:^|; )cv_prefs=([^;]*)/);
    return m ? (JSON.parse(decodeURIComponent(m[1])) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** The shared raw value for a key, or undefined when none has been shared yet. */
export function sharedGet(key: string): string | undefined {
  if (!onSharedHost()) return undefined;
  const all = readAll();
  return Object.prototype.hasOwnProperty.call(all, key) ? all[key] : undefined;
}

/** Save (or with null, remove) a raw value in the shared cookie. */
export function sharedSet(key: string, raw: string | null) {
  if (!onSharedHost()) return;
  try {
    const all = readAll();
    if (raw === null) delete all[key];
    else all[key] = raw;
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(all))}; Domain=.comvie.lol; Path=/; Secure; SameSite=Lax; Max-Age=${DAYS * 86400}`;
  } catch {
    /* cookies blocked: settings stay on this sub-domain */
  }
}

/** Before the shared cookie existed, settings were per sub-domain: share this one's the first time round. */
export function seedShared() {
  if (!onSharedHost()) return;
  const all = readAll();
  for (const k of SHARED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(all, k)) continue;
    try {
      const v = localStorage.getItem(k);
      if (v !== null) sharedSet(k, v);
    } catch { /* ignore */ }
  }
}
