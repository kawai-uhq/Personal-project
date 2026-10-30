import { useEffect, useState } from 'react';

/** Look-and-feel settings (Account → Settings). Saved on this device, applied to the whole page. */
export interface Prefs {
  theme: 'dark' | 'light';
  accent: string; // '' = each section's own colour
  background: 'artwork' | 'gradient' | 'plain';
  blur: number; // px, glass blur behind the top bar and pop-ups
  frost: number; // 0-100, how opaque that glass is
  radius: number; // px, card corners
  poster: 'small' | 'medium' | 'large';
  heading: 'rounded' | 'serif';
  banner: boolean;
  ratings: boolean;
  titles: boolean;
  motion: boolean;
}

export const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  accent: '',
  background: 'artwork',
  blur: 14,
  frost: 55,
  radius: 14,
  poster: 'medium',
  heading: 'rounded',
  banner: true,
  ratings: true,
  titles: true,
  motion: true
};

export const ACCENTS: { id: string; label: string; color: string }[] = [
  { id: '', label: 'Section colour', color: 'conic-gradient(#ff6b57 0 33%, #ff9a2e 0 66%, #8f86ff 0)' },
  { id: '#ff6b57', label: 'Coral', color: '#ff6b57' },
  { id: '#ff4d6d', label: 'Red', color: '#ff4d6d' },
  { id: '#ff9a2e', label: 'Orange', color: '#ff9a2e' },
  { id: '#ffd23f', label: 'Gold', color: '#ffd23f' },
  { id: '#3ddc97', label: 'Green', color: '#3ddc97' },
  { id: '#38bdf8', label: 'Blue', color: '#38bdf8' },
  { id: '#8f86ff', label: 'Violet', color: '#8f86ff' },
  { id: '#f472b6', label: 'Pink', color: '#f472b6' },
  { id: '#f6ece3', label: 'White', color: '#f6ece3' }
];

const KEY = 'comvie.prefs';
const EVT = 'comvie:prefs';

export function getPrefs(): Prefs {
  try {
    return { ...DEFAULT_PREFS, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Prefs>) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function setPrefs(next: Partial<Prefs> | null) {
  const p = next === null ? { ...DEFAULT_PREFS } : { ...getPrefs(), ...next };
  try {
    if (next === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* storage blocked: still applies for this visit */ }
  applyPrefs(p);
  window.dispatchEvent(new Event(EVT));
}

/** Text colour that reads on top of the accent. */
const inkFor = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? '#1b1220' : '#ffffff';
};

export function applyPrefs(p: Prefs = getPrefs()) {
  const root = document.documentElement;
  const c = root.classList;
  c.toggle('light', p.theme === 'light');
  c.toggle('bg-gradient', p.background === 'gradient');
  c.toggle('bg-plain', p.background === 'plain');
  c.toggle('poster-small', p.poster === 'small');
  c.toggle('poster-large', p.poster === 'large');
  c.toggle('heading-serif', p.heading === 'serif');
  c.toggle('no-banner', !p.banner);
  c.toggle('no-ratings', !p.ratings);
  c.toggle('no-titles', !p.titles);
  c.toggle('no-motion', !p.motion);
  const st = root.style;
  if (p.accent) {
    st.setProperty('--accent', p.accent);
    st.setProperty('--accent-ink', inkFor(p.accent));
  } else {
    st.removeProperty('--accent');
    st.removeProperty('--accent-ink');
  }
  st.setProperty('--glass-blur', `${p.blur}px`);
  st.setProperty('--glass-alpha', String(Math.max(0.05, Math.min(1, p.frost / 100))));
  st.setProperty('--card-radius', `${p.radius}px`);
}

/** Current settings, re-rendering when they change. */
export function usePrefs(): Prefs {
  const [p, setP] = useState(getPrefs);
  useEffect(() => {
    const f = () => setP(getPrefs());
    window.addEventListener(EVT, f);
    window.addEventListener('storage', f);
    return () => {
      window.removeEventListener(EVT, f);
      window.removeEventListener('storage', f);
    };
  }, []);
  return p;
}

/* ------------------------------ data: export / import / clear ------------------------------ */

const SKIP = ['comvie.session', 'comvie.ani.', 'comvie.md.', 'comvie.promoseen'];
const keep = (k: string) => k.startsWith('comvie.') && !SKIP.some((s) => k === s || k.startsWith(s));

/** Everything Comvie saved on this device (settings, history, lists), never the sign-in session. */
export function exportData(): string {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && keep(k)) out[k] = localStorage.getItem(k) ?? '';
    }
  } catch { /* ignore */ }
  return JSON.stringify({ app: 'comvie', version: 1, at: new Date().toISOString(), host: location.hostname, data: out }, null, 2);
}

/** Load a file made by exportData. Returns how many items were restored. */
export function importData(text: string): number {
  const j = JSON.parse(text);
  if (j?.app !== 'comvie' || typeof j.data !== 'object') throw new Error("That file isn't a Comvie backup.");
  let n = 0;
  for (const [k, v] of Object.entries(j.data as Record<string, string>)) {
    if (keep(k) && typeof v === 'string') {
      localStorage.setItem(k, v);
      n++;
    }
  }
  return n;
}
