// Vercel serverless function: robots.txt and sitemap.xml for whichever Comvie sub-domain asked.
const PAGES = {
  cinema: ['/', '/movies', '/tv', '/live', '/sports', '/genres', '/providers', '/collections', '/search'],
  anime: ['/', '/explore', '/genres', '/studios', '/search'],
  manga: ['/', '/explore', '/genres', '/publishers', '/search'],
  shared: ['/about', '/help', '/contact', '/legal/terms', '/legal/privacy', '/legal/dmca']
};

export default function handler(req, res) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'cinema.comvie.lol').split(',')[0].trim().toLowerCase();
  const safeHost = /^[a-z0-9.-]+$/.test(host) ? host : 'cinema.comvie.lol';
  const origin = `https://${safeHost}`;
  const section = safeHost.startsWith('anime.') ? 'anime' : safeHost.startsWith('manga.') ? 'manga' : 'cinema';
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');

  if (req.query.file === 'robots') {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /account\nDisallow: /watch/\nDisallow: /read/\n\nSitemap: ${origin}/sitemap.xml\n`);
  }

  const urls = [...PAGES[section], ...PAGES.shared]
    .map((p) => `  <url><loc>${origin}${p}</loc><changefreq>${p === '/' ? 'daily' : 'weekly'}</changefreq></url>`)
    .join('\n');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
}
