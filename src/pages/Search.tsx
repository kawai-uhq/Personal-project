import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Grid, Status } from '../components/Rows';
import SearchBox from '../components/SearchBox';
import Surprise from '../components/Surprise';
import { tmdb } from '../lib/tmdb';
import type { Media } from '../lib/types';

type Filter = 'all' | 'movie' | 'tv';

export default function Search() {
  const [sp] = useSearchParams();
  const urlQ = sp.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const [results, setResults] = useState<Media[] | null>(null);
  const [top, setTop] = useState<Media[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const ticket = useRef(0);

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  useEffect(() => {
    tmdb.trending().then(setTop).catch(() => undefined);
  }, []);

  const run = useCallback((term: string) => {
    const id = ++ticket.current;
    setBusy(true);
    setError(null);
    tmdb
      .search(term)
      .then((r) => {
        if (id !== ticket.current) return;
        setResults(r);
        setBusy(false);
      })
      .catch((e: Error) => {
        if (id !== ticket.current) return;
        setError(e.message || "Couldn't search. Try again.");
        setBusy(false);
      });
  }, []);

  const keepUrl = (term: string) => {
    try {
      const path = window.location.pathname;
      window.history.replaceState(window.history.state, '', term ? `${path}?q=${encodeURIComponent(term)}` : path);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      ticket.current++;
      setResults(null);
      setError(null);
      setBusy(false);
      keepUrl('');
      return;
    }
    const t = window.setTimeout(() => {
      run(term);
      keepUrl(term);
    }, 350);
    return () => window.clearTimeout(t);
  }, [q, run]);

  const counts = useMemo(
    () => ({
      all: results?.length ?? 0,
      movie: results?.filter((m) => m.type === 'movie').length ?? 0,
      tv: results?.filter((m) => m.type === 'tv').length ?? 0
    }),
    [results]
  );
  const shown = (results ?? []).filter((m) => filter === 'all' || m.type === filter);

  return (
    <main className="page pad-top">
      <div className="container">
        <div className="s-hero">
          <h1>Search Comvie</h1>
          <p>Find your next favourite movie or series</p>
          <div className="s-bar">
            <SearchBox
              wide
              type="search"
              autoFocus
              inputClassName="field big"
              value={q}
              onChange={setQ}
              onSubmit={(term) => {
                run(term);
                keepUrl(term);
              }}
            />
            <button
              type="button"
              className="s-btn"
              onClick={() => {
                const t = q.trim();
                if (t) {
                  run(t);
                  keepUrl(t);
                }
              }}
            >
              SEARCH
            </button>
          </div>
          <p style={{ marginTop: 14 }}><Surprise /></p>
        </div>

        {error ? (
          <Status kind="error" text={error} retry={() => run(q.trim())} />
        ) : results === null && busy ? (
          <Status kind="loading" />
        ) : results === null ? (
          <>
            <h2 className="section">Top Searches</h2>
            <Grid items={top} cards />
          </>
        ) : (
          <>
            <div className="pills" role="tablist" aria-label="Filter results">
              <button className={`pill ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>All Results ({counts.all})</button>
              <button className={`pill ${filter === 'movie' ? 'on' : ''}`} onClick={() => setFilter('movie')}>Movies ({counts.movie})</button>
              <button className={`pill ${filter === 'tv' ? 'on' : ''}`} onClick={() => setFilter('tv')}>TV Series ({counts.tv})</button>
            </div>
            {shown.length === 0 ? (
              <Status kind="empty" text={`Nothing found for "${q.trim()}".`} />
            ) : (
              <Grid items={shown} cards />
            )}
          </>
        )}
      </div>
    </main>
  );
}
