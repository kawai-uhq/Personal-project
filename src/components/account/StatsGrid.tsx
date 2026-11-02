import type { WatchStats } from '../../lib/stats';

/** Watch stats tiles (used on the account page and public profiles). */
export default function StatsGrid({ stats }: { stats: Partial<WatchStats> }) {
  const tiles: [string, number | undefined, string][] = [
    ['Hours watched', stats.hours, '≈'],
    ['Movies', stats.movies, ''],
    ['TV episodes', stats.episodes, ''],
    ['Anime episodes', stats.animeEpisodes, ''],
    ['Manga chapters', stats.chapters, ''],
    ['Day streak', stats.streak, '']
  ];
  return (
    <div className="acct-stats">
      {tiles.map(([label, n, pre]) => (
        <div key={label} className="acct-stat"><strong>{pre}{(n ?? 0).toLocaleString()}</strong><small>{label}</small></div>
      ))}
    </div>
  );
}
