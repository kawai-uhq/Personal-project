import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useSection } from '../lib/section';
import { useReminders } from '../lib/reminders';
import { useNewEpisodes } from '../lib/useNewEpisodes';
import { useApp } from '../state';
import Icon from './Icon';
import SearchBox from './SearchBox';
import SiteSwitch from './SiteSwitch';
import { SurpriseButton } from './Discover';
import { toPublic as P } from '../lib/site';

export default function Navbar() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const { session, openAuth } = useApp();
  const fresh = useNewEpisodes();
  const { due } = useReminders();
  const sec = useSection();
  const anime = sec === 'anime';
  const manga = sec === 'manga';
  const dot = fresh.size + due;
  const dotTip = [fresh.size ? `${fresh.size} new episode${fresh.size > 1 ? 's' : ''}` : '', due ? `${due} release${due > 1 ? 's' : ''} out now` : ''].filter(Boolean).join(' · ');
  const [q, setQ] = useState('');
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header className={`nav ${solid || pathname !== '/' ? 'solid' : ''}`}>
        <div className="nav-pill">
          <SiteSwitch />
          {manga ? (
            <nav className="nav-links" aria-label="Manga">
              <NavLink title="Manga Home" to={P('/manga')} end><Icon name="book" size={18} />Manga Home</NavLink>
              <NavLink title="Explore" to={P('/manga/explore')}><Icon name="compass" size={18} />Explore</NavLink>
              <NavLink title="Genres" to={P('/manga/genres')}><Icon name="grid" size={18} />Genres</NavLink>
              <NavLink title="Library" to={P('/manga/library')}><Icon name="bookmark" size={18} />Library</NavLink>
            </nav>
          ) : anime ? (
            <nav className="nav-links" aria-label="Anime">
              <NavLink title="Anime Home" to={P('/anime')} end><Icon name="flame" size={18} />Anime Home</NavLink>
              <NavLink title="Explore" to={P('/anime/explore')}><Icon name="compass" size={18} />Explore</NavLink>
              <NavLink title="Genres" to={P('/anime/genres')}><Icon name="grid" size={18} />Genres</NavLink>
              <NavLink title="Library" to={P('/anime/library')}><Icon name="bookmark" size={18} />Library</NavLink>
            </nav>
          ) : (
            <nav className="nav-links" aria-label="Main">
              <NavLink title="Home" to="/" end><Icon name="home" size={18} />Home</NavLink>
              <NavLink title="Movies" to="/movies"><Icon name="film" size={18} />Movies</NavLink>
              <NavLink title="TV Shows" to="/tv"><Icon name="tv" size={18} />TV Shows</NavLink>
              <NavLink title="Live TV" to="/live"><Icon name="live" size={18} />Live TV</NavLink>
              <NavLink title="Sports" to="/sports"><Icon name="trophy" size={18} />Sports</NavLink>
              <NavLink title="Genres" to="/genres"><Icon name="grid" size={18} />Genres</NavLink>
              <NavLink title="My Library" to="/list"><Icon name="bookmark" size={18} />My Library{dot > 0 && <span className="nav-dot" aria-label={dotTip} data-tip={dotTip} />}</NavLink>
            </nav>
          )}
          <SearchBox
            className="nav-search"
            value={q}
            onChange={setQ}
            onSubmit={(t) => {
              nav(`${manga ? P('/manga/search') : anime ? P('/anime/search') : '/search'}?q=${encodeURIComponent(t)}`);
              setQ('');
            }}
            onPick={() => setQ('')}
          />
          <SurpriseButton />
          {session ? (
            <Link to="/account" className="avatar" aria-label="Your account" title={session.email}>
              {session.email.slice(0, 1).toUpperCase()}
            </Link>
          ) : (
            <button className="nav-signin" onClick={openAuth}>Sign in</button>
          )}
        </div>
      </header>

      {manga ? (
        <nav className="tabbar" aria-label="Manga tabs">
          <NavLink to={P('/manga')} end><Icon name="book" size={18} /><span>Home</span></NavLink>
          <NavLink to={P('/manga/search')}><Icon name="search" size={18} /><span>Search</span></NavLink>
          <NavLink to={P('/manga/explore')}><Icon name="compass" size={18} /><span>Explore</span></NavLink>
          <NavLink to={P('/manga/genres')}><Icon name="grid" size={18} /><span>Genres</span></NavLink>
          <NavLink to={P('/manga/library')}><Icon name="bookmark" size={18} /><span>Library</span></NavLink>
        </nav>
      ) : anime ? (
        <nav className="tabbar" aria-label="Anime tabs">
          <NavLink to={P('/anime')} end><Icon name="flame" size={18} /><span>Home</span></NavLink>
          <NavLink to={P('/anime/search')}><Icon name="search" size={18} /><span>Search</span></NavLink>
          <NavLink to={P('/anime/explore')}><Icon name="compass" size={18} /><span>Explore</span></NavLink>
          <NavLink to={P('/anime/genres')}><Icon name="grid" size={18} /><span>Genres</span></NavLink>
          <NavLink to={P('/anime/library')}><Icon name="bookmark" size={18} /><span>Library</span></NavLink>
        </nav>
      ) : (
        <nav className="tabbar" aria-label="Tabs">
          <NavLink to="/" end><Icon name="home" size={18} /><span>Home</span></NavLink>
          <NavLink to="/search"><Icon name="search" size={18} /><span>Search</span></NavLink>
          <NavLink to="/movies"><Icon name="film" size={18} /><span>Movies</span></NavLink>
          <NavLink to="/tv"><Icon name="tv" size={18} /><span>TV</span></NavLink>
          <NavLink to="/live"><Icon name="live" size={18} /><span>Live</span></NavLink>
          <NavLink to="/sports"><Icon name="trophy" size={18} /><span>Sports</span></NavLink>
          <NavLink to="/list"><Icon name="bookmark" size={18} /><span>Library</span>{dot > 0 && <i className="nav-dot" />}</NavLink>
        </nav>
      )}
    </>
  );
}
