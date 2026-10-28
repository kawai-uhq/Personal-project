import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import { GENRES } from '../lib/anilist';

const ICON: Record<string, string> = {
  Action: 'zap', Adventure: 'compass', Comedy: 'smile', Drama: 'ticket', Ecchi: 'heart', Fantasy: 'moon', Horror: 'ghost',
  'Mahou Shoujo': 'sparkles', Mecha: 'rocket', Music: 'music', Mystery: 'search', Psychological: 'flame', Romance: 'heart',
  'Sci-Fi': 'rocket', 'Slice of Life': 'sun', Sports: 'flag', Supernatural: 'ghost', Thriller: 'flame'
};

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
          {GENRES.map((g, i) => (
            <Link key={g} to={`/anime/explore?genre=${encodeURIComponent(g)}`} className="genre-card" style={{ '--h': (i * 37) % 360 } as React.CSSProperties}>
              <span className="g-icon" aria-hidden="true"><Icon name={(ICON[g] ?? 'film') as IconName} size={24} /></span>
              <span className="g-big" aria-hidden="true"><Icon name={(ICON[g] ?? 'film') as IconName} size={120} /></span>
              <strong>{g}</strong>
              <small>Explore Anime<Icon name="arrowRight" size={13} /></small>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
