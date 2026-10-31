import Icon from '../components/Icon';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GridSkeleton, Poster, Status } from '../components/Rows';
import Surprise from '../components/Surprise';
import { genresFor } from '../lib/genres';
import { FEEDS, tmdb } from '../lib/tmdb';
import { mediaKey } from '../lib/types';
import type { Media, MediaType } from '../lib/types';
import Select from '../components/Select';

const TABS: Record<MediaType, { feed: string; label: string }[]> = {
  movie: [
    { feed: 'popular-movie', label: 'Popular' },
    { feed: 'trending-movie', label: 'Trending Today' },
    { feed: 'top-movie', label: 'Top Rated' },
    { feed: 'upcoming', label: 'Upcoming' },
    { feed: 'now-playing', label: 'Now Playing' }
  ],
  tv: [
    { feed: 'popular-tv', label: 'Popular' },
    { feed: 'trending-tv', label: 'Trending Today' },
    { feed: 'top-tv', label: 'Top Rated' },
    { feed: 'on-air', label: 'Currently Airing' },
    { feed: 'airing-today', label: 'Airing Today' }
  ]
};

type Sort = 'pop' | 'rated' | 'new' | 'votes' | 'old' | 'az';
const today = () => new Date().toISOString().slice(0, 10);

const LANGS: [string, string][] = [
  ['en', 'English'], ['hi', 'Hindi'], ['ja', 'Japanese'], ['ko', 'Korean'], ['es', 'Spanish'], ['fr', 'French'],
  ['de', 'German'], ['it', 'Italian'], ['zh', 'Chinese'], ['ta', 'Tamil'], ['te', 'Telugu'], ['ml', 'Malayalam'],
  ['pt', 'Portuguese'], ['ru', 'Russian'], ['tr', 'Turkish'], ['th', 'Thai']
];
const RATINGS = [6, 7, 8];

/** "2024", "2020s" etc. -> [from, to] dates */
const yearRange = (y: string): [string, string] | null => {
  if (!y) return null;
  if (y === 'old') return ['1900-01-01', '1989-12-31'];
  if (y.endsWith('s')) {
    const d = Number(y.slice(0, 4));
    return [`${d}-01-01`, `${d + 9}-12-31`];
  }
  return [`${y}-01-01`, `${y}-12-31`];
};
const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() + 1 - i));

