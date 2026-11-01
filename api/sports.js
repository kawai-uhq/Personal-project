// Vercel serverless function: relays ppv.st's live-sports schedule (https://ppv.st/api) and lets Vercel's CDN
// cache it for a minute, so every visitor shares one request (ppv.st asks API users to poll about once a minute).
// If the main API host fails, the mirror domains from ppv.st's /api/ping endpoint are tried.
const MAIN = 'https://api.ppv.st';
const KNOWN = ['https://api.ppv.to'];
const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
};

const apiBase = (d) => {
  const host = String(d).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return host ? `https://${host.startsWith('api.') ? host : 'api.' + host}` : null;
};

async function get(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const up = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    const text = await up.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* an HTML error / challenge page */
    }
    return { ok: up.ok && !!json, status: up.status, json, text };
  } catch {
    return { ok: false, status: 0, json: null, text: '' };
  } finally {
    clearTimeout(t);
  }
}

export default async function handler(req, res) {
  const tried = [];
  const bases = [MAIN];
  // mirror list, so a domain move doesn't break the page
  const ping = await get(`${MAIN}/api/ping`);
  if (ping.ok && Array.isArray(ping.json?.domains)) bases.push(...ping.json.domains.map(apiBase).filter(Boolean));
  bases.push(...KNOWN);

  for (const base of [...new Set(bases)]) {
    const r = await get(`${base}/api/streams`);
    if (r.ok && r.json?.success !== false) {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).send(r.text);
    }
    tried.push(`${new URL(base).host}: ${r.status || 'unreachable'}`);
  }
  // details only in Vercel's function logs, never in what visitors can see
  console.error('[sports] every source failed:', tried.join(', '));
  res.setHeader('Cache-Control', 'no-store');
  return res.status(502).json({ error: 'The sports schedule is unavailable right now.' });
}
