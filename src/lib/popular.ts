/** "Popular on comvie": titles visitors actually played this week (through /api/popular). Best effort. */
const KEY = 'comvie.played';

/** Count a play once per title per day on this device. */
export function recordPlay(key: string) {
  const today = new Date().toISOString().slice(0, 10);
  let seen: Record<string, string> = {};
  try {
    seen = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    /* ignore */
  }
  if (seen[key] === today) return;
  seen[key] = today;
  // keep only today's marks
  for (const k of Object.keys(seen)) if (seen[k] !== today) delete seen[k];
  try {
    localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* storage blocked */
  }
  try {
    void fetch('/api/popular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ k: key }),
      keepalive: true
    }).catch(() => undefined);
  } catch {
    /* offline */
  }
}

export async function popularKeys(kind: 'cinema' | 'anime'): Promise<{ k: string; plays: number }[]> {
  try {
    const r = await fetch(`/api/popular?kind=${kind}`);
    const j = r.ok ? await r.json() : null;
    return Array.isArray(j?.items) ? j.items : [];
  } catch {
    return [];
  }
}