/** The Movies and TV Shows pages (with tabs, genre and sort), or a plain full list for /explore/:feed. */
export default function Explore({ kind }: { kind?: MediaType }) {
  const params = useParams();
  const [tab, setTab] = useState(kind ? TABS[kind][0].feed : params.feed ?? '');
  const [genre, setGenre] = useState('');
  const [sort, setSort] = useState<Sort>('pop');
  const [year, setYear] = useState('');
  const [minRating, setMinRating] = useState('');
  const [lang, setLang] = useState('');
  const filtered = year !== '' || minRating !== '' || lang !== '';

  // /explore/:feed changes with the address
  useEffect(() => {
    if (!kind) setTab(params.feed ?? '');
  }, [kind, params.feed]);

  const custom = !!kind && (genre !== '' || sort !== 'pop' || filtered);
  const def = FEEDS[tab];

  const { path, type } = useMemo(() => {
    if (kind && custom) {
      const k = kind;
      const dateKey = k === 'movie' ? 'primary_release_date' : 'first_air_date';
      const q: string[] = [];
      const range = yearRange(year);
      const voteFloor = sort === 'rated' || minRating ? 300 : sort === 'new' ? (k === 'movie' ? 20 : 10) : 0;
      const by: Record<Sort, string> = {
        pop: 'popularity.desc',
        rated: 'vote_average.desc',
        new: `${dateKey}.desc`,
        votes: 'vote_count.desc',
        old: `${dateKey}.asc`,
        az: k === 'movie' ? 'title.asc' : 'name.asc'
      };
      q.push(`sort_by=${by[sort]}`);
      if (sort === 'old' || sort === 'az') q.push('vote_count.gte=100');
      if (genre) q.push(`with_genres=${genre}`);
      if (range) q.push(`${dateKey}.gte=${range[0]}`, `${dateKey}.lte=${sort === 'new' && range[1] > today() ? today() : range[1]}`);
      else if (sort === 'new') q.push(`${dateKey}.lte=${today()}`);
      if (minRating) q.push(`vote_average.gte=${minRating}`);
      if (lang) q.push(`with_original_language=${lang}`);
      if (voteFloor) q.push(`vote_count.gte=${minRating ? Math.min(voteFloor, 150) : voteFloor}`);
      return { path: `/discover/${k}?${q.join('&')}`, type: k as 'all' | MediaType };
    }
    return { path: def?.path ?? '', type: (def?.type ?? 'all') as 'all' | MediaType };
  }, [kind, custom, sort, genre, year, minRating, lang, def]);

  const [items, setItems] = useState<Media[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems([]);
    setPage(1);
    setPages(1);
    setError(null);
  }, [path]);

  useEffect(() => {
    if (!path) return;
    let live = true;
    setBusy(true);
    tmdb
      .list(path, type, page)
      .then((r) => {
        if (!live) return;
        setItems((cur) => {
          const seen = new Set(cur.map(mediaKey));
          return [...cur, ...r.items.filter((m) => !seen.has(mediaKey(m)))];
        });
        setPages(r.pages);
        setBusy(false);
      })
      .catch((e: Error) => {
        if (!live) return;
        setError(e.message);
        setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [path, type, page]);

  if (!kind && !def) return <main className="page pad-top"><Status kind="empty" text="That list doesn't exist." /></main>;

  const word = kind === 'movie' ? 'Movies' : kind === 'tv' ? 'TV Series' : '';
  const lead = kind === 'movie' ? 'Explore' : 'Discover';
  const sub =
    kind === 'movie'
      ? 'Filter by genre, year, rating and language.'
      : kind === 'tv'
        ? 'Binge-worthy shows, critically acclaimed series, and live airing episodes.'
        : 'Explore everything in this list.';

  return (
    <main className="page pad-top">
      <div className="container mid">
        <div className="page-head">
          <div>
            <h1 className="title">
              {kind ? (
                <>{lead} <span className="accent">{word}</span></>
              ) : (
                <span className="accent">{def.title}</span>
              )}
            </h1>
            <p className="muted">{sub}</p>
          </div>
          {kind && (
            <div className="head-tools">
              <Surprise type={kind} genre={genre} />
              <Select className="field select dd" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
                <option value="">{kind === 'tv' ? 'All TV Genres' : 'All Genres'}</option>
                {genresFor(kind).map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </Select>
              <Select className="field select dd" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by">
                <option value="pop">Most Popular</option>
                <option value="rated">Top Rated</option>
                <option value="new">Newest</option>
                <option value="votes">Most Voted</option>
                <option value="old">Oldest</option>
                <option value="az">Title A–Z</option>
              </Select>
              <Select className="field select dd" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
                <option value="">Any Year</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                <option value="2010s">2010s</option>
                <option value="2000s">2000s</option>
                <option value="1990s">1990s</option>
                <option value="old">Before 1990</option>
              </Select>
              <Select className="field select dd" value={minRating} onChange={(e) => setMinRating(e.target.value)} aria-label="Minimum rating">
                <option value="">Any Rating</option>
                {RATINGS.map((r) => <option key={r} value={r}>{r}+ rating</option>)}
              </Select>
              <Select className="field select dd" value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
                <option value="">Any Language</option>
                {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
              </Select>
              {custom && (
                <button className="btn small ghost" onClick={() => { setGenre(''); setSort('pop'); setYear(''); setMinRating(''); setLang(''); }}>
                  <Icon name="x" size={14} />Reset
                </button>
              )}
            </div>
          )}
        </div>

        {kind && (
          <div className="pills" style={{ justifyContent: 'flex-start' }} role="tablist" aria-label="Lists">
            {TABS[kind].map((t) => (
              <button
                key={t.feed}
                role="tab"
                aria-selected={!custom && tab === t.feed}
                className={`pill ${!custom && tab === t.feed ? 'on' : ''}`}
                onClick={() => {
                  setTab(t.feed);
                  setGenre('');
                  setSort('pop');
                  setYear('');
                  setMinRating('');
                  setLang('');
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {error && items.length === 0 ? (
          <Status kind="error" text={error} retry={() => { setError(null); setPage(1); }} />
        ) : items.length === 0 && busy ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <Status kind="empty" text="Nothing found here." />
        ) : (
          <>
            <div className="grid cards">{items.map((m) => <Poster key={mediaKey(m)} m={m} />)}</div>
            {page < pages && (
              <div className="center">
                <button className="btn" disabled={busy} onClick={() => setPage((p) => p + 1)}>
                  {busy ? 'Loading…' : `LOAD MORE ${word ? word.toUpperCase() : ''}`.trim()}
                </button>
              </div>
            )}
          </>
        )}
        {!kind && (
          <p className="muted small"><Link to="/" className="link"><Icon name="chevronLeft" size={14} />Back to home</Link></p>
        )}
      </div>
    </main>
  );
}
