// Vercel serverless function: "Popular on comvie" — which titles visitors actually played this week.
//   GET  /api/popular?kind=cinema|anime   -> { items: [{ k: "movie:603", plays: 12 }, ...] }  (CDN-cached 10 minutes)
//   POST /api/popular  { k }              -> counts one play
// Uses the public Supabase settings (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) and the title_plays table /
// record_play() / top_titles() from supabase/schema.sql. Without Supabase it answers with an empty list.
const KEY = /^(movie|tv|anime):[0-9]{1,9}$/;
const hits = new Map(); // ip -> [timestamps]; best-effort limit per warm instance

const env = () => ({
  url: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
  key: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
});

export default async function handler(req, res) {
  const { url, key } = env();
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' };

  if (req.method === 'GET') {
    const kind = req.query.kind === 'anime' ? 'anime' : 'cinema';
    if (!url || !key) {
      res.setHeader('Cache-Control', 'public, s-maxage=3600');
      return res.status(200).json({ items: [] });
    }
    try {
      const r = await fetch(`${url}/rest/v1/rpc/top_titles`, { method: 'POST', headers, body: JSON.stringify({ p_kind: kind, p_days: 7, p_limit: 24 }) });
      const rows = r.ok ? await r.json() : [];
      const items = (Array.isArray(rows) ? rows : []).filter((x) => KEY.test(String(x.media_key))).map((x) => ({ k: x.media_key, plays: Number(x.plays) || 0 }));
      res.setHeader('Cache-Control', r.ok ? 'public, s-maxage=600, stale-while-revalidate=3600' : 'no-store');
      return res.status(200).json({ items });
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: [] });
    }
  }

  if (req.method === 'POST') {
    const ip = String(req.headers['x-forwarded-for'] || 'x').split(',')[0].trim();
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
    if (recent.length >= 20) return res.status(429).json({ error: 'Too many requests.' });
    hits.set(ip, [...recent, now]);
    let b = req.body;
    if (typeof b === 'string') {
      try {
        b = JSON.parse(b);
      } catch {
        b = null;
      }
    }
    if (!b || !KEY.test(String(b.k))) return res.status(400).json({ error: 'Bad request.' });
    if (!url || !key) return res.status(204).end();
    try {
      await fetch(`${url}/rest/v1/rpc/record_play`, { method: 'POST', headers, body: JSON.stringify({ p_key: b.k }) });
    } catch {
      /* best effort */
    }
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
