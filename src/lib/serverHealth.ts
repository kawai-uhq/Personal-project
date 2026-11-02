/** Shared server health: which servers played (or didn't) for a title, counted across every visitor.
 *  Talks to /api/servers. Everything here is best effort: without Supabase the counts are just empty. */
import { useEffect, useState } from 'react';

export interface Health {
  ok: number;
  fail: number;
}
export type HealthMap = Record<string, Health>;

const cache = new Map<string, Promise<HealthMap>>();
const voted = new Set<string>();

export function loadHealth(key: string): Promise<HealthMap> {
  const hit = cache.get(key);
  if (hit) return hit;
  const p = fetch(`/api/servers?k=${encodeURIComponent(key)}`)
    .then((r) => (r.ok ? r.json() : { servers: {} }))
    .then((j) => (j && typeof j.servers === 'object' ? (j.servers as HealthMap) : {}))
    .catch(() => ({}));
  cache.set(key, p);
  return p;
}

/** Record that a server played (ok) or had to be skipped (not ok) for a title. Once per server, title and
 *  result per visit, so reloading doesn't count twice. */
export function vote(key: string, server: string, ok: boolean) {
  const id = `${key}|${server}|${ok}`;
  if (voted.has(id)) return;
  voted.add(id);
  try {
    void fetch('/api/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ k: key, s: server, ok }),
      keepalive: true
    }).catch(() => undefined);
  } catch {
    /* offline */
  }
}

/** How likely a server is to work, 0..1 (starts at 0.5 with no votes) */
export const scoreOf = (h?: Health) => ((h?.ok ?? 0) + 1) / ((h?.ok ?? 0) + (h?.fail ?? 0) + 2);
/** Enough people got it to play */
export const isGood = (h?: Health) => !!h && h.ok >= 2 && scoreOf(h) >= 0.6;
/** Enough people had to skip it */
export const isBad = (h?: Health) => !!h && h.fail >= 3 && scoreOf(h) < 0.35;

/** The counts for one title (empty until they arrive) */
export function useHealth(key: string): HealthMap {
  const [h, setH] = useState<HealthMap>({});
  useEffect(() => {
    let live = true;
    setH({});
    loadHealth(key).then((r) => live && setH(r));
    return () => {
      live = false;
    };
  }, [key]);
  return h;
}
