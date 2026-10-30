// Step 1 of the daily guide build: decide which TV-guide sites to grab for the channels we can actually stream.
// Writes epg-work/<site>.channels.xml files and epg-work/sites.txt (one site per line).
import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://iptv-org.github.io/api';
const MAX_SITES = Number(process.env.MAX_SITES || 14);
const PER_SITE = Number(process.env.PER_SITE || 160);

const get = async (f) => {
  const r = await fetch(`${API}/${f}`);
  if (!r.ok) throw new Error(`${f}: ${r.status}`);
  return r.json();
};

const [channels, streams, guides] = await Promise.all([get('channels.json'), get('streams.json'), get('guides.json')]);
const streamable = new Set(streams.filter((s) => s?.url && String(s.url).startsWith('https://')).map((s) => s.channel));
const ok = new Set(channels.filter((c) => !c.is_nsfw && !c.closed && streamable.has(c.id)).map((c) => c.id));

const bySite = new Map();
for (const g of guides) {
  if (!g?.channel || !ok.has(g.channel) || !g.site || !g.site_id) continue;
  const list = bySite.get(g.site) ?? new Map();
  if (!list.has(g.channel)) list.set(g.channel, g);
  bySite.set(g.site, list);
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sites = [...bySite.entries()].sort((a, b) => b[1].size - a[1].size).slice(0, MAX_SITES);

await mkdir('epg-work', { recursive: true });
const lines = [];
for (const [site, map] of sites) {
  const rows = [...map.values()].slice(0, PER_SITE);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<channels>\n${rows
    .map((g) => `  <channel site="${esc(g.site)}" site_id="${esc(g.site_id)}" lang="${esc(g.lang || 'en')}" xmltv_id="${esc(g.channel)}">${esc(g.site_name || g.channel)}</channel>`)
    .join('\n')}\n</channels>\n`;
  await writeFile(`epg-work/${site}.channels.xml`, xml);
  lines.push(site);
  console.log(site, rows.length);
}
await writeFile('epg-work/sites.txt', lines.join('\n') + '\n');
