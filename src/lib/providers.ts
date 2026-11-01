export interface PlayerTick {
  /** Seconds played so far */
  t: number;
  /** Total length in seconds (0 when unknown) */
  d: number;
  /** The video finished */
  ended?: boolean;
}

/** Playback options a server can honour */
export interface PlayOpts {
  autonext?: boolean;
  autoskip?: boolean;
}

export interface Provider {
  id: string;
  name: string;
  quality: string;
  /** Works inside a sandboxed frame (popup protection). Some servers refuse to play when sandboxed. */
  sandboxOk: boolean;
  /** `start` = seconds to begin from (0 = from the beginning) */
  movie: (id: number, start?: number, o?: PlayOpts) => string;
  tv: (id: number, season: number, episode: number, start?: number, o?: PlayOpts) => string;
  /** The server plays the next episode itself (auto-next) — no need for our own countdown */
  handlesNext?: boolean;
  /** The player moved to another episode on its own */
  parseNext?: (ev: MessageEvent) => { s: number; e: number } | null;
  /** Reads a progress message posted by this server's player, or null if the message isn't one. */
  parse: (ev: MessageEvent) => PlayerTick | null;
  /** The player says it has no working copy of this title (so we can move to the next server at once) */
  failed?: (ev: MessageEvent) => boolean;
  /** A message to post to the player once it loads (resume position, a hello), or null for none */
  onFrameLoad?: (start: number) => { msg: unknown; origin: string } | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Servers that post `{ type: 'PLAYER_EVENT', data: { event, currentTime, duration } }` */
const playerEvent = (ev: MessageEvent, hostOk: (host: string) => boolean): PlayerTick | null => {
  let host = '';
  try {
    host = new URL(ev.origin).hostname;
  } catch {
    return null;
  }
  if (!hostOk(host)) return null;
  let m = ev.data;
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m);
    } catch {
      return null;
    }
  }
  if (!m || m.type !== 'PLAYER_EVENT') return null;
  const p = m.data && typeof m.data === 'object' ? m.data : m;
  const e = p.event;
  if (e === 'ended') return { t: 0, d: 0, ended: true };
  if (e === 'timeupdate' || e === 'pause' || e === 'seeked') return { t: num(p.currentTime), d: num(p.duration) };
  return null;
};

const fromViduki = (ev: MessageEvent) => {
  try {
    const h = new URL(ev.origin).hostname;
    return h === 'viduki.net' || h.endsWith('.viduki.net');
  } catch {
    return false;
  }
};

/** Viduki posts `{ type: 'MEDIA_DATA', data }` with the watch progress (watched/duration in seconds) */
const vidukiProgress = (ev: MessageEvent): PlayerTick | null => {
  if (!fromViduki(ev)) return null;
  let m = ev.data;
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m);
    } catch {
      return null;
    }
  }
  if (!m || m.type !== 'MEDIA_DATA' || !m.data || typeof m.data !== 'object') return null;
  // either one entry, or entries keyed by TMDB id: take the one updated last
  const entries: any[] = m.data.progress ? [m.data] : Object.values(m.data);
  const e = entries
    .filter((x) => x && typeof x === 'object' && x.progress)
    .sort((a, b) => num(b.last_updated) - num(a.last_updated))[0];
  if (!e) return null;
  const t = num(e.progress.watched);
  const d = num(e.progress.duration);
  if (d > 0 && t >= d - 1) return { t: 0, d: 0, ended: true };
  return { t, d };
};

const VIDRIFT = 'https://embed.vidrift.net';
const VELARIUM = 'https://velarium.cc';
const vidriftMsg = (ev: MessageEvent): any => {
  if (ev.origin !== VIDRIFT) return null;
  const m = ev.data;
  return m && typeof m === 'object' && typeof m.type === 'string' && m.type.startsWith('vidrift:') ? m : null;
};
// Vidrift plays the next episode itself; with auto-next off its Next button is hidden instead
const vidriftQuery = (o: PlayOpts) => `?brandColor=ff6b57${o.autonext === false ? '&hide=next' : ''}`;

/** VidAPI posts `{ type: 'PLAYER_EVENT', data: { player_status, player_progress, player_duration } }` */
const vidapiProgress = (ev: MessageEvent): PlayerTick | null => {
  let host = '';
  try {
    host = new URL(ev.origin).hostname;
  } catch {
    return null;
  }
  if (host !== 'vaplayer.ru' && !host.endsWith('.vaplayer.ru')) return null;
  let m = ev.data;
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m);
    } catch {
      return null;
    }
  }
  if (!m || m.type !== 'PLAYER_EVENT' || !m.data || typeof m.data !== 'object') return null;
  const x = m.data;
  if (x.player_status === 'completed') return { t: 0, d: 0, ended: true };
  if (x.player_status === 'playing' || x.player_status === 'paused' || x.player_status === 'seeked')
    return { t: num(x.player_progress), d: num(x.player_duration) };
  return null;
};

