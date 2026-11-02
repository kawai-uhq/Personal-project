import { useCallback, useEffect, useState } from 'react';
import Ambient from '../components/Ambient';
import Billboard from '../components/Billboard';
import ProviderRow from '../components/ProviderRow';
import FeedRow from '../components/FeedRow';
import { ContinueRow, HomeSkeleton, PosterRow, Status } from '../components/Rows';
import { CollectionsRow, MoodRow } from '../components/Discover';
import BecauseRows from '../components/BecauseRows';
import { tmdb } from '../lib/tmdb';
import type { Media } from '../lib/types';
import { useNewEpisodes } from '../lib/useNewEpisodes';
import { useApp } from '../state';

// Order of the rows under the billboard (the first two use the trending list already loaded for it)
const FEED_ORDER = [
  'trending-week',
  'popular-movie',
  'popular-tv',
  'top-movie',
  'top-tv',
  'upcoming',
  'now-playing',
  'on-air',
  'airing-today',
  'action',
  'scifi',
  'animated',
  'drama'
];

export default function Home() {
  const { favorites, loved, history, removeWatch } = useApp();
  const fresh = useNewEpisodes();
  const [trending, setTrending] = useState<Media[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const onActive = useCallback((n: number) => setActive(n), []);

  const load = () => {
    setError(null);
    setTrending(null);
    tmdb.feed('trending-day').then((r) => setTrending(r.items)).catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  if (error) return <main className="page pad-top"><Status kind="error" text={error} retry={load} /></main>;
  if (!trending) return <HomeSkeleton />;

  const heroes = trending.filter((m) => m.backdrop && m.overview).slice(0, 5);

  return (
    <main className="page home">
      <Ambient items={heroes} active={active} />
      <Billboard items={heroes} onActive={onActive} />
      <ContinueRow items={history} onRemove={removeWatch} />
      <ProviderRow />
      <MoodRow section="cinema" />
      <PosterRow title="My Watchlist" items={favorites} to="/list" fresh={fresh} />
      <PosterRow title="My Favorites" items={loved} to="/list" fresh={fresh} />
      <BecauseRows history={history} />
      <PosterRow title="Trending Today" items={trending} to="/explore/trending-day" />
      <CollectionsRow />
      {FEED_ORDER.map((f) => (
        <FeedRow key={f} feed={f} />
      ))}
    </main>
  );
}
