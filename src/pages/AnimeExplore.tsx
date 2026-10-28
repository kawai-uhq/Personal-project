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
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [items, setItems] = useState<Ani[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
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

  useEffect(() => {
    const h = window.setTimeout(() => setTerm(text.trim()), 400);
    return () => window.clearTimeout(h);
  }, [text]);

  const load = useCallback(
    (p: number) => {
      setBusy(true);
      setError(null);
      aniList({ sort, genre, seasonYear: year ? Number(year) : undefined, season, format, status, search: term, page: p, perPage: 30 })
        .then((r) => {
          setItems((cur) => {
            const base = p === 1 ? [] : cur;
            const seen = new Set(base.map((x) => x.id));
            return [...base, ...r.items.filter((x) => !seen.has(x.id))];
          });
          setPage(p);
          setMore(r.more);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setBusy(false));
    },
    [sort, genre, year, season, format, status, term]
  );

  useEffect(() => {
    setItems([]);
    setPage(0);
    load(1);
  }, [load]);

  const dirty = genre || year || season || format || status || text || sort !== 'TRENDING_DESC';
  return (
    <main className="page pad-top">
      <div className="container mid">
        <div className="page-head">
          <div>
            <h1 className="title">Explore <span className="accent">Anime</span></h1>
            <p className="muted">Filter by genre, year, season, format and more.</p>
          </div>
        </div>
        <div className="head-tools aex-tools">
          <input className="field" type="search" placeholder="Search anime…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search anime" />
          <select className="field select dd" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort by" disabled={!!term}>
            {SORTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select>
          <select className="field select dd" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
            <option value="">All Genres</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select className="field select dd" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
            <option value="">Any Year</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="field select dd" value={season} onChange={(e) => setSeason(e.target.value)} aria-label="Season">
            <option value="">Any Season</option>
            {SEASONS.map((s) => <option key={s} value={s}>{cap(s)}</option>)}
          </select>
          <select className="field select dd" value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Format">
            <option value="">All Formats</option>
            {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
          </select>
          <select className="field select dd" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">Any Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          {dirty && (
            <button className="btn small ghost" onClick={() => { setSort('TRENDING_DESC'); setGenre(''); setYear(''); setSeason(''); setFormat(''); setStatus(''); setText(''); }}>
              <Icon name="x" size={14} />Reset
            </button>
          )}
        </div>

        {error && items.length === 0 ? (
          <Status kind="error" text={error} retry={() => load(1)} />
        ) : items.length === 0 && busy ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <Status kind="empty" text="Nothing found. Try other filters." />
        ) : (
          <>
            <div className="grid cards">{items.map((a) => <AnimeCard key={a.id} a={a} />)}</div>
            {more && (
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