/** Vidstuck posts a JSON string: { id, type, progress (%), timestamp (seconds), duration, season, episode } */
const vidstuckProgress = (ev: MessageEvent): PlayerTick | null => {
  try {
    const h = new URL(ev.origin).hostname;
    if (h !== 'vidstuck.cc' && !h.endsWith('.vidstuck.cc')) return null;
  } catch {
    return null;
  }
  let m = ev.data;
  if (typeof m === 'string') {
    try {
      m = JSON.parse(m);
    } catch {
      return null;
    }
  }
  if (!m || typeof m !== 'object' || !('timestamp' in m)) return null;
  const t = num(m.timestamp);
  const d = num(m.duration);
  if (d > 0 && t >= d - 1) return { t: 0, d: 0, ended: true };
  return { t, d };
};

const cineQuery = (start: number, o: PlayOpts, first: '?' | '&') => {
  const q: string[] = [];
  if (start > 0) q.push(`t=${start}`, 'continueprompt=false');
  if (o.autonext !== undefined) q.push(`autonext=${o.autonext}`);
  if (o.autoskip !== undefined) q.push(`autoskip=${o.autoskip}`);
  return q.length ? first + q.join('&') : '';
};

export const providers: Provider[] = [
  {
    id: 'cinesrc',
    name: 'Server 1',
    quality: '1080p Ultra',
    sandboxOk: true,
    handlesNext: true,
    movie: (id, start = 0, o = {}) => `https://cinesrc.st/embed/movie/${id}${cineQuery(start, o, '?')}`,
    tv: (id, s, e, start = 0, o = {}) => `https://cinesrc.st/embed/tv/${id}?s=${s}&e=${e}${cineQuery(start, o, '&')}`,
    parseNext: (ev) => {
      if (ev.origin !== 'https://cinesrc.st') return null;
      const m = ev.data;
      if (!m || m.type !== 'cinesrc:nextepisode' || !m.internalNavigation) return null;
      const s = num(m.season);
      const e = num(m.episode);
      return s > 0 && e > 0 ? { s, e } : null;
    },
    parse: (ev) => {
      if (ev.origin !== 'https://cinesrc.st') return null;
      const m = ev.data;
      if (!m || typeof m.type !== 'string') return null;
      if (m.type === 'cinesrc:ended') return { t: 0, d: 0, ended: true };
      if (m.type === 'cinesrc:timeupdate' || m.type === 'cinesrc:pause' || m.type === 'cinesrc:seeked')
        return { t: num(m.currentTime), d: num(m.duration) };
      return null;
    }
  },
  {
    id: 'vidlink',
    name: 'Server 2',
    quality: '1080p HD',
    sandboxOk: false,
    movie: (id, start = 0) =>
      `https://vidlink.pro/movie/${id}?primaryColor=ff6b57&autoplay=true${start > 0 ? `&startAt=${start}` : ''}`,
    tv: (id, s, e, start = 0) =>
      `https://vidlink.pro/tv/${id}/${s}/${e}?primaryColor=ff6b57&autoplay=true${start > 0 ? `&startAt=${start}` : ''}`,
    parse: (ev) => playerEvent(ev, (h) => h === 'vidlink.pro' || h.endsWith('.vidlink.pro'))
  },
  {
    id: 'vidfast',
    name: 'Server 3',
    quality: '1080p Pro',
    sandboxOk: false,
    movie: (id, start = 0) => `https://vidfast.vc/movie/${id}?autoPlay=true${start > 0 ? `&startAt=${start}` : ''}`,
    tv: (id, s, e, start = 0) =>
      `https://vidfast.vc/tv/${id}/${s}/${e}?autoPlay=true${start > 0 ? `&startAt=${start}` : ''}`,
    parse: (ev) => playerEvent(ev, (h) => h.startsWith('vidfast.') || h.includes('.vidfast.'))
  },
  {
    id: 'vidy',
    name: 'Server 4',
    quality: 'HD',
    sandboxOk: false,
    movie: (id, start = 0) => `https://vidy.st/movie/${id}?color=ff6b57&autoplay=true${start > 0 ? `&progress=${start}` : ''}`,
    tv: (id, s, e, start = 0) =>
      `https://vidy.st/tv/${id}/${s}/${e}?color=ff6b57&autoplay=true${start > 0 ? `&progress=${start}` : ''}`,
    parse: (ev) => playerEvent(ev, (h) => h === 'vidy.st' || h.endsWith('.vidy.st'))
  },
  {
    id: 'vidnest',
    name: 'Server 5',
    quality: 'HD · multi-source',
    sandboxOk: false,
    // Vidnest documents `startAt` for movies and `progress` for TV
    movie: (id, start = 0) => `https://vidnest.fun/movie/${id}${start > 0 ? `?startAt=${start}` : ''}`,
    tv: (id, s, e, start = 0) => `https://vidnest.fun/tv/${id}/${s}/${e}${start > 0 ? `?progress=${start}` : ''}`,
    parse: (ev) => playerEvent(ev, (h) => h === 'vidnest.fun' || h.endsWith('.vidnest.fun'))
  },
  // Viduki's four APIs: 1 multi server, 2 multi language, 3 multi embeds, 4 premium embeds
  ...(['multi-server', 'multi-language', 'multi-embed', 'premium'] as const).map((kind, i): Provider => ({
    id: i === 0 ? 'viduki' : `viduki${i + 1}`,
    name: `Server ${6 + i}`,
    quality: `HD · ${kind}`,
    sandboxOk: false,
    // Viduki's docs list no start-time option, so these start from the beginning
    movie: (id) => `https://viduki.net/${i + 1}/movie/${id}?color=ff6b57`,
    tv: (id, s, e) => `https://viduki.net/${i + 1}/tv/${id}/${s}/${e}?color=ff6b57`,
    parse: vidukiProgress,
    failed: (ev) => fromViduki(ev) && !!ev.data && typeof ev.data === 'object' && ev.data.type === 'viduki:all-servers-failed'
  })),
  {
    id: 'vidapi',
    name: 'Server 10',
    quality: 'HD · auto subs',
    sandboxOk: false,
    movie: (id, start = 0) => `https://vaplayer.ru/embed/movie/${id}?autoplay=1&primaryColor=%23ff6b57${start > 0 ? `&startAt=${start}` : ''}`,
    tv: (id, s, e, start = 0) =>
      `https://vaplayer.ru/embed/tv/${id}/${s}/${e}?autoplay=1&primaryColor=%23ff6b57${start > 0 ? `&startAt=${start}` : ''}`,
    parse: vidapiProgress
  },
  {
    id: 'vidrift',
    name: 'Server 11',
    quality: 'HD · auto-next',
    sandboxOk: false,
    handlesNext: true,
    movie: (id, _start = 0, o = {}) => `${VIDRIFT}/embed/movie/${id}${vidriftQuery(o)}`,
    tv: (id, s, e, _start = 0, o = {}) => `${VIDRIFT}/embed/tv/${id}/${s}/${e}${vidriftQuery(o)}`,
    // no start-time option in the address: the saved spot is sent as a message once the player loads
    onFrameLoad: (start) => (start > 0 ? { msg: { type: 'vidrift:resume', currentTime: start }, origin: VIDRIFT } : null),
    parseNext: (ev) => {
      const m = vidriftMsg(ev);
      if (!m || m.type !== 'vidrift:episode') return null;
      const s = num(m.season);
      const e = num(m.episode);
      return s > 0 && e > 0 ? { s, e } : null;
    },
    parse: (ev) => {
      const m = vidriftMsg(ev);
      if (!m) return null;
      if (m.type === 'vidrift:ended') return { t: 0, d: 0, ended: true };
      if (m.type === 'vidrift:progress') return { t: num(m.currentTime), d: num(m.duration) };
      return null;
    }
  },
  {
    id: 'cinemaos',
    name: 'Server 12',
    quality: 'HD',
    sandboxOk: false,
    // our page runs its own up-next countdown, so the player's next-episode countdown is off
    movie: (id, start = 0) => `https://cinemaos.tech/player/${id}?theme=ff6b57&autoPlay=true${start > 0 ? `&startTime=${start}` : ''}`,
    tv: (id, s, e, start = 0) =>
      `https://cinemaos.tech/player/${id}/${s}/${e}?theme=ff6b57&autoPlay=true&autoNext=false&nextButton=false${start > 0 ? `&startTime=${start}` : ''}`,
    parse: (ev) => playerEvent(ev, (h) => h === 'cinemaos.tech' || h.endsWith('.cinemaos.tech'))
  },
  {
    id: 'superembed',
    name: 'Server 13',
    quality: 'HD · multi-source',
    sandboxOk: false,
    // SuperEmbed documents no start-time option or progress messages: it starts from the beginning
    movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
    parse: () => null
  },
  {
    id: 'embedwave',
    name: 'Server 14',
    quality: 'HD · multi-source',
    sandboxOk: false,
    // EmbedWave documents no start-time option or progress messages: it starts from the beginning
    movie: (id) => `https://embedwave.cc/embed/movie/${id}?autoplay=1`,
    tv: (id, s, e) => `https://embedwave.cc/embed/tv/${id}/${s}/${e}?autoplay=1`,
    parse: () => null
  },
  {
    id: 'videm',
    name: 'Server 15',
    quality: 'HD · auto source',
    sandboxOk: false,
    // Videm documents no start-time option or progress messages: it starts from the beginning
    movie: (id) => `https://videm.xyz/embed/movie/${id}?autoplay=true`,
    tv: (id, s, e) => `https://videm.xyz/embed/tv/${id}/${s}/${e}?autoplay=true`,
    parse: () => null
  },
  {
    id: 'velarium',
    name: 'Server 16',
    quality: 'HD · skip intro',
    sandboxOk: false,
    // our page runs its own up-next countdown, so the player's next-episode button and auto-next are off
    movie: (id, start = 0) => `${VELARIUM}/en/watch/movie/${id}?autoPlay=true&theme=ff6b57${start > 0 ? `&startAt=${start}` : ''}`,
    tv: (id, s, e, start = 0, o = {}) =>
      `${VELARIUM}/en/watch/tv/${id}-${s}-${e}?autoPlay=true&theme=ff6b57&autoNext=false&nextButton=false${o.autoskip ? '&autoSkipIntro=true' : ''}${start > 0 ? `&startAt=${start}` : ''}`,
    // the player only shares progress after the page says hello
    onFrameLoad: () => ({ msg: { type: 'VELARIUM_EMBED_INIT' }, origin: VELARIUM }),
    parse: (ev) => (ev.origin === VELARIUM ? playerEvent(ev, () => true) : null)
  },
  {
    id: 'cinezo',
    name: 'Server 17',
    quality: 'HD',
    sandboxOk: false,
    // Cinezo documents no start-time option; its progress messages are assumed to be the common PLAYER_EVENT kind
    movie: (id) => `https://player.cinezo.live/embed/movie/${id}?autoplay=true`,
    tv: (id, s, e) => `https://player.cinezo.live/embed/tv/${id}/${s}/${e}?autoplay=true`,
    parse: (ev) => playerEvent(ev, (h) => h === 'cinezo.live' || h.endsWith('.cinezo.live'))
  },
  {
    id: '2embed',
    name: 'Server 18',
    quality: 'HD',
    sandboxOk: false,
    // 2Embed documents no options or progress messages; the TV address really uses "&s=" with no "?"
    movie: (id) => `https://www.2embed.cc/embed/${id}`,
    tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
    parse: () => null
  },
  {
    id: 'embedapi',
    name: 'Server 19',
    quality: 'HD',
    sandboxOk: false,
    // Embed-API documents no options or progress messages: it starts from the beginning
    movie: (id) => `https://watch.embed-api.stream/embed/movie/${id}`,
    tv: (id, s, e) => `https://watch.embed-api.stream/embed/tv/${id}/${s}/${e}`,
    parse: () => null
  },
  {
    id: 'zxcstream',
    name: 'Server 20',
    quality: 'HD · dubs',
    sandboxOk: false,
    // ZXCStream's custom player; it documents no start-time option or progress messages
    movie: (id) => `https://zxcstream.cc/player/movie/${id}?color=ff6b57&autoplay=true`,
    tv: (id, s, e) => `https://zxcstream.cc/player/tv/${id}/${s}/${e}?color=ff6b57&autoplay=true`,
    parse: () => null
  },
  {
    id: 'vidstuck',
    name: 'Server 21',
    quality: 'HD',
    sandboxOk: false,
    // our page runs its own up-next countdown, so the player's next-episode options stay off
    movie: (id, start = 0) => `https://vidstuck.cc/embed/movie/${id}?color=ff6b57${start > 0 ? `&progress=${start}` : ''}`,
    tv: (id, s, e, start = 0) => `https://vidstuck.cc/embed/tv/${id}/${s}/${e}?color=ff6b57${start > 0 ? `&progress=${start}` : ''}`,
    parse: vidstuckProgress
  },
  {
    id: 'vidrock',
    name: 'Server 22',
    quality: 'HD',
    sandboxOk: false,
    // Vidrock documents no start-time option; our page runs its own up-next countdown, so its next button is off
    movie: (id) => `https://vidrock.net/movie/${id}?autoplay=true&theme=ff6b57`,
    tv: (id, s, e) => `https://vidrock.net/tv/${id}/${s}/${e}?autoplay=true&theme=ff6b57&autonext=false&nextbutton=false`,
    parse: (ev) => (ev.origin === 'https://vidrock.net' ? playerEvent(ev, () => true) : null)
  }
];

export const providerById = (id: string | null | undefined): Provider =>
  providers.find((p) => p.id === id) ?? providers[0];

// URLs carry a neutral server number ("?p=3") instead of the provider's name
export const serverSlug = (id: string | null | undefined): string =>
  String(Math.max(0, providers.findIndex((p) => p.id === id)) + 1);

export const providerFromParam = (v: string | null | undefined): Provider =>
  providers[Number(v) - 1] ?? providerById(v);
