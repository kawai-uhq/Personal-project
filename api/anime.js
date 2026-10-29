// Vercel serverless function: relays read-only AniList GraphQL queries and lets Vercel's CDN cache them.
// Every visitor shares the cached answers, so AniList's per-IP rate limit is rarely reached.
export default async function handler(req, res) {
  const raw = req.query.q;
  const q = Array.isArray(raw) ? raw[0] : raw;
  if (typeof q !== 'string' || q.length > 8000) return res.status(400).json({ error: 'Bad request.' });

  let body;
  try {
    const j = JSON.parse(q);
    if (typeof j.query !== 'string' || !/^\s*query\b/.test(j.query) || /mutation/i.test(j.query)) throw new Error('bad');
    body = JSON.stringify({ query: j.query, variables: j.variables && typeof j.variables === 'object' ? j.variables : {} });
  } catch {
    return res.status(400).json({ error: 'Bad request.' });
  }

  try {
    const up = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body
    });
    const text = await up.text();
    res.setHeader('Content-Type', 'application/json');
    if (up.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'no-store');
      const ra = up.headers.get('retry-after');
      if (ra) res.setHeader('Retry-After', ra);
    }
    return res.status(up.status).send(text);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: "Couldn't reach AniList. Try again." });
  }
}
