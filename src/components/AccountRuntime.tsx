import { useEffect } from 'react';
import { askConfirm } from './Confirm';
import { animeStore } from '../lib/animeStore';
import { loadProfile, saveDiscordInfo, saveProfile, useProfile } from '../lib/profile';
import type { PublicData } from '../lib/profile';
import { watchStats } from '../lib/stats';
import { useApp } from '../state';

const PING = 'comvie.devping';
const SIX_HOURS = 6 * 3600 * 1000;

/** What the public profile page shows, from this device's (synced) lists. */
export function buildPublicData(favorites: { id: number; type: string; title: string; poster: string | null }[], history: { media: { id: number; type: string; title: string; poster: string | null }; season: number | null; episode: number | null }[]): PublicData {
  const s = watchStats();
  return {
    stats: { hours: s.hours, movies: s.movies, episodes: s.episodes, animeEpisodes: s.animeEpisodes, chapters: s.chapters, streak: s.streak },
    favorites: favorites.slice(0, 12).map((m) => ({ id: m.id, type: m.type, title: m.title, poster: m.poster })),
    watching: history.slice(0, 8).map((h) => ({ id: h.media.id, type: h.media.type, title: h.media.title, poster: h.media.poster, label: h.media.type === 'tv' && h.season && h.episode ? `S${h.season} · E${h.episode}` : 'Movie' })),
    anime: animeStore.loved().slice(0, 12).map((a) => ({ id: a.id, title: a.title, cover: a.cover })),
    updated: Date.now()
  };
}

/** Background account work while signed in: load the profile, record this device, finish "Continue with Discord"
 *  (join the server, offer the Discord picture), and keep a public profile up to date. Renders nothing. */
/** Just came back from "Continue with Discord": join the server, keep the Discord picture / decoration, and say what happened. */
let discordBusy = false;
async function finishDiscord(token: string) {
  let discordToken: string | null = null;
  try {
    discordToken = sessionStorage.getItem('comvie.discordToken');
    sessionStorage.removeItem('comvie.discordToken');
  } catch {
    /* storage blocked */
  }
  if (!discordToken || discordBusy) return;
  discordBusy = true;
  try {
    const r = await fetch('/api/account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'discord', providerToken: discordToken })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('[discord] finish sign-in', r.status, j);
      void askConfirm({ title: 'Signed in with Discord', text: "You're signed in, but we couldn't add you to the Discord server this time. You can join from the Discord button at the bottom of the page.", ok: 'OK', cancel: 'Close', icon: 'info' });
      return;
    }
    saveDiscordInfo({ name: j.name || '', avatar: j.avatar || null, decoration: j.decoration || null });
    // a profile without a picture takes the Discord picture (and decoration) to start with
    const p = await loadProfile(token);
    if (p && !p.avatar?.url && (j.avatar || j.decoration)) {
      await saveProfile(token, { avatar: j.avatar ? { url: j.avatar } : p.avatar, deco: j.decoration ? { ...p.deco, discord: j.decoration } : p.deco }).catch(() => undefined);
    }
    const who = j.name ? ` as ${j.name}` : '';
    const text =
      j.joined === 'joined'
        ? `Signed in with Discord${who}, and you've been added to the Comvie Discord server. Say hi!`
        : j.joined === 'already'
          ? `Signed in with Discord${who}. You're already in the Comvie Discord server.`
          : j.joined === 'failed'
            ? `Signed in with Discord${who}. We couldn't add you to the Discord server this time. You can join from the Discord button at the bottom of the page.`
            : `Signed in with Discord${who}.`;
    void askConfirm({ title: j.joined === 'joined' ? 'Welcome to the Discord server!' : 'Discord connected', text: text + ' Your Discord picture is now in Account → Profile → Picture.', ok: 'Nice', cancel: 'Close', icon: 'check' });
    window.dispatchEvent(new Event('comvie:profile'));
  } catch (e) {
    console.error('[discord] finish sign-in', e);
  } finally {
    discordBusy = false;
  }
}

export default function AccountRuntime() {
  const { session, getToken, loved, history } = useApp();
  const profile = useProfile();

  // profile + this device, on sign-in and on load
  useEffect(() => {
    if (!session) return;
    let live = true;
    void (async () => {
      const token = await getToken();
      if (!token || !live) return;
      await loadProfile(token);
      // record / refresh this device every few hours
      try {
        const last = JSON.parse(localStorage.getItem(PING) || '{}');
        if (!(last.t && Date.now() - last.t < SIX_HOURS && last.r === session.refreshToken)) {
          await fetch('/api/account', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ping' }) });
          localStorage.setItem(PING, JSON.stringify({ t: Date.now(), r: session.refreshToken }));
        }
      } catch {
        /* best effort */
      }
      await finishDiscord(token);
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email]);

  // back from Discord while the same account was already signed in (the email doesn't change, so the effect above won't rerun)
  useEffect(() => {
    const on = () => void getToken().then((t) => t && finishDiscord(t));
    window.addEventListener('comvie:discordback', on);
    return () => window.removeEventListener('comvie:discordback', on);
  }, [getToken]);

  // a public profile shows fresh lists: update it at most once an hour
  useEffect(() => {
    if (!session || !profile?.is_public) return;
    const last = profile.public_data?.updated ?? 0;
    if (Date.now() - last < 3600 * 1000) return;
    void (async () => {
      const token = await getToken();
      if (token) await saveProfile(token, { public_data: buildPublicData(loved, history) }).catch(() => undefined);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email, profile?.is_public]);

  return null;
}
