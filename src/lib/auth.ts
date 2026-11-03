import type { Session } from './types';

/**
 * The project address, cleaned up: only "https://<ref>.supabase.co" is kept, so a value pasted with
 * "/rest/v1/" on the end, or the dashboard link (supabase.com/dashboard/project/<ref>), still works.
 */
function projectUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  const dash = /supabase\.com\/dashboard\/project\/([a-z0-9]+)/i.exec(v);
  if (dash) return `https://${dash[1]}.supabase.co`;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.origin;
  } catch {
    return v.replace(/\/+$/, '');
  }
}
const BASE = projectUrl((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '');
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';

export const authConfigured = BASE.startsWith('http') && KEY.length > 0;
/**
 * Sign-in shows a "coming soon" notice until the Supabase keys are added, or whenever
 * VITE_SIGNIN_COMING_SOON=true is set (handy to hide it while testing keys).
 */
export const signInComingSoon =
  !authConfigured || (import.meta.env.VITE_SIGNIN_COMING_SOON as string | undefined) === 'true';
export const supabaseBase = BASE;
export const supabaseKey = KEY;

/** Error with a message that is safe to show to the user. */
export class AuthError extends Error {}

interface Reply {
  code: number;
  body: any;
}

async function post(path: string, body: unknown, bearer?: string, method = 'POST'): Promise<Reply> {
  if (!authConfigured) throw new AuthError("Sign-in isn't set up yet.");
  let r: Response;
  try {
    r = await fetch(`${BASE}/auth/v1${path}`, {
      method,
      headers: {
        apikey: KEY,
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {})
      },
      body: JSON.stringify(body)
    });
  } catch {
    throw new AuthError("Can't reach the server. Check your internet connection.");
  }
  let json: any = {};
  try {
    json = await r.json();
  } catch {
    /* empty body */
  }
  return { code: r.status, body: json };
}

function toSession(b: any, fallbackEmail: string): Session | null {
  if (!b?.access_token || !b?.refresh_token) return null;
  return {
    accessToken: b.access_token,
    refreshToken: b.refresh_token,
    expiresAt: Date.now() + (Number(b.expires_in) || 3600) * 1000,
    email: b.user?.email || fallbackEmail
  };
}

function errorText(reply: Reply, fallback: string): string {
  const b = reply.body ?? {};
  const raw: string = [b.msg, b.error_description, b.message, b.error].find((x) => x) ?? '';
  const lower = String(raw).toLowerCase();
  if (reply.code === 429 || lower.includes('rate limit') || lower.includes('security purposes'))
    return 'Too many attempts. Wait a minute and try again.';
  if (lower.includes('not authorized'))
    return "Supabase's built-in email only sends to your own team. Set up custom SMTP in Supabase.";
  if (lower.includes('error sending'))
    return "The email couldn't be sent. Check the SMTP settings in Supabase.";
  if (lower.includes('invalid login')) return 'Wrong email or password.';
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return 'An account with this email already exists. Sign in instead.';
  if (lower.includes('at least') && lower.includes('password')) return 'Password must be at least 6 characters.';
  if (lower.includes('not confirmed')) return 'Confirm your email first: open the link in the email we sent you, then sign in.';
  if (lower.includes('captcha')) return 'The verification check failed or expired. Tick it again and retry.';
  if (lower.includes('different from the old')) return 'Choose a password different from your old one.';
  if (lower.includes('expired') || lower.includes('otp') || (lower.includes('token') && lower.includes('invalid')))
    return 'That code is wrong or has expired.';
  return raw || fallback;
}

/** Cloudflare Turnstile site key (public). With it set, sign-in and sign-up show the "Verify you are human" box,
 *  and Supabase checks the result (Supabase: Authentication → Attack Protection → Captcha → Turnstile). */
