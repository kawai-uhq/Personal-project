// Vercel serverless function: forwards read-only requests to TMDB with the secret token,
// so visitors never need (or see) a token.
const ALLOWED = /^\/(trending|movie|tv|search|discover|person|watch|collection)\/[\w\-\/.?=&,%+|'()!*~]*$/;

export default async function handler(req, res) {
  const token = process.env.TMDB_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "The site isn't configured yet (TMDB_TOKEN is missing)." });
  }

  const raw = req.query.path;
  const path = Array.isArray(raw) ? raw[0] : raw;
  if (typeof path !== 'string' || path.length > 300 || !ALLOWED.test(path)) {
    return res.status(400).json({ error: 'Bad request.' });
  }

  try {
    const upstream = await fetch('https://api.themoviedb.org/3' + path, {
      headers: { Authorization: `Bearer ${token}`, accept: 'application/json' }
    });
    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json');
    if (upstream.ok) {
      res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    }
    return res.status(upstream.status).send(text);
  } catch {
    return res.status(502).json({ error: "Couldn't reach TMDB. Try again." });
  }
}
