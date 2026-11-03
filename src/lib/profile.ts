/** The signed-in person's profile (username, avatar, decorations, public page) and public profiles of others.
 *  Stored in the Supabase "profiles" table (see supabase/schema.sql). */
import { useEffect, useState } from 'react';
import { getUser, supabaseBase, supabaseKey } from './auth';

export interface Avatar {
  url?: string; // an image from AniList, Discord or TMDB
  color?: string; // background for the letter avatar
}
export interface Deco {
  frame?: string;
  nameplate?: string;
  effect?: string;
  discord?: string; // the person's own Discord avatar decoration
  dplate?: string; // the person's own Discord nameplate (asset path, e.g. "nameplates/nameplates/twilight/")
}

/** Picture and looping video of a Discord nameplate */
export const discordPlate = (asset: string) => ({
  img: `https://cdn.discordapp.com/assets/collectibles/${asset}static.png`,
  video: `https://cdn.discordapp.com/assets/collectibles/${asset}asset.webm`
});
export const DPLATE_RE = /^nameplates\/[A-Za-z0-9_/-]+\/$/;
export interface PublicData {
  stats?: Record<string, number>;
  favorites?: { id: number; type: string; title: string; poster: string | null }[];
  watching?: { id: number; type: string; title: string; poster: string | null; label: string }[];
  anime?: { id: number; title: string; cover: string }[];
  updated?: number;
}
export interface Profile {
  user_id: string;
  username: string | null;
  avatar: Avatar;
  deco: Deco;
  is_public: boolean;
  public_data: PublicData;
  created_at: string;
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EVT = 'comvie:profile';
const CACHE = 'comvie.profile';
let current: Profile | null = (() => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || 'null');
  } catch {
    return null;
  }
})();

function set(p: Profile | null) {
  current = p;
  try {
    if (p) localStorage.setItem(CACHE, JSON.stringify(p));
    else localStorage.removeItem(CACHE);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(EVT));
}

const uidOf = (token: string): string => {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub || '';
  } catch {
    return '';
  }
};

async function rest(token: string | null, method: string, path: string, body?: unknown, prefer = 'return=representation') {
  return fetch(`${supabaseBase}/rest/v1${path}`, {
    method,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token || supabaseKey}`,
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json', Prefer: prefer } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
}

/** A username made from what someone typed at sign-up (or their Discord name) */
export const cleanUsername = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);

export async function usernameFree(name: string): Promise<boolean> {
  try {
    const r = await rest(null, 'POST', '/rpc/username_free', { p_name: name });
    return r.ok ? (await r.json()) === true : false;
  } catch {
    return false;
  }
}

/** Load (and on first use, create) the signed-in person's profile. */
export async function loadProfile(token: string): Promise<Profile | null> {
  const uid = uidOf(token);
  if (!uid || !supabaseBase) return null;
  try {
    const r = await rest(token, 'GET', `/profiles?user_id=eq.${uid}&select=*`);
    if (!r.ok) return current; // table missing / offline: keep what we had
    const rows = (await r.json()) as Profile[];
    if (rows[0]) {
      set(rows[0]);
      return rows[0];
    }
    // first time: take the username chosen at sign-up (or the Discord name) if it's free
    const u = await getUser(token);
    let username: string | null = cleanUsername(u?.username || '');
    if (!USERNAME_RE.test(username) || !(await usernameFree(username))) username = null;
    const c = await rest(token, 'POST', '/profiles', { user_id: uid, username });
    if (!c.ok) return null;
    const made = ((await c.json()) as Profile[])[0] ?? null;
    set(made);
    return made;
  } catch {
    return current;
  }
}

/** Save changes to the signed-in person's profile. Throws a readable message on failure. */
export async function saveProfile(token: string, patch: Partial<Pick<Profile, 'username' | 'avatar' | 'deco' | 'is_public' | 'public_data'>>): Promise<Profile> {
  const uid = uidOf(token);
  const r = await rest(token, 'PATCH', `/profiles?user_id=eq.${uid}`, { ...patch, updated_at: new Date().toISOString() });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const msg = String(j?.message || j?.details || '');
    if (/profiles_username_key|duplicate/i.test(msg)) throw new Error('That username is taken. Try another.');
    if (/username/i.test(msg)) throw new Error('Usernames use 3 to 20 lowercase letters, numbers or underscores.');
    if (/avatar_url_ok|discord_deco_ok/i.test(msg)) throw new Error("That picture can't be used.");
    if (/discord_nameplate_ok/i.test(msg)) throw new Error("That nameplate can't be used.");
    throw new Error("Couldn't save. Try again.");
  }
  const p = ((await r.json()) as Profile[])[0];
  if (p) set(p);
  return p;
}

export const clearProfile = () => set(null);

/** The signed-in person's profile, kept in step everywhere it's shown */
export function useProfile(): Profile | null {
  const [p, setP] = useState<Profile | null>(current);
  useEffect(() => {
    const on = () => setP(current);
    window.addEventListener(EVT, on);
    return () => window.removeEventListener(EVT, on);
  }, []);
  return p;
}

/** Someone's public profile page data (null when there's no such public profile) */
export async function publicProfile(username: string): Promise<Profile | null> {
  if (!USERNAME_RE.test(username) || !supabaseBase) return null;
  try {
    const r = await rest(null, 'GET', `/profiles?username=eq.${username}&is_public=eq.true&select=user_id,username,avatar,deco,is_public,public_data,created_at`);
    if (!r.ok) return null;
    return ((await r.json()) as Profile[])[0] ?? null;
  } catch {
    return null;
  }
}

// ---- Discord details from "Continue with Discord" (avatar, decoration), kept on this device
const DISCORD = 'comvie.discord';
export interface DiscordInfo {
  name: string;
  avatar: string | null;
  decoration: string | null;
  nameplate?: { asset: string; palette: string } | null;
}
export const discordInfo = (): DiscordInfo | null => {
  try {
    return JSON.parse(localStorage.getItem(DISCORD) || 'null');
  } catch {
    return null;
  }
};
export const saveDiscordInfo = (d: DiscordInfo) => {
  try {
    localStorage.setItem(DISCORD, JSON.stringify(d));
  } catch {
    /* storage blocked */
  }
};
