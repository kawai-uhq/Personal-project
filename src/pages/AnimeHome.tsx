import { useCallback, useEffect, useMemo, useState } from 'react';
import Ambient from '../components/Ambient';
import AnimeProviderRow from '../components/AnimeProviderRow';
import Billboard from '../components/Billboard';
import FeedRow from '../components/FeedRow';
import { ContinueRow, HomeSkeleton, PosterRow, Status } from '../components/Rows';
import { tmdb } from '../lib/tmdb';
import type { Media } from '../lib/types';
import { useApp } from '../state';

const ROWS = [
  'anime-season', 'anime-top', 'anime-popular', 'anime-upcoming', 'anime-films',
  'anime-action', 'anime-fantasy', 'anime-romance', 'anime-scifi'
];

/** The anime section's home: billboard, continue watching, then rows of Japanese animation. */
export default function AnimeHome() {
  const { favorites, loved, history, removeWatch } = useApp();
  const [trending, setTrending] = useState<Media[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const onActive = useCallback((n: number) => setActive(n), []);

  const load = () => {
    setError(null);
    setTrending(null);
    tmdb.feed('anime-trending').then((r) => setTrending(r.items)).catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const mine = useMemo(() => history.filter((w) => w.media.anime), [history]);

  if (error) return <main className="page pad-top"><Status kind="error" text={error} retry={load} /></main>;
  if (!trending) return <HomeSkeleton />;
  const heroes = trending.filter((m) => m.backdrop && m.overview).slice(0, 5);

  return (
    <main className="page home">
      <Ambient items={heroes} active={active} />
      <Billboard items={heroes} onActive={onActive} />
      <AnimeProviderRow />
      <ContinueRow items={mine} onRemove={removeWatch} />
      <PosterRow title="My Anime Watchlist" items={favorites.filter((m) => m.anime)} to="/anime/library" />
      <PosterRow title="My Anime Favorites" items={loved.filter((m) => m.anime)} to="/anime/library" />
      <PosterRow title="Trending Right Now" items={trending} to="/explore/anime-trending" />
      {ROWS.map((f) => (
        <FeedRow key={f} feed={f} />
      ))}
    </main>
  );
}