export const turnstileSiteKey = ((import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '').trim();

const withCaptcha = (body: Record<string, unknown>, captcha?: string) =>
  captcha ? { ...body, gotrue_meta_security: { captcha_token: captcha } } : body;

/** "Forgot password": email a one-time sign-in code (only to existing accounts). */
export async function sendCode(email: string, captcha?: string): Promise<void> {
  const r = await post('/otp', withCaptcha({ email, create_user: false }, captcha));
  if (r.code < 200 || r.code > 299) {
    // Supabase answers "Signups not allowed for otp" when there's no account with this email
    const raw = JSON.stringify(r.body ?? {});
    if (/signups? not allowed/i.test(raw)) throw new AuthError('There is no account with this email. Register instead.');
    throw new AuthError(errorText(r, "Couldn't send the code. Try again."));
  }
}

/** Sign in with the emailed code. */
export async function verifyCode(email: string, code: string): Promise<Session> {
  const r = await post('/verify', { type: 'email', email, token: code });
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "That code didn't work. Try again."));
  const s = toSession(r.body, email);
  if (!s) throw new AuthError('Sign-in failed. Please try again.');
  return s;
}

/** Set a new password for the signed-in account. */
export async function updatePassword(accessToken: string, password: string): Promise<void> {
  const r = await post('/user', { password }, accessToken, 'PUT');
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "Couldn't save the new password. Try again."));
}

/** Email + password sign-in. */
export async function signInPassword(email: string, password: string, captcha?: string): Promise<Session> {
  const r = await post('/token?grant_type=password', withCaptcha({ email, password }, captcha));
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "Couldn't sign in. Try again."));
  const s = toSession(r.body, email);
  if (!s) throw new AuthError('Sign-in failed. Please try again.');
  return s;
}

/** Create an account. Returns a session, or null when Supabase wants the email confirmed first. */
export async function signUpPassword(email: string, password: string, username: string, captcha?: string): Promise<Session | null> {
  const r = await post('/signup', withCaptcha({ email, password, data: username ? { username } : {} }, captcha));
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "Couldn't create the account. Try again."));
  return toSession(r.body, email);
}

export type RefreshResult =
  | { kind: 'ok'; session: Session }
  | { kind: 'rejected' }
  | { kind: 'offline' };

export async function refreshSession(refreshToken: string, email: string): Promise<RefreshResult> {
  let r: Reply;
  try {
    r = await post('/token?grant_type=refresh_token', { refresh_token: refreshToken });
  } catch {
    return { kind: 'offline' };
  }
  if (r.code >= 200 && r.code <= 299) {
    const s = toSession(r.body, email);
    return s ? { kind: 'ok', session: s } : { kind: 'offline' };
  }
  if (r.code === 400 || r.code === 401 || r.code === 403) return { kind: 'rejected' };
  return { kind: 'offline' };
}

export async function signOutRemote(accessToken: string): Promise<void> {
  if (!accessToken) return;
  try {
    await post('/logout', {}, accessToken);
  } catch {
    /* already signed out locally */
  }
}

/** Change the account's email: Supabase emails a confirmation link to the new address (and the old one, if
 *  "Secure email change" is on); the change happens when the link is opened. */
export async function updateEmail(accessToken: string, email: string): Promise<void> {
  const r = await post('/user', { email }, accessToken, 'PUT');
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "Couldn't change the email. Try again."));
}

