// Vercel serverless function: relays read-only MangaDex API calls (browsers can't call it directly) and lets the CDN cache them.
// Use: /api/md?p=/manga&title=...  (p is the MangaDex path; every other parameter is passed along)
const ID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ALLOWED = [new RegExp('^/manga$'), new RegExp(`^/manga/${ID}$`), new RegExp(`^/manga/${ID}/feed$`), new RegExp(`^/at-home/server/${ID}$`)];

export default async function handler(req, res) {
  let url;
  try {
    url = new URL(req.url, 'http://x');
  } catch {
    return res.status(400).json({ error: 'Bad request.' });
  }
  const path = url.searchParams.get('p') || '';
  if (!ALLOWED.some((r) => r.test(path))) return res.status(400).json({ error: 'Bad request.' });
  url.searchParams.delete('p');
  const qs = url.searchParams.toString();
  if (qs.length > 2000) return res.status(400).json({ error: 'Bad request.' });

  try {
    const up = await fetch(`https://api.mangadex.org${path}${qs ? '?' + qs : ''}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'ComvieReader/1.0 (comvie.lol)' }
    });
    const text = await up.text();
    res.setHeader('Content-Type', 'application/json');
    if (up.ok) {
      // image-server addresses expire, so those are only cached briefly
      res.setHeader('Cache-Control', path.startsWith('/at-home') ? 'public, s-maxage=60' : 'public, s-maxage=900, stale-while-revalidate=86400');
    } else {
      res.setHeader('Cache-Control', 'no-store');
      const ra = up.headers.get('retry-after');
      if (ra) res.setHeader('Retry-After', ra);
    }
    return res.status(up.status).send(text);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: "Couldn't reach the manga source. Try again." });
  }
}
