import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { askConfirm } from '../components/Confirm';
import SettingsPanel from '../components/SettingsPanel';
import AniListCard from '../components/AniListCard';
import { animeStore } from '../lib/animeStore';
import { mangaStore } from '../lib/mangaStore';
import { useSection } from '../lib/section';
import { toPublic as P } from '../lib/site';
import { useApp } from '../state';

/** Your account: who you're signed in as, what's saved, and signing out. */
export default function Account() {
  const { session, openAuth, signOut, getToken, favorites, loved, history } = useApp();
  const section = useSection();
  const nav = useNavigate();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === '#settings') window.setTimeout(() => document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth' }), 60);
  }, [hash]);
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

  const name = session.email.split('@')[0];

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
        <div className="acct-card">
          <div className="acct-top">
            <span className="acct-avatar big">{session.email.charAt(0).toUpperCase()}</span>
            <div>
              <h1 className="acct-name">{name}</h1>
              <p className="muted"><Icon name="mail" size={14} /> {session.email}</p>
              <span className="acct-badge"><Icon name="check" size={13} />Signed in · lists synced to your account</span>
            </div>
          </div>
        </div>

        <h2 className="section">Your library</h2>
        <div className="acct-stats">
          {stats.map(([label, n]) => (
            <div key={label} className="acct-stat"><strong>{n}</strong><small>{label}</small></div>
          ))}
        </div>
        <p className="muted small">Your cinema, anime and manga lists are saved to your account, so they follow you to other devices.</p>

        <div className="acct-actions">
          <Link className="btn ghost" to={libraryLink}><Icon name="bookmark" size={16} />Open my library</Link>
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

        <h2 className="section">Connected services</h2>
        <AniListCard />

        <h2 className="section" id="settings">Settings</h2>
        <SettingsPanel />
      </div>
    </main>
  );
}
