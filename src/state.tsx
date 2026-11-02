import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { authConfigured, getUser, refreshSession, signOutRemote, takeOAuthResult } from './lib/auth';
import { clearProfile } from './lib/profile';
import { askConfirm } from './components/Confirm';
import * as sync from './lib/sync';
import { setTokenProvider, syncLibrary } from './lib/cloudData';
import { MAX_HISTORY, store } from './lib/storage';
import { mediaKey } from './lib/types';
import type { Media, Session, WatchEntry } from './lib/types';

interface AppState {
  favorites: Media[];
  loved: Media[];
  isLoved: (m: Media) => boolean;
  toggleLoved: (m: Media) => void;
  history: WatchEntry[];
  provider: string;
  setProvider: (id: string) => void;
  isFavorite: (m: Media) => boolean;
  toggleFavorite: (m: Media) => void;
  recordWatch: (e: WatchEntry) => void;
  removeWatch: (key: string) => void;
  session: Session | null;
  onSignedIn: (s: Session) => void;
  signOut: () => void;
  /** A fresh sign-in token (refreshed if needed), or null when signed out */
  getToken: () => Promise<string | null>;
  authOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}

const newestPerTitle = (list: WatchEntry[]): WatchEntry[] => {
  const best = new Map<string, WatchEntry>();
  for (const w of list) {
    const k = mediaKey(w.media);
    const cur = best.get(k);
    if (!cur || w.watchedAt > cur.watchedAt) best.set(k, w);
  }
  return [...best.values()].sort((a, b) => b.watchedAt - a.watchedAt).slice(0, MAX_HISTORY);
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Media[]>(() => store.getFavorites());
  const [loved, setLoved] = useState<Media[]>(() => store.getLoved());
  const [history, setHistory] = useState<WatchEntry[]>(() => store.getHistory());
  const [provider, setProviderState] = useState<string>(() => store.getProvider());
  const [session, setSessionState] = useState<Session | null>(() => store.getSession());
  const [authOpen, setAuthOpen] = useState(false);

  const favRef = useRef(favorites);
  const lovedRef = useRef(loved);
  const histRef = useRef(history);
  const sessionRef = useRef(session);

  const applyFavorites = useCallback((list: Media[]) => {
    favRef.current = list;
    setFavorites(list);
    store.saveFavorites(list);
  }, []);
  const applyLoved = useCallback((list: Media[]) => {
    lovedRef.current = list;
    setLoved(list);
    store.saveLoved(list);
  }, []);
  const applyHistory = useCallback((list: WatchEntry[]) => {
    histRef.current = list;
    setHistory(list);
    store.saveHistory(list);
  }, []);
  const applySession = useCallback((s: Session | null) => {
    sessionRef.current = s;
    setSessionState(s);
    store.saveSession(s);
  }, []);

  /** A valid access token (refreshed when close to expiry), or null when signed out / offline. */
  const getToken = useCallback(async (): Promise<string | null> => {
    // another part of the site (cinema / anime / manga) may have refreshed or ended the sign-in meanwhile
    const shared = store.getSession();
    if (shared?.refreshToken !== sessionRef.current?.refreshToken) {
      sessionRef.current = shared;
      setSessionState(shared);
    }
    const s = sessionRef.current;
    if (!authConfigured || !s) return null;
    if (s.expiresAt - Date.now() > 60_000) return s.accessToken;
    const r = await refreshSession(s.refreshToken, s.email);
    if (r.kind === 'ok') {
      applySession(r.session);
      return r.session.accessToken;
    }
    if (r.kind === 'rejected') {
      // only sign out if nobody else has a newer sign-in in the meantime
      const now = store.getSession();
      if (now && now.refreshToken !== s.refreshToken) {
        sessionRef.current = now;
        setSessionState(now);
        return now.expiresAt - Date.now() > 60_000 ? now.accessToken : null;
      }
      applySession(null);
    }
    return null;
  }, [applySession]);

  // Anime & manga libraries follow the account: sync on load, on sign-in and whenever you come back to the tab
  useEffect(() => {
    if (!session) {
      setTokenProvider(null);
      return;
    }
    setTokenProvider(getToken);
    void syncLibrary();
    const again = () => document.visibilityState === 'visible' && void syncLibrary();
    document.addEventListener('visibilitychange', again);
    return () => document.removeEventListener('visibilitychange', again);
  }, [session?.email, getToken]);

  // Signing in or out on cinema / anime / manga shows up here when you come back to this tab
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      const shared = store.getSession();
      if ((shared?.refreshToken ?? null) !== (sessionRef.current?.refreshToken ?? null)) {
        sessionRef.current = shared;
        setSessionState(shared);
      }
    };
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  // On load: if signed in, replace the local lists with the account's lists.
  useEffect(() => {
    if (!sessionRef.current) return;
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const cloud = await sync.fetchCloud(token);
        if (cloud) {
          applyFavorites(cloud.favorites);
          applyLoved(cloud.loved);
          applyHistory(cloud.history);
        }
      } catch {
        /* offline: keep the local copy */
      }
    })();
  }, [getToken, applyFavorites, applyLoved, applyHistory]);

  const background = (job: (token: string) => Promise<unknown>) => {
    void (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        await job(token);
      } catch {
        /* best effort */
      }
    })();
  };

  const toggleFavorite = (m: Media) => {
    const key = mediaKey(m);
    const has = favRef.current.some((x) => mediaKey(x) === key);
    applyFavorites(has ? favRef.current.filter((x) => mediaKey(x) !== key) : [m, ...favRef.current]);
    background((t) => (has ? sync.deleteFavorite(t, key) : sync.upsertFavorites(t, [m])));
  };

  const toggleLoved = (m: Media) => {
    const key = mediaKey(m);
    const has = lovedRef.current.some((x) => mediaKey(x) === key);
    applyLoved(has ? lovedRef.current.filter((x) => mediaKey(x) !== key) : [m, ...lovedRef.current]);
    background((t) => (has ? sync.deleteLoved(t, key) : sync.upsertLoved(t, [m])));
  };

  const recordWatch = (e: WatchEntry) => {
    if (!store.getRemember()) return;
    const key = mediaKey(e.media);
    applyHistory([e, ...histRef.current.filter((x) => mediaKey(x.media) !== key)].slice(0, MAX_HISTORY));
    background((t) => sync.upsertHistory(t, [e]));
  };

  const removeWatch = (key: string) => {
    applyHistory(histRef.current.filter((x) => mediaKey(x.media) !== key));
    background((t) => sync.deleteWatch(t, key));
  };

  const onSignedIn = (s: Session) => {
    applySession(s);
    setAuthOpen(false);
    // First sign-in on this device: combine device + account, newest per title wins.
    void (async () => {
      try {
        const cloud = await sync.fetchCloud(s.accessToken);
        if (!cloud) return;
        const seen = new Set<string>();
        const favs = [...favRef.current, ...cloud.favorites].filter((m) => {
          const k = mediaKey(m);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        const seenLoved = new Set<string>();
        const loves = [...lovedRef.current, ...cloud.loved].filter((m) => {
          const k = mediaKey(m);
          if (seenLoved.has(k)) return false;
          seenLoved.add(k);
          return true;
        });
        const hist = newestPerTitle([...histRef.current, ...cloud.history]);
        applyLoved(loves);
        applyFavorites(favs);
        applyHistory(hist);
        if (favs.length) await sync.upsertFavorites(s.accessToken, favs);
        if (loves.length) await sync.upsertLoved(s.accessToken, loves);
        if (hist.length) await sync.upsertHistory(s.accessToken, hist);
      } catch {
        /* the lists stay on this device */
      }
    })();
  };

  const signOut = () => {
    const token = sessionRef.current?.accessToken ?? '';
    applySession(null); // what is already on this device stays
    clearProfile();
    void signOutRemote(token);
  };

  // Back from "Continue with Discord": Supabase put the sign-in in the address
  const signedInRef = useRef(onSignedIn);
  signedInRef.current = onSignedIn;
  useEffect(() => {
    const r = takeOAuthResult();
    if (!r) return;
    if ('error' in r) {
      // shortly, so the dialog host on the page is ready
      window.setTimeout(() => void askConfirm({ title: "Couldn't sign in", text: r.error, ok: 'OK', cancel: 'Close', icon: 'x' }), 400);
      return;
    }
    void (async () => {
      const u = await getUser(r.session.accessToken);
      if (r.providerToken && u?.providers.includes('discord')) {
        // used once, right after sign-in, to add them to the Discord server (see AccountRuntime)
        try { sessionStorage.setItem('comvie.discordToken', r.providerToken); } catch { /* storage blocked */ }
      }
      signedInRef.current({ ...r.session, email: u?.email || '' });
    })();
  }, []);

  const value = useMemo<AppState>(
    () => ({
      favorites,
      loved,
      isLoved: (m) => loved.some((x) => mediaKey(x) === mediaKey(m)),
      toggleLoved,
      history,
      provider,
      setProvider: (id) => {
        setProviderState(id);
        store.saveProvider(id);
      },
      isFavorite: (m) => favorites.some((x) => mediaKey(x) === mediaKey(m)),
      toggleFavorite,
      recordWatch,
      removeWatch,
      session,
      onSignedIn,
      signOut,
      getToken,
      authOpen,
      openAuth: () => setAuthOpen(true),
      closeAuth: () => setAuthOpen(false)
    }),
    // handlers read refs, so they only need to refresh with the data they sit next to
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [favorites, loved, history, provider, session, authOpen]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
