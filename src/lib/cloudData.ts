import { supabaseBase, supabaseKey } from './auth';

/**
 * Anime and manga lists, history and watched/read marks, kept in the signed-in account (Supabase table "user_data",
 * one row per item below). Each side remembers when it last changed something; on sync the newer copy wins, so
 * removals carry over too.
 */
export const SYNC_KEYS = [
  'comvie.anime.history', 'comvie.anime.list', 'comvie.anime.loved', 'comvie.anime.seen',
  'comvie.manga.history', 'comvie.manga.list', 'comvie.manga.seen'
];

const STAMPS = 'comvie.sync.at';
type Stamps = Record<string, number>;
let tokenFor: (() => Promise<string | null>) | null = null;
const timers = new Map<string, number>();

const readStamps = (): Stamps => {
  try { return JSON.parse(localStorage.getItem(STAMPS) || '{}') as Stamps; } catch { return {}; }
};
const writeStamp = (key: string, at: number) => {
  const s = readStamps();
  s[key] = at;
  try { localStorage.setItem(STAMPS, JSON.stringify(s)); } catch { /* ignore */ }
};

/** Called by the app once it can hand out a fresh sign-in token (null when signed out). */
export function setTokenProvider(f: (() => Promise<string | null>) | null) {
  tokenFor = f;
}

async function rest(method: string, path: string, token: string, body?: unknown) {
  return fetch(`${supabaseBase}/rest/v1${path}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

async function push(keys: string[]) {
  const token = tokenFor ? await tokenFor() : null;
  if (!token || !supabaseBase) return;
  const stamps = readStamps();
  const rows = keys.map((key) => {
    let value: unknown = null;
    try { value = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* ignore */ }
    return { key, value: value ?? [], updated_at: new Date(stamps[key] || Date.now()).toISOString() };
  });
  try {
    await rest('POST', '/user_data?on_conflict=user_id,key', token, rows);
  } catch { /* offline: tried again on the next change or visit */ }
}

/** A library list changed on this device: remember when, and upload it shortly (when signed in). */
export function markChanged(key: string) {
  if (!SYNC_KEYS.includes(key)) return;
  writeStamp(key, Date.now());
  if (!tokenFor) return;
  window.clearTimeout(timers.get(key));
  timers.set(key, window.setTimeout(() => void push([key]), 1500));
}

/** Two-way sync: download what's newer in the account, upload what's newer here. */
export async function syncLibrary(): Promise<void> {
  const token = tokenFor ? await tokenFor() : null;
  if (!token || !supabaseBase) return;
  let rows: { key: string; value: unknown; updated_at: string }[] = [];
  try {
    const r = await rest('GET', `/user_data?select=key,value,updated_at&key=in.(${SYNC_KEYS.map((k) => `"${k}"`).join(',')})`, token);
    if (!r.ok) return; // table missing or offline: lists stay on this device
    rows = await r.json();
  } catch {
    return;
  }
  const stamps = readStamps();
  const cloud = new Map(rows.map((x) => [x.key, x]));
  const upload: string[] = [];
  let changed = false;
  for (const key of SYNC_KEYS) {
    const c = cloud.get(key);
    const localAt = stamps[key] || 0;
    const hasLocal = (() => {
      try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(v) ? v.length > 0 : !!v && Object.keys(v).length > 0; } catch { return false; }
    })();
    const cloudAt = c ? Date.parse(c.updated_at) || 0 : 0;
    if (c && cloudAt > localAt) {
      try { localStorage.setItem(key, JSON.stringify(c.value)); } catch { /* ignore */ }
      writeStamp(key, cloudAt);
      changed = true;
    } else if (hasLocal && (!c || localAt > cloudAt)) {
      if (!localAt) writeStamp(key, Date.now());
      upload.push(key);
    }
  }
  if (upload.length) await push(upload);
  if (changed) {
    window.dispatchEvent(new Event('comvie:anime'));
    window.dispatchEvent(new Event('comvie:manga'));
  }
}

/** The SQL to run once in Supabase (shown in the setup notes). */
export const USER_DATA_SQL = `create table if not exists public.user_data (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_data enable row level security;
create policy "Own library rows" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`;
