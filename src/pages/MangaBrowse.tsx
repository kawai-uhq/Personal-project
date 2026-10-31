import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { MangaCard } from '../components/MangaCard';
import { GridSkeleton, Status } from '../components/Rows';
import SearchBox from '../components/SearchBox';
import Select from '../components/Select';
import { MANGA_GENRES, MANGA_STATUS, mangaList } from '../lib/manga';
import type { Manga } from '../lib/manga';

const SORTS: [string, string][] = [['TRENDING_DESC', 'Trending'], ['POPULARITY_DESC', 'Most Popular'], ['SCORE_DESC', 'Top Rated'], ['START_DATE_DESC', 'Newest'], ['FAVOURITES_DESC', 'Most Favourited'], ['CHAPTERS_DESC', 'Most Chapters'], ['START_DATE', 'Oldest'], ['TITLE_ENGLISH', 'Title A–Z'], ['UPDATED_AT_DESC', 'Recently Updated']];
const COUNTRIES: [string, string][] = [['JP', 'Manga (Japan)'], ['KR', 'Manhwa (Korea)'], ['CN', 'Manhua (China)']];
const STATUSES = ['RELEASING', 'FINISHED', 'HIATUS', 'NOT_YET_RELEASED'];

/** Search and explore manga, manhwa and manhua with filters. */
export default function MangaBrowse() {
  const [qs] = useSearchParams();
  const pick = (k: string, ok: (v: string) => boolean) => (ok(qs.get(k) ?? '') ? (qs.get(k) as string) : '');
  const read = () => ({
    q: qs.get('q') ?? '',
    sort: pick('sort', (v) => SORTS.some(([k]) => k === v)) || 'TRENDING_DESC',
    genre: pick('genre', (v) => MANGA_GENRES.includes(v)),
    country: pick('country', (v) => COUNTRIES.some(([k]) => k === v)),
    format: pick('format', (v) => v === 'ONE_SHOT'),
    status: pick('status', (v) => STATUSES.includes(v))
  });
  const init = read();
  const [q, setQ] = useState(init.q);
  const [sort, setSort] = useState(init.sort);
  const [genre, setGenre] = useState(init.genre);
  const [country, setCountry] = useState(init.country);
  const [format, setFormat] = useState(init.format);
  const [status, setStatus] = useState(init.status);
  const [items, setItems] = useState<Manga[]>([]);
  const [more, setMore] = useState(false);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ticket = useRef(0);

  // the address can change (a genre link, a row's "Explore all", the top search) without remounting
  useEffect(() => {
    const r = read();
    setQ(r.q); setSort(r.sort); setGenre(r.genre); setCountry(r.country); setFormat(r.format); setStatus(r.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  const load = useCallback((term: string, p: number) => {
    const id = ++ticket.current;
    setBusy(true);
    setError(null);
    mangaList({ search: term || undefined, sort, genre, country, format, status, page: p, perPage: 30 })
      .then((r) => {
        if (id !== ticket.current) return;
        setItems((cur) => (p === 1 ? r.items : [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))]));
        setPage(p);
        setMore(r.more);
      })
      .catch((e: Error) => id === ticket.current && setError(e.message))
      .finally(() => id === ticket.current && setBusy(false));
  }, [sort, genre, country, format, status]);

  useEffect(() => {
    const t = window.setTimeout(() => load(q.trim(), 1), q.trim() ? 400 : 0);
    return () => window.clearTimeout(t);
  }, [q, load]);

  const dirty = genre || country || format || status || sort !== 'TRENDING_DESC';
  const field = (label: string, el: JSX.Element) => <label className="aex-field"><span className="aex-label">{label}</span>{el}</label>;
  return (
    <main className="page pad-top">
      <div className="container mid">
        <header className="aex-head">
          <div>
            <span className="aex-eyebrow"><Icon name="book" size={14} />MANGA CATALOG</span>
            <h1 className="title">Explore <span className="accent">Manga</span></h1>
            <p className="muted">Search and filter manga, manhwa and manhua.</p>
          </div>
        </header>
        <div className="s-bar" style={{ margin: '0 0 16px' }}>
          <SearchBox wide type="search" inputClassName="field big" value={q} onChange={setQ} onSubmit={(t) => load(t, 1)} />
          <button type="button" className="s-btn" onClick={() => load(q.trim(), 1)}>SEARCH</button>
        </div>
        <section className="aex-panel" aria-label="Filter and sort">
          <div className="aex-panel-head">
            <span><Icon name="filter" size={14} />Filter &amp; Sort</span>
            {dirty && (
              <button className="aex-reset" onClick={() => { setSort('TRENDING_DESC'); setGenre(''); setCountry(''); setFormat(''); setStatus(''); }}>
                <Icon name="x" size={13} />Reset
              </button>
            )}
          </div>
          <div className="aex-fields">
            {field('Sort By', (
              <Select className="field select" value={sort} onChange={(e) => setSort(e.target.value)}>
                {SORTS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </Select>
            ))}
            {field('Type', (
              <Select className="field select" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Manga, Manhwa &amp; Manhua</option>
                {COUNTRIES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
              </Select>
            ))}
            {field('Genre', (
              <Select className="field select" value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">All Genres</option>
                {MANGA_GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            ))}
            {field('Length', (
              <Select className="field select" value={format} onChange={(e) => setFormat(e.target.value)}>
                <option value="">Series &amp; one-shots</option>
                <option value="ONE_SHOT">One-shots only</option>
              </Select>
            ))}
            {field('Status', (
              <Select className="field select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Any Status</option>
                {STATUSES.map((s) => <option key={s} value={s}>{MANGA_STATUS[s]}</option>)}
              </Select>
            ))}
          </div>
        </section>
        {error && items.length === 0 ? (
          <Status kind="error" text={error} retry={() => load(q.trim(), 1)} />
        ) : items.length === 0 && busy ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <Status kind="empty" text="Nothing found. Try another title or other filters." />
        ) : (
          <>
            <div className="grid cards">{items.map((m) => <MangaCard key={m.id} m={m} />)}</div>
            {more && <div className="center-row"><button className="btn" disabled={busy} onClick={() => load(q.trim(), page + 1)}>{busy ? 'Loading…' : 'Load more'}</button></div>}
          </>
        )}
      </div>
    </main>
  );
}
