import { Link, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { animeStore } from '../lib/animeStore';
import { mangaStore } from '../lib/mangaStore';
import { useSection } from '../lib/section';
import { toPublic as P } from '../lib/site';
import { useApp } from '../state';

/** Your account: who you're signed in as, what's saved, and signing out. */
export default function Account() {
  const { session, openAuth, signOut, favorites, loved, history } = useApp();
  const section = useSection();
  const nav = useNavigate();
  const libraryLink = section === 'anime' ? P('/anime/library') : section === 'manga' ? P('/manga/library') : '/list';

  if (!session) {
    return (
      <main className="page pad-top">
        <div className="container mid acct">
          <div className="acct-card acct-empty">
            <span className="acct-avatar"><Icon name="user" size={26} /></span>
            <h1 className="title">Your <span className="accent">Account</span></h1>
            <p className="muted">Sign in to back up your watchlist, favorites and progress, and use them on any device.</p>
            <button className="btn primary" onClick={openAuth}><Icon name="login" size={16} />Sign in or create an account</button>
          </div>
        </div>
      </main>
    );
  }

  const name = session.email.split('@')[0];
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
              <span className="acct-badge"><Icon name="check" size={13} />Signed in · cinema list synced to your account</span>
            </div>
          </div>
        </div>

        <h2 className="section">Your library</h2>
        <div className="acct-stats">
          {stats.map(([label, n]) => (
            <div key={label} className="acct-stat"><strong>{n}</strong><small>{label}</small></div>
          ))}
        </div>
        <p className="muted small">Anime and manga lists are kept on this device for now.</p>

        <div className="acct-actions">
          <Link className="btn ghost" to={libraryLink}><Icon name="bookmark" size={16} />Open my library</Link>
          <button
            className="btn ghost danger"
            onClick={() => {
              if (!window.confirm(`Sign out of ${session.email}?`)) return;
              signOut();
              nav('/');
            }}
          >
            <Icon name="login" size={16} />Sign out
          </button>
        </div>
      </div>
    </main>
  );
}
