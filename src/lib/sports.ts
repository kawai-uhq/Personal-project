/** Live sports events from ppv.st (through our /api/sports relay). The parser is forgiving about the exact
 *  shape: it accepts categories with nested streams, or a flat list, and several names for each field. */

export interface SportEvent {
  id: string;
  name: string;
  /** League / competition ("NBA", "UFC 312", …) */
  tag: string;
  category: string;
  poster: string | null;
  /** Start / end as milliseconds since 1970 (0 = unknown) */
  start: number;
  end: number;
  /** A 24/7 channel rather than a single event */
  alwaysLive: boolean;
  /** The player address to put in the frame */
  embed: string;
  /** The event's own page on ppv.st (in case the player won't load here) */
  page: string;
  viewers: number;
}

const SITE = 'https://ppv.st';

const str = (...v: unknown[]) => {
  for (const x of v) if (typeof x === 'string' && x.trim()) return x.trim();
  for (const x of v) if (typeof x === 'number' && Number.isFinite(x)) return String(x);
  return '';
};

/** Seconds, milliseconds or a date string → milliseconds (0 when unknown) */
const time = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v < 1e12 ? v * 1000 : v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n < 1e12 ? n * 1000 : n;
    const d = Date.parse(v);
    return Number.isFinite(d) ? d : 0;
  }
  return 0;
};

const abs = (u: string) => (!u ? '' : u.startsWith('//') ? `https:${u}` : u.startsWith('/') ? SITE + u : u);

function toEvent(x: any, category: string): SportEvent | null {
  if (!x || typeof x !== 'object') return null;
  const name = str(x.name, x.title);
  const uri = str(x.uri_name, x.slug, x.uri);
  // the player: an explicit embed / iframe address, else ppv.st's embed page for this stream
  let embed = abs(str(x.iframe, x.embed, x.embed_url, x.iframe_url, x.player));
  if (embed.startsWith('<')) embed = abs(embed.match(/src=["']([^"']+)["']/i)?.[1] ?? '');
  if (!embed && uri) embed = `${SITE}/embed/${uri.replace(/^\/+/, '')}`;
  if (!name || !embed) return null;
  return {
    id: str(x.id) || str(x.uri_name) || uri || name,
    name,
    tag: str(x.tag, x.league, x.competition),
    category: str(x.category_name, x.category, category) || 'Other',
    poster: abs(str(x.poster, x.thumbnail, x.image, x.cover)) || null,
    start: time(x.starts_at ?? x.start ?? x.start_time ?? x.date),
    end: time(x.ends_at ?? x.end ?? x.end_time),
    alwaysLive: x.always_live === 1 || x.always_live === true || x.always_live === '1',
    embed,
    page: uri ? `${SITE}/live/${uri.replace(/^\/+/, '')}` : SITE,
    viewers: Number(x.viewers) || 0
  };
}

export function parseSports(j: any): SportEvent[] {
  const out: SportEvent[] = [];
  const groups: any[] = Array.isArray(j) ? j : Array.isArray(j?.streams) ? j.streams : Array.isArray(j?.data) ? j.data : [];
  for (const g of groups) {
    if (g && Array.isArray(g.streams)) {
      const cat = str(g.category, g.name, g.category_name);
      for (const s of g.streams) {
        const e = toEvent(s, cat);
        if (e) out.push(e);
      }
    } else {
      const e = toEvent(g, '');
      if (e) out.push(e);
    }
  }
  // the same event can be listed under two categories
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
}

// ppv.st's public API (https://ppv.st/api). It allows other sites to call it from the browser, so it's the fallback
// when our relay fails; ppv.to is a known mirror.
const DIRECT = ['https://api.ppv.st/api/streams', 'https://api.ppv.to/api/streams'];

async function tryJson(url: string): Promise<{ ok: true; j: any } | { ok: false; why: string }> {
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await r.text();
    let j: any;
    try {
      j = JSON.parse(text);
    } catch {
      return { ok: false, why: `${url.startsWith('/') ? 'our server' : new URL(url).host} sent a web page instead of data (${r.status})` };
    }
    if (!r.ok) return { ok: false, why: j?.error || `${url.startsWith('/') ? 'our server' : new URL(url).host} answered ${r.status}` };
    return { ok: true, j };
  } catch {
    return { ok: false, why: `couldn't reach ${url.startsWith('/') ? 'our server' : new URL(url).host}` };
  }
}

/** The schedule: through our relay first, then straight from ppv.st in case the relay is blocked or missing. */
export async function loadSports(): Promise<SportEvent[]> {
  const why: string[] = [];
  for (const url of ['/api/sports', ...DIRECT]) {
    const r = await tryJson(url);
    if (r.ok) {
      const list = parseSports(r.j);
      if (list.length || url !== '/api/sports') return list;
      why.push('our server sent an empty schedule');
    } else why.push(r.why);
  }
  throw new Error(`Couldn't load the sports schedule: ${why.join('; ')}.`);
}

/** live = on now, soon = starts within the next hour, later = upcoming, ended = over */
export type SportState = 'live' | 'soon' | 'later' | 'ended';

export function stateOf(e: SportEvent, now = Date.now()): SportState {
  if (e.alwaysLive) return 'live';
  if (e.end && now > e.end) return 'ended';
  if (e.start && now >= e.start) return 'live';
  if (e.start && e.start - now <= 3600000) return 'soon';
  return e.start ? 'later' : 'live';
}