/** The signed-in account as Supabase sees it (email, username, how they signed in). */
export async function getUser(accessToken: string): Promise<{ id: string; email: string; username: string; providers: string[] } | null> {
  try {
    const r = await fetch(`${BASE}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return null;
    const u = await r.json();
    return {
      id: u.id,
      email: u.email || '',
      username: String(u.user_metadata?.username || u.user_metadata?.preferred_username || u.user_metadata?.name || ''),
      providers: ((u.identities ?? []) as any[]).map((i) => String(i.provider))
    };
  } catch {
    return null;
  }
}

export type OAuthProvider = 'discord';

/** Where "Continue with Discord" goes. Supabase sends the person back to this page with the sign-in in the
 *  address (#access_token=…). Discord also asks to join the Discord server ("guilds.join"). */
export function oauthUrl(provider: OAuthProvider): string {
  const back = `${location.origin}${location.pathname}`;
  const scopes = provider === 'discord' ? 'identify email guilds.join' : '';
  return `${BASE}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(back)}${scopes ? `&scopes=${encodeURIComponent(scopes)}` : ''}`;
}

/** Link Discord to the account that's signed in now (needs "Manual linking" on in Supabase). Sends the browser to Discord. */
export async function linkDiscord(accessToken: string): Promise<void> {
  const back = `${location.origin}${location.pathname}`;
  const q = `provider=discord&redirect_to=${encodeURIComponent(back)}&scopes=${encodeURIComponent('identify email guilds.join')}&skip_http_redirect=true`;
  let r: Response;
  try {
    r = await fetch(`${BASE}/auth/v1/user/identities/authorize?${q}`, { headers: { apikey: KEY, Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new AuthError('Check your connection and try again.');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) {
    console.error('[auth] link Discord', r.status, j);
    if (/manual linking/i.test(JSON.stringify(j))) throw new AuthError("Connecting Discord isn't switched on yet. Try again later.");
    if (/already/i.test(JSON.stringify(j))) throw new AuthError('That Discord account is already connected to another Comvie account.');
    throw new AuthError("Couldn't start connecting Discord. Try again.");
  }
  markOAuthStart();
  location.href = j.url;
}

// The address's "#…" and "?…" exactly as the page opened with them. Other start-up code (e.g. the AniList connect
// return) also reads and tidies the address, so the sign-in is always taken from this copy.
const HASH_AT_LOAD = typeof location !== 'undefined' ? location.hash : '';
const SEARCH_AT_LOAD = typeof location !== 'undefined' ? location.search : '';
const PENDING = 'comvie.oauthPending';
let oauthTaken = false;

/** Note that a Discord sign-in / connect was started in this tab (so an error coming back is known to be ours). */
export function markOAuthStart() {
  try { sessionStorage.setItem(PENDING, String(Date.now())); } catch { /* storage blocked */ }
}
const oauthPending = () => {
  try {
    const t = Number(sessionStorage.getItem(PENDING) || 0);
    sessionStorage.removeItem(PENDING);
    return Date.now() - t < 30 * 60 * 1000;
  } catch {
    return false;
  }
};

/** A Comvie (Supabase) sign-in in an address "#…": it always carries a refresh token, an AniList return never does. */
export const isSignInHash = (hash: string) => /(^|[#&])(refresh_token|provider_token)=/.test(hash);

const claimsOf = (jwt: string): Record<string, unknown> => {
  try {
    return JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return {};
  }
};

/** The sign-in Supabase put in the address after Discord (and tidies it out of the address bar). */
export function takeOAuthResult(): { session: Session; providerToken: string | null } | { error: string } | null {
  if (oauthTaken || typeof location === 'undefined') return null;
  const h = new URLSearchParams(HASH_AT_LOAD.replace(/^#/, ''));
  const q = new URLSearchParams(SEARCH_AT_LOAD.replace(/^\?/, ''));
  const tidy = () => {
    try {
      const keep = new URLSearchParams(location.search);
      ['error', 'error_code', 'error_description'].forEach((k) => keep.delete(k));
      const qs = keep.toString();
      history.replaceState(history.state, '', location.pathname + (qs ? `?${qs}` : ''));
    } catch { /* ignore */ }
  };

  const access = h.get('access_token');
  const refresh = h.get('refresh_token');
  if (access && refresh) {
    oauthTaken = true;
    oauthPending(); // clear the marker
    tidy();
    return {
      session: { accessToken: access, refreshToken: refresh, expiresAt: Date.now() + (Number(h.get('expires_in')) || 3600) * 1000, email: String(claimsOf(access).email || '') },
      providerToken: h.get('provider_token')
    };
  }

  // an error coming back from a Discord sign-in this tab started (in the "#…" or, for some errors, the "?…")
  const err = h.get('error_description') || h.get('error') || q.get('error_description') || q.get('error');
  if (err && oauthPending()) {
    oauthTaken = true;
    tidy();
    console.error('[auth] Discord sign-in came back with an error', err, h.get('error_code') || q.get('error_code') || '');
    return { error: /identity.*already|already.*linked/i.test(err) ? 'That Discord account is already connected to another Comvie account.' : err.replace(/\+/g, ' ') };
  }
  return null;
}
