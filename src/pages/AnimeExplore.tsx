import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { AnimeCard } from '../components/AnimeCard';
import { GridSkeleton, Status } from '../components/Rows';
import { FORMAT_LABEL, GENRES, STATUS_LABEL, aniList } from '../lib/anilist';
import type { Ani } from '../lib/anilist';

const YEARS = Array.from({ length: 40 }, (_, i) => String(new Date().getFullYear() + 1 - i));
const SORTS: [string, string][] = [['TRENDING_DESC', 'Trending'], ['POPULARITY_DESC', 'Most Popular'], ['SCORE_DESC', 'Top Rated'], ['START_DATE_DESC', 'Newest'], ['FAVOURITES_DESC', 'Most Favourited']];
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const FORMATS = ['TV', 'MOVIE', 'OVA', 'ONA', 'SPECIAL'];
const STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED'];
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** Explore anime with filters (genre, year, season, format, status, sort) and a search box. */
export default function AnimeExplore() {
  const [qs] = useSearchParams();
  const pick = (k: string, ok: (v: string) => boolean) => (ok(qs.get(k) ?? '') ? (qs.get(k) as string) : '');
  const [sort, setSort] = useState(() => pick('sort', (v) => SORTS.some(([k]) => k === v)) || 'TRENDING_DESC');
  const [genre, setGenre] = useState(() => pick('genre', (v) => GENRES.includes(v)));
  const [year, setYear] = useState(() => pick('year', (v) => /^\d{4}$/.test(v)));
  const [season, setSeason] = useState(() => pick('season', (v) => SEASONS.includes(v)));
  const [format, setFormat] = useState(() => pick('format', (v) => FORMATS.includes(v)));
  const [status, setStatus] = useState(() => pick('status', (v) => STATUSES.includes(v)));
  const [items, setItems] = useState<Ani[]>([]);
  const [page, setPage] = useState(1);
  const [last, setLast] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // the address can change (a genre card, a row's "Explore all") without remounting
  useEffect(() => {
    setSort(pick('sort', (v) => SORTS.some(([k]) => k === v)) || 'TRENDING_DESC');
    setGenre(pick('genre', (v) => GENRES.includes(v)));
    setYear(pick('year', (v) => /^\d{4}$/.test(v)));
    setSeason(pick('season', (v) => SEASONS.includes(v)));
    setFormat(pick('format', (v) => FORMATS.includes(v)));
    setStatus(pick('status', (v) => STATUSES.includes(v)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const load = useCallback(
    (p: number) => {
      setBusy(true);
      setError(null);
      aniList({ sort, genre, seasonYear: year ? Number(year) : undefined, season, format, status, page: p, perPage: 30 })
        .then((r) => {
          setItems(r.items);
          setPage(p);
          setLast(Math.max(r.last, 1));
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(false));
    },
    [sort, genre, year, season, format, status]
  );

  // any filter change starts again from page 1
  useEffect(() => {
    load(1);
  }, [load]);

  const go = (p: number) => {
    load(p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const dirty = genre || year || season || format || status || sort !== 'TRENDING_DESC';
  const field = (label: string, el: JSX.Element) => (
    <label className="aex-field"><span className="aex-label">{label}</span>{el}</label>
  );
  return (
    <main className="page pad-top">
      <div className="container mid">
        <header className="aex-head">
          <div>
            <span className="aex-eyebrow"><Icon name="flame" size={14} />ANIME CATALOG</span>
            <h1 className="title">Explore Anime <span className="accent">Universe</span></h1>
            <p className="muted">Filter through thousands of anime series, feature films, and seasonal releases.</p>
          </div>
          {!error && <span className="aex-badge">Page {page} of {last}</span>}
        </header>

        <section className="aex-panel" aria-label="Filter and sort">
          <div className="aex-panel-head">
            <span><Icon name="filter" size={14} />Filter &amp; Sort</span>
            {dirty && (
              <button className="aex-reset" onClick={() => { setSort('TRENDING_DESC'); setGenre(''); setYear(''); setSeason(''); setFormat(''); setStatus(''); }}>
                <Icon name="x" size={13} />Reset
              </button>
            )}
          </div>
          <div className="aex-fields">
            {field('Sort By', (
              <select className="field select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </select>
            ))}
            {field('Genre', (
              <select className="field select" value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">All Genres</option>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            ))}
            {field('Format', (
              <select className="field select" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="">All Formats</option>
                {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
              </select>
            ))}
            {field('Season', (
              <select className="field select" value={season} onChange={(e) => setSeason(e.target.value)}>
                <option value="">All Seasons</option>
                {SEASONS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
              </select>
            ))}
            {field('Year', (
              <select className="field select" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="">All Years</option>
                {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            ))}
            {field('Status', (
              <select className="field select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any Status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            ))}
          </div>
        </section>

        {error && items.length === 0 ? (
          <Status kind="error" text={error} retry={() => load(page)} />
        ) : items.length === 0 && busy ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <Status kind="empty" text="Nothing found. Try other filters." />
        ) : (
          <>
            <div className={`grid cards ${busy ? 'aex-busy' : ''}`}>{items.map((a) => <AnimeCard key={a.id} a={a} />)}</div>
            <nav className="aex-pager" aria-label="Pages">
              <button className="aex-pg" disabled={busy || page <= 1} onClick={() => go(page - 1)}><Icon name="chevronLeft" size={14} />Previous</button>
              <span className="aex-pg cur" aria-current="page">{page} / {last}</span>
              <button className="aex-pg" disabled={busy || page >= last} onClick={() => go(page + 1)}>Next<Icon name="chevronRight" size={14} /></button>
            </nav>
          </>
        )}
      </div>
    </main>
  );
}
