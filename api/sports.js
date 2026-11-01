// Vercel serverless function: relays ppv.st's live-sports schedule and lets Vercel's CDN cache it for a minute,
// so every visitor shares one request instead of each browser asking ppv.st (which may also block other sites).
const UPSTREAM = 'https://ppv.st/api/streams';

export default async function handler(req, res) {
  try {
    const up = await fetch(UPSTREAM, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; comvie/1.0; +https://comvie.lol)'
      }
    });
    const text = await up.text();
    let ok = up.ok;
    try {
      JSON.parse(text);
    } catch {
      ok = false; // an HTML error / challenge page instead of the schedule
    }
    if (!ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: "Couldn't load the sports schedule. Try again in a minute." });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).send(text);
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: "Couldn't reach the sports schedule. Try again in a minute." });
  }
}
