import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AniFeedRow, AnimeCard } from '../components/AnimeCard';
import AnimeBillboard from '../components/AnimeBillboard';
import { Row, Status, HomeSkeleton } from '../components/Rows';
import { aniList, seasonNow } from '../lib/anilist';
import type { Ani } from '../lib/anilist';
import { useAnimeStore } from '../lib/animeStore';

/** The anime section's home, powered by AniList. */
export default function AnimeHome() {
  const store = useAnimeStore();
  const [hero, setHero] = useState<Ani[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    setHero(null);
    aniList({ sort: 'TRENDING_DESC', perPage: 12 })
      .then((r) => setHero(r.items.filter((a) => a.banner && a.desc).slice(0, 6)))
      .catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <main className="page pad-top"><Status kind="error" text={error} retry={load} /></main>;
  if (!hero) return <HomeSkeleton />;

  const now = seasonNow();
  const next = seasonNow(1);
  const watching = store.history();
  const list = store.list();
  const loved = store.loved();

  return (
    <main className="page home">
      <AnimeBillboard items={hero} />
      {watching.length > 0 && (
        <Row title="Continue Watching">
          {watching.map((w) => (
            <AnimeCard key={w.id} a={w} tag={`EP ${w.episode}`} to={`/anime/watch/${w.id}?e=${w.episode}&p=${w.server}&l=${w.lang}`} />
          ))}
        </Row>
      )}
      {list.length > 0 && <Row title="My Anime Watchlist" to="/anime/library">{list.map((a) => <AnimeCard key={a.id} a={a} />)}</Row>}
      {loved.length > 0 && <Row title="My Anime Favorites" to="/anime/library">{loved.map((a) => <AnimeCard key={a.id} a={a} />)}</Row>}
      <AniFeedRow title="Trending Right Now" q={{ sort: 'TRENDING_DESC' }} to="/anime/explore?sort=TRENDING_DESC" />
      <AniFeedRow title="Popular This Season" q={{ sort: 'POPULARITY_DESC', season: now.season, seasonYear: now.year }} to={`/anime/explore?season=${now.season}&year=${now.year}`} />
      <AniFeedRow title="Upcoming Next Season" q={{ sort: 'POPULARITY_DESC', season: next.season, seasonYear: next.year }} to={`/anime/explore?season=${next.season}&year=${next.year}`} />
      <AniFeedRow title="All-Time Popular" q={{ sort: 'POPULARITY_DESC' }} to="/anime/explore?sort=POPULARITY_DESC" />
      <AniFeedRow title="Highest Rated" q={{ sort: 'SCORE_DESC', popularityGreater: 60000 }} to="/anime/explore?sort=SCORE_DESC" />
      <AniFeedRow title="Top Anime Films" q={{ sort: 'SCORE_DESC', format: 'MOVIE', popularityGreater: 20000 }} to="/anime/explore?format=MOVIE&sort=SCORE_DESC" />
      <AniFeedRow title="High-Octane Action" q={{ sort: 'POPULARITY_DESC', genre: 'Action' }} to="/anime/explore?genre=Action" />
      <AniFeedRow title="Epic Fantasy Worlds" q={{ sort: 'POPULARITY_DESC', genre: 'Fantasy' }} to="/anime/explore?genre=Fantasy" />
      <AniFeedRow title="Heartwarming Romance" q={{ sort: 'POPULARITY_DESC', genre: 'Romance' }} to="/anime/explore?genre=Romance" />
      <AniFeedRow title="Sci-Fi & Cyberpunk" q={{ sort: 'POPULARITY_DESC', genre: 'Sci-Fi' }} to="/anime/explore?genre=Sci-Fi" />
      <p className="muted note" style={{ textAlign: 'center' }}>Anime data from <a href="https://anilist.co" target="_blank" rel="noreferrer" className="link">AniList</a>. <Link to="/anime/genres" className="link">Browse by genre</Link></p>
    </main>
  );
}
