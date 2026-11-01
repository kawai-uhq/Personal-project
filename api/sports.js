// Vercel serverless function: relays ppv.st's live-sports schedule and lets Vercel's CDN cache it for a minute,
// so every visitor shares one request instead of each browser asking ppv.st.
// ppv.st has moved domains before, so each known address is tried in turn.
const UPSTREAMS = ['https://ppv.st/api/streams', 'https://ppv.to/api/streams'];

export default async function handler(req, res) {
  const tried = [];
  for (const url of UPSTREAMS) {
    try {
      const up = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
        }
      });
      const text = await up.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* an HTML error / challenge page */
      }
      if (up.ok && json) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
        return res.status(200).send(text);
      }
      tried.push(`${new URL(url).host} ${up.status}${json ? '' : ' (not JSON)'}`);
    } catch (e) {
      tried.push(`${new URL(url).host} unreachable`);
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(502).json({ error: `ppv.st refused our server (${tried.join(', ')})` });
}
