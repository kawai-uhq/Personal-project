import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import { A_GENRES } from '../lib/anime';

export default function AnimeGenres() {
  return (
    <main className="page pad-top">
      <div className="container mid">
        <div className="page-head">
          <div>
            <h1 className="title">Browse Anime by <span className="accent">Genre</span></h1>
            <p className="muted">Pick a genre to explore series and films.</p>
          </div>
        </div>
        <div className="genre-grid">
          {A_GENRES.map((g) => (
            <Link key={g.slug} to={`/anime/explore?genre=${g.slug}`} className="genre-card" style={{ '--h': g.hue } as React.CSSProperties}>
              <span className="g-icon" aria-hidden="true"><Icon name={g.icon as IconName} size={24} /></span>
              <span className="g-big" aria-hidden="true"><Icon name={g.icon as IconName} size={120} /></span>
              <strong>{g.name}</strong>
              <small>Explore Anime<Icon name="arrowRight" size={13} /></small>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
