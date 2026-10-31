// Vercel serverless function: lets a signed-in person delete their own Comvie account.
// Needs two server-only environment variables in Vercel (never VITE_…):
//   SUPABASE_URL         https://<ref>.supabase.co   (falls back to VITE_SUPABASE_URL)
//   SUPABASE_SECRET_KEY  the "secret" key (sb_secret_…) or the legacy service_role key
// The person's own sign-in token proves who they are; their rows go with the account (on delete cascade).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });

  const base = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base.startsWith('https://') || !secret) {
    return res.status(500).json({ error: "Account deletion isn't set up yet. Contact us and we'll delete it for you." });
  }

  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in again, then try once more.' });

  // the secret key goes in "apikey"; a legacy service_role key (a JWT) also goes in Authorization
  const admin = { apikey: secret, ...(secret.startsWith('eyJ') ? { Authorization: `Bearer ${secret}` } : {}) };

  try {
    // 1. who is asking (checked with their own token)
    const who = await fetch(`${base}/auth/v1/user`, { headers: { apikey: secret, Authorization: `Bearer ${token}` } });
    if (!who.ok) return res.status(401).json({ error: 'Your sign-in has expired. Sign in again, then try once more.' });
    const user = await who.json();
    if (!user?.id) return res.status(401).json({ error: 'Sign in again, then try once more.' });

    // 2. delete the account (favorites, history and library rows are removed with it)
    const del = await fetch(`${base}/auth/v1/admin/users/${encodeURIComponent(user.id)}`, { method: 'DELETE', headers: admin });
    if (!del.ok && del.status !== 404) {
      return res.status(502).json({ error: "Couldn't delete the account right now. Try again, or contact us." });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ error: "Couldn't reach the account server. Try again." });
  }
}
