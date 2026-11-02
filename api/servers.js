// Vercel serverless function: shared server health (which streaming servers work for which title).
//   GET  /api/servers?k=movie:603            -> { servers: { cinesrc: { ok, fail }, ... } }  (CDN-cached for 2 minutes)
//   POST /api/servers  { k, s, ok }          -> records one "played" (ok: true) or "didn't play" (ok: false) vote
// Uses the same public Supabase settings as sign-in (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY); the table and
// the server_vote() function come from supabase/schema.sql. Without Supabase it answers with empty counts.
const KEY = /^(movie|tv|anime):[0-9]{1,9}$/;
const SERVER = /^[a-z0-9]{1,24}$/;
const hits = new Map(); // ip -> [timestamps]; best-effort limit per warm instance

const env = () => ({
  url: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
  key: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
});

export default async function handler(req, res) {
  const { url, key } = env();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  if (req.method === 'GET') {
    const k = String(req.query.k || '');
    if (!KEY.test(k)) return res.status(400).json({ error: 'Bad request.' });
    if (!url || !key) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600');
      return res.status(200).json({ servers: {} });
    }
    try {
      const r = await fetch(`${url}/rest/v1/server_health?media_key=eq.${encodeURIComponent(k)}&select=server,ok,fail`, { headers });
      const rows = r.ok ? await r.json() : [];
      const servers = {};
      for (const x of Array.isArray(rows) ? rows : []) servers[x.server] = { ok: Number(x.ok) || 0, fail: Number(x.fail) || 0 };
      res.setHeader('Cache-Control', r.ok ? 'public, s-maxage=120, stale-while-revalidate=600' : 'no-store');
      return res.status(200).json({ servers });
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ servers: {} });
    }
  }

  if (req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
    if (recent.length >= 40) return res.status(429).json({ error: 'Too many requests.' });
    hits.set(ip, [...recent, now]);

    let b = req.body;
    if (typeof b === 'string') {
      try {
        b = JSON.parse(b);
      } catch {
        b = null;
      }
    }
    if (!b || !KEY.test(String(b.k)) || !SERVER.test(String(b.s)) || typeof b.ok !== 'boolean') return res.status(400).json({ error: 'Bad request.' });
    if (!url || !key) return res.status(204).end();
    try {
      await fetch(`${url}/rest/v1/rpc/server_vote`, { method: 'POST', headers, body: JSON.stringify({ p_key: b.k, p_server: b.s, p_ok: b.ok }) });
    } catch {
      /* best effort */
    }
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
