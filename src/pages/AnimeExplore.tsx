import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { Grid, GridSkeleton, Status } from '../components/Rows';
import { A_GENRES, animePath } from '../lib/anime';
import type { ASort } from '../lib/anime';
import { tmdb } from '../lib/tmdb';
import { mediaKey } from '../lib/types';
import type { Media, MediaType } from '../lib/types';

type Format = 'all' | MediaType;
const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() + 1 - i));

/** Explore anime with filters: format, sort, genre and year. */
export default function AnimeExplore() {
  const [qs] = useSearchParams();
  const [format, setFormat] = useState<Format>('all');
  const [sort, setSort] = useState<ASort>('pop');
  const [slug, setSlug] = useState(() => (A_GENRES.some((g) => g.slug === qs.get('genre')) ? (qs.get('genre') as string) : ''));
  const [year, setYear] = useState('');
  const [items, setItems] = useState<Media[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // the address can change (e.g. a genre card) without remounting this page
  useEffect(() => {
    const g = qs.get('genre');
    setSlug(A_GENRES.some((x) => x.slug === g) ? (g as string) : '');
  }, [qs]);

  const load = useCallback(
    async (p: number) => {
      const genre = A_GENRES.find((g) => g.slug === slug);
      const kinds: MediaType[] = format === 'all' ? ['tv', 'movie'] : [format];
      setBusy(true);
      setError(null);
      try {
        const parts = await Promise.all(
          kinds.map((k) => {
            const path = animePath(k, { genre, sort, year });
            return path ? tmdb.list(path, k, p) : Promise.resolve({ items: [] as Media[], pages: 1 });
          })
        );
        // interleave series and films so "All" isn't one kind first
        const merged: Media[] = [];
        for (let i = 0; i < Math.max(...parts.map((x) => x.items.length)); i++) parts.forEach((x) => x.items[i] && merged.push(x.items[i]));
        setItems((cur) => {
          const base = p === 1 ? [] : cur;
          const seen = new Set(base.map(mediaKey));
          return [...base, ...merged.filter((m) => !seen.has(mediaKey(m)))];
        });
        setPage(p);
        setPages(Math.max(...parts.map((x) => x.pages)));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [format, sort, slug, year]
  );

  useEffect(() => {
    setItems([]);
    setPage(0);
    load(1);
  }, [load]);

  const dirty = format !== 'all' || sort !== 'pop' || slug !== '' || year !== '';

  return (
    <main className="page pad-top">
      <div className="container mid">
        <div className="page-head">
          <div>
            <h1 className="title">Explore <span className="accent">Anime</span></h1>
            <p className="muted">Filter series and films by genre, year and more.</p>
          </div>
          <div className="head-tools">
            <select className="field select dd" value={format} onChange={(e) => setFormat(e.target.value as Format)} aria-label="Format">
              <option value="all">All Formats</option>
              <option value="tv">Series</option>
              <option value="movie">Films</option>
            </select>
            <select className="field select dd" value={sort} onChange={(e) => setSort(e.target.value as ASort)} aria-label="Sort by">
              <option value="pop">Trending</option>
              <option value="rated">Top Rated</option>
              <option value="votes">Most Voted</option>
              <option value="new">Newest</option>
            </select>
            <select className="field select dd" value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Genre">
              <option value="">All Genres</option>
              {A_GENRES.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
            <select className="field select dd" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
              <option value="">Any Year</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            {dirty && (
              <button className="btn small ghost" onClick={() => { setFormat('all'); setSort('pop'); setSlug(''); setYear(''); }}>
                <Icon name="x" size={14} />Reset
              </button>
            )}
          </div>
        </div>

        {error && items.length === 0 ? (
          <Status kind="error" text={error} retry={() => load(1)} />
        ) : items.length === 0 && busy ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <Status kind="empty" text="Nothing found. Try another filter." />
        ) : (
          <>
            <Grid items={items} />
            {page < pages && (
              <div className="center-row">
                <button className="btn" disabled={busy} onClick={() => load(page + 1)}>{busy ? 'Loading…' : 'Load more'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
