// Step 3: fold every grabbed guide into one small public/epg.json (programmes from 3 h ago to 48 h ahead).
import { readdir, readFile, writeFile } from 'node:fs/promises';

const dir = 'epg-out';
const now = Date.now() / 1000;
const FROM = now - 3 * 3600;
const TO = now + 48 * 3600;

const ts = (s) => {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/.exec(s || '');
  if (!m) return NaN;
  const off = m[7] ? (m[7][0] === '-' ? -1 : 1) * (Number(m[7].slice(1, 3)) * 60 + Number(m[7].slice(3, 5))) : 0;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) / 1000 - off * 60;
};
const unesc = (s) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&').trim();

const out = {};
let files = [];
try {
  files = (await readdir(dir)).filter((f) => f.endsWith('.xml'));
} catch {
  /* nothing grabbed */
}
for (const f of files) {
  const xml = await readFile(`${dir}/${f}`, 'utf8');
  const re = /<programme\b([^>]*)>([\s\S]*?)<\/programme>/g;
  let m;
  while ((m = re.exec(xml))) {
    const a = m[1];
    const ch = /channel="([^"]*)"/.exec(a)?.[1];
    const s = ts(/start="([^"]*)"/.exec(a)?.[1]);
    const e = ts(/stop="([^"]*)"/.exec(a)?.[1]);
    const title = /<title[^>]*>([\s\S]*?)<\/title>/.exec(m[2])?.[1];
    if (!ch || !title || !(s < TO) || !(e > FROM) || !(e > s)) continue;
    const sub = /<sub-title[^>]*>([\s\S]*?)<\/sub-title>/.exec(m[2])?.[1];
    const t = unesc(title) + (sub && unesc(sub) ? ` — ${unesc(sub)}` : '');
    (out[unesc(ch)] ??= []).push([s, e, t.slice(0, 120)]);
  }
}
let n = 0;
for (const k of Object.keys(out)) {
  const seen = new Set();
  out[k] = out[k].sort((x, y) => x[0] - y[0]).filter((p) => (seen.has(p[0]) ? false : (seen.add(p[0]), true)));
  n += out[k].length;
}
if (!n) {
  console.log('No programmes grabbed; keeping the previous epg.json');
  process.exit(0);
}
await writeFile('public/epg.json', JSON.stringify({ t: Math.round(now), p: out }));
console.log(Object.keys(out).length, 'channels,', n, 'programmes');
