/** Players used only by the anime section. They are addressed by AniList id + episode number. */
export type Lang = 'sub' | 'dub' | 'hsub';

export interface AnimeTick { t: number; d: number; ended?: boolean }

export interface AnimeServer {
  name: string;
  note: string;
  langs: Lang[];
  /** true when the player can start from a given second */
  resumes: boolean;
  url: (o: { id: number; ep: number; lang: Lang; start: number; autoskip: boolean }) => string;
  /** Read a message from the player. The caller has already checked it came from this server's frame. */
  parse: (ev: MessageEvent) => AnimeTick | null;
}

const obj = (ev: MessageEvent): any => {
  let d = ev.data;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { return null; }
  }
  return d && typeof d === 'object' ? d : null;
};
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : NaN);

// Server numbers (not names) go in the address bar, same as on the rest of the site
export const animeServers: AnimeServer[] = [
  {
    name: 'Server 1',
    note: 'Sub / Dub',
    langs: ['sub', 'dub'],
    resumes: false,
    url: ({ id, ep, lang }) => `https://megaplay.buzz/stream/ani/${id}/${ep}/${lang}`,
    parse: (ev) => {
      const m = obj(ev);
      if (!m) return null;
      const e = m.event ?? m.type;
      if (e === 'complete') return { t: 0, d: 0, ended: true };
      if (e === 'time' || e === 'watching-log') {
        const t = num(m.time ?? m.currentTime ?? m.data?.time ?? m.data?.currentTime);
        const d = num(m.duration ?? m.data?.duration);
        return Number.isFinite(t) ? { t, d: Number.isFinite(d) ? d : 0 } : null;
      }
      return null;
    }
  },
  {
    name: 'Server 2',
    note: 'Sub / Dub · skip intro',
    langs: ['sub', 'dub'],
    resumes: true,
    url: ({ id, ep, lang, start, autoskip }) =>
      `https://tryembed.us.cc/embed/anime/${id}/${ep}/${lang}?autoplay=true&autoNext=false&lang-type=false&autoSkip=${autoskip}${start > 0 ? `&startAt=${start}` : ''}`,
    parse: (ev) => {
      const m = obj(ev);
      if (!m || m.type !== 'PLAYER_EVENT') return null;
      const x = m.data ?? m;
      const t = num(x.currentTime);
      const d = num(x.duration);
      if (x.event === 'ended') return { t: Number.isFinite(d) ? d : 0, d: Number.isFinite(d) ? d : 0, ended: true };
      return Number.isFinite(t) ? { t, d: Number.isFinite(d) ? d : 0 } : null;
    }
  },
  {
    name: 'Server 3',
    note: 'Sub / Dub / Hard-sub · skip intro',
    langs: ['sub', 'dub', 'hsub'],
    resumes: false,
    url: ({ id, ep, lang, autoskip }) =>
      `https://novuscloud.buzz/embed/ani/${id}/${ep}/${lang}?k=1&autoplay=1${autoskip ? '&skipIntro=1&skipOutro=1' : ''}`,
    parse: (ev) => {
      const m = obj(ev);
      if (!m) return null;
      const e = m.type ?? m.event;
      if (e === 'NEXT_EPISODE') return { t: 0, d: 0, ended: true };
      if (e === 'TIME_UPDATE') {
        const x = m.data ?? m;
        const t = num(x.currentTime);
        const d = num(x.duration);
        return Number.isFinite(t) ? { t, d: Number.isFinite(d) ? d : 0 } : null;
      }
      return null;
    }
  }
];

export const serverAt = (n: number | string | null) => animeServers[(Number(n) || 1) - 1] ?? animeServers[0];
export const serverNo = (s: AnimeServer) => animeServers.indexOf(s) + 1;
