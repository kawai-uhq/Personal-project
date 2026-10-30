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

async function post(path: string, body: unknown, bearer?: string): Promise<Reply> {
  if (!authConfigured) throw new AuthError("Sign-in isn't set up yet.");
  let r: Response;
  try {
    r = await fetch(`${BASE}/auth/v1${path}`, {
      method: 'POST',
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
  if (lower.includes('not confirmed')) return 'Confirm your email first (check your inbox), or sign in with an email code.';
  if (lower.includes('expired') || lower.includes('token') || lower.includes('otp'))
    return 'That code is wrong or has expired.';
  return raw || fallback;
}

export async function sendCode(email: string): Promise<void> {
  const r = await post('/otp', { email, create_user: true });
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "Couldn't send the code. Try again."));
}

/** Check an emailed code: 'email' for sign-in codes, 'signup' for the code that confirms a new account. */
export async function verifyCode(email: string, code: string, type: 'email' | 'signup' = 'email'): Promise<Session> {
  const r = await post('/verify', { type, email, token: code });
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "That code didn't work. Try again."));
  const s = toSession(r.body, email);
  if (!s) throw new AuthError('Sign-in failed. Please try again.');
  return s;
}

/** Send the new-account confirmation code again. */
export async function resendSignup(email: string): Promise<void> {
  const r = await post('/resend', { type: 'signup', email });
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "Couldn't resend the code. Try again."));
}

/** Email + password sign-in. */
export async function signInPassword(email: string, password: string): Promise<Session> {
  const r = await post('/token?grant_type=password', { email, password });
  if (r.code < 200 || r.code > 299) throw new AuthError(errorText(r, "Couldn't sign in. Try again."));
  const s = toSession(r.body, email);
  if (!s) throw new AuthError('Sign-in failed. Please try again.');
  return s;
}

/** Create an account. Returns a session, or null when Supabase wants the email confirmed first. */
export async function signUpPassword(email: string, password: string, username: string): Promise<Session | null> {
  const r = await post('/signup', { email, password, data: username ? { username } : {} });
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
