import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';
import { MANGA_GENRES } from '../lib/manga';

const ICON: Record<string, IconName> = {
  Action: 'swords', Adventure: 'compass', Comedy: 'smile', Drama: 'mask', Ecchi: 'flame', Fantasy: 'wand', Hentai: 'heart', Horror: 'ghost',
  'Mahou Shoujo': 'sparkles', Mecha: 'chip', Music: 'music', Mystery: 'search', Psychological: 'brain', Romance: 'heart',
  'Sci-Fi': 'rocket', 'Slice of Life': 'coffee', Sports: 'trophy', Supernatural: 'ghost', Thriller: 'shield'
};

export default function MangaGenres() {
  return (
    <main className="page pad-top">
      <div className="container mid">
        <header className="ag-head">
          <h1 className="title">Browse Manga by <span className="accent">Genre</span></h1>
          <p className="muted">Pick a genre to see its most popular manga, manhwa and manhua.</p>
        </header>
        <div className="ag-grid">
          {MANGA_GENRES.map((g) => (
            <Link key={g} to={`/manga/explore?genre=${encodeURIComponent(g)}`} className="ag-card">
              <span className="ag-icon" aria-hidden="true"><Icon name={ICON[g] ?? 'film'} size={22} /></span>
              <span className="ag-big" aria-hidden="true"><Icon name={ICON[g] ?? 'film'} size={104} /></span>
              <strong>{g}</strong>
              <small>{g === 'Hentai' ? '18+ · Explore Manga' : 'Explore Manga'}<Icon name="arrowRight" size={12} /></small>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
