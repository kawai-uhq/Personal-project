import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import DiscordCard from '../components/account/DiscordCard';
import { askConfirm } from '../components/Confirm';
import SettingsPanel from '../components/SettingsPanel';
import AniListCard from '../components/AniListCard';
import { animeStore } from '../lib/animeStore';
import { mangaStore } from '../lib/mangaStore';
import { useSection } from '../lib/section';
import { toPublic as P } from '../lib/site';
import ProfileCard from '../components/ProfileCard';
import ShareCard from '../components/account/ShareCard';
import { earnedBadges } from '../lib/badges';
import ProfileEditor from '../components/account/ProfileEditor';
import AccountDetails from '../components/account/AccountDetails';
import Devices from '../components/account/Devices';
import StatsGrid from '../components/account/StatsGrid';
import { hasDiscord, useProfile } from '../lib/profile';
import { watchStats } from '../lib/stats';
import { useApp } from '../state';

type Tab = 'general' | 'site' | 'profile' | 'connections' | 'security' | 'data';
const TABS: [Tab, string, IconName][] = [
  ['general', 'General', 'settings'],
  ['site', 'Site appearance', 'sparkles'],
  ['profile', 'Profile appearance', 'user'],
  ['connections', 'Connections', 'link'],
  ['security', 'Security', 'shield'],
  ['data', 'Data', 'database']
];

/** Your account: who you're signed in as, what's saved, and signing out. */
export default function Account() {
  const { session, openAuth, signOut, getToken, favorites, loved, history } = useApp();
  const section = useSection();
  const nav = useNavigate();
  const { hash } = useLocation();
  const fromHash = (h: string): Tab => (h === '#settings' ? 'general' : h === '#appearance' ? 'site' : (TABS.find(([id]) => `#${id}` === h)?.[0] ?? 'general'));
  const [tab, setTab] = useState<Tab>(() => fromHash(hash));
  useEffect(() => {
    if (!hash) return;
    setTab(fromHash(hash));
    window.setTimeout(() => document.querySelector('.acct-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);
  const openTab = (t: Tab) => {
    setTab(t);
    try { history.replaceState(history.state, '', `${location.pathname}${location.search}#${t}`); } catch { /* ignore */ }
  };
  const profile = useProfile();
  // redraw once the account reports its linked sign-ins (the Discord badge depends on it)
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    window.addEventListener('comvie:linked', f);
    return () => window.removeEventListener('comvie:linked', f);
  }, []);
  const libraryLink = section === 'anime' ? P('/anime/library') : section === 'manga' ? P('/manga/library') : '/list';

  if (!session) {
    return (
      <main className="page pad-top">
        <div className="container mid acct">
          <div className="acct-card acct-empty">
            <span className="acct-avatar"><Icon name="user" size={26} /></span>
            <h1 className="title">Your <span className="accent">Account</span></h1>
            <p className="muted">Sign in to back up your lists and progress, use them on any device, connect AniList and change the site's settings.</p>
            <button className="btn primary" onClick={openAuth}><Icon name="login" size={16} />Sign in or create an account</button>
          </div>

        </div>
      </main>
    );
  }

  const name = profile?.username || session.email.split('@')[0];
  const deco = profile?.deco ?? {};
  const ws = watchStats();
  const myBadges = earnedBadges(ws, { joined: profile?.created_at, discord: hasDiscord() });

  const deleteAccount = async () => {
    const yes = await askConfirm({
      title: 'Delete your account?',
      text: `This permanently deletes ${session.email} and everything saved to it (lists, history, progress). Lists already on this device stay here. This can't be undone.`,
      ok: 'Delete forever',
      danger: true
    });
    if (!yes) return;
    try {
      const token = await getToken();
      const r = await fetch('/api/delete-account', { method: 'POST', headers: { Authorization: `Bearer ${token ?? ''}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        await askConfirm({ title: "Couldn't delete the account", text: j.error || 'Try again in a moment.', ok: 'OK', cancel: 'Close', icon: 'x' });
        return;
      }
      signOut();
      nav('/');
    } catch {
      await askConfirm({ title: "Couldn't delete the account", text: 'Check your connection and try again.', ok: 'OK', cancel: 'Close', icon: 'x' });
    }
  };
  const stats: [string, number][] = [
    ['Cinema watchlist', favorites.length],
    ['Cinema favorites', loved.length],
    ['Movies & shows watched', history.length],
    ['Anime watchlist', animeStore.list().length],
    ['Anime watched', animeStore.history().length],
    ['Manga saved', mangaStore.list().length],
    ['Manga read', mangaStore.history().length]
  ];

  return (
    <main className="page pad-top">
      <div className="container mid acct">
        <ProfileCard avatar={profile?.avatar} deco={deco} name={profile?.username ? `@${name}` : name} badges={myBadges}>
          <p className="muted"><Icon name="mail" size={14} /> {session.email}</p>
          <span className="acct-badge"><Icon name="check" size={13} />Signed in · synced to your account</span>
        </ProfileCard>
        <ShareCard profile={profile} name={name} stats={ws} badges={myBadges} />

        <h2 className="section">Your stats</h2>
        <StatsGrid stats={ws} />
        <p className="muted small">{ws.titles} titles started · active {ws.activeThisMonth} {ws.activeThisMonth === 1 ? 'day' : 'days'} this month. Hours are an estimate.</p>

        <div className="acct-tabs" role="tablist" aria-label="Account sections">
          {TABS.map(([id, label, icon]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => openTab(id)}>
              <Icon name={icon} size={15} />{label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <section className="acct-sec" id="settings">
            <SettingsPanel part="general" />
          </section>
        )}

        {tab === 'site' && (
          <section className="acct-sec">
            <SettingsPanel part="appearance" />
          </section>
        )}

        {tab === 'profile' && (
          <section className="acct-sec">
            <ProfileEditor />
          </section>
        )}

        {tab === 'connections' && (
          <section className="acct-sec">
            <div className="conn-list">
              <AniListCard />
              <DiscordCard />
            </div>
          </section>
        )}

        {tab === 'security' && (
          <section className="acct-sec">
            <h2 className="section">Email and password</h2>
            <AccountDetails />
            <h2 className="section">Devices</h2>
            <Devices />
            <h2 className="section">Account</h2>
            <div className="acct-actions">
              <button
                className="btn ghost danger"
                onClick={async () => {
                  const yes = await askConfirm({
                    title: 'Sign out?',
                    text: `You'll be signed out of ${session.email} on this device. Your lists stay saved to your account.`,
                    ok: 'Sign out',
                    danger: true,
                    icon: 'login'
                  });
                  if (!yes) return;
                  signOut();
                  nav('/');
                }}
              >
                <Icon name="login" size={16} />Sign out
              </button>
              <button className="btn ghost danger" onClick={() => void deleteAccount()}>
                <Icon name="trash" size={16} />Delete account
              </button>
            </div>
          </section>
        )}

        {tab === 'data' && (
          <section className="acct-sec">
            <h2 className="section">Your library</h2>
            <div className="acct-stats">
              {stats.map(([label, n]) => (
                <div key={label} className="acct-stat"><strong>{n}</strong><small>{label}</small></div>
              ))}
            </div>
            <p className="muted small">Your cinema, anime and manga lists are saved to your account, so they follow you to other devices.</p>
            <div className="acct-actions">
              <Link className="btn ghost" to={libraryLink}><Icon name="bookmark" size={16} />Open my library</Link>
            </div>
            <SettingsPanel part="data" />
          </section>
        )}
      </div>
    </main>
  );
}
