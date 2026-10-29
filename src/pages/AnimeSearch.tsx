import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AnimeCard } from '../components/AnimeCard';
import SearchBox from '../components/SearchBox';
import { Status } from '../components/Rows';
import { aniList } from '../lib/anilist';
import type { Ani } from '../lib/anilist';

/** Search inside the anime section: AniList only, so no movies or TV shows come up. */
export default function AnimeSearch() {
  const [sp] = useSearchParams();
  const urlQ = sp.get('q') ?? '';
  const [q, setQ] = useState(urlQ);
  const [items, setItems] = useState<Ani[] | null>(null);
  const [top, setTop] = useState<Ani[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const ticket = useRef(0);

  useEffect(() => setQ(urlQ), [urlQ]);
  useEffect(() => {
    aniList({ sort: 'TRENDING_DESC', perPage: 24 }).then((r) => setTop(r.items)).catch(() => undefined);
  }, []);

  const run = useCallback((term: string, p: number) => {
    const id = ++ticket.current;
    setBusy(true);
    setError(null);
    aniList({ search: term, perPage: 30, page: p })
      .then((r) => {
        if (id !== ticket.current) return;
        setItems((cur) => (p === 1 || !cur ? r.items : [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))]));
        setPage(p);
        setMore(r.more);
      })
      .catch((e: Error) => id === ticket.current && setError(e.message))
      .finally(() => id === ticket.current && setBusy(false));
  }, []);

  const keepUrl = (term: string) => {
    try {
      const path = window.location.pathname;
      window.history.replaceState(window.history.state, '', term ? `${path}?q=${encodeURIComponent(term)}` : path);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      ticket.current++;
      setItems(null);
      setError(null);
      setBusy(false);
      keepUrl('');
      return;
    }
    const t = window.setTimeout(() => {
      run(term, 1);
      keepUrl(term);
    }, 400);
    return () => window.clearTimeout(t);
  }, [q, run]);

  const term = q.trim();
  // later seasons hide behind their first season (open it to switch season)
  const ids = new Set((items ?? []).map((x) => x.id));
  const shown = (items ?? []).filter((x) => all || !x.pre.some((p) => ids.has(p)));
  const hidden = (items ?? []).length - shown.length;
  return (
    <main className="page pad-top">
      <div className="container">
        <div className="s-hero">
          <h1>Search Anime</h1>
          <p>Find your next favourite anime</p>
          <div className="s-bar">
            <SearchBox wide type="search" autoFocus inputClassName="field big" value={q} onChange={setQ} onSubmit={(t) => { run(t, 1); keepUrl(t); }} />
            <button type="button" className="s-btn" onClick={() => term && run(term, 1)}>SEARCH</button>
          </div>
        </div>
        {error ? (
          <Status kind="error" text={error} retry={() => run(term, 1)} />
        ) : items === null && !busy ? (
          <>
            <h2 className="section">Trending Anime</h2>
            <div className="grid cards">{top.map((a) => <AnimeCard key={a.id} a={a} />)}</div>
          </>
        ) : items === null ? (
          <Status kind="loading" />
        ) : items.length === 0 ? (
          <Status kind="empty" text={`No anime found for "${term}".`} />
        ) : (
          <>
            <p className="muted" style={{ margin: '4px 2px 14px' }}>
              {shown.length}{more ? '+' : ''} results
              {hidden > 0 && <> · {hidden} later season{hidden === 1 ? '' : 's'} grouped under the first season. <button className="link" onClick={() => setAll(true)}>Show every season</button></>}
              {all && <> · <button className="link" onClick={() => setAll(false)}>Group seasons</button></>}
            </p>
            <div className="grid cards">{shown.map((a) => <AnimeCard key={a.id} a={a} />)}</div>
            {more && (
              <div className="center-row">
                <button className="btn" disabled={busy} onClick={() => run(term, page + 1)}>{busy ? 'Loading…' : 'Load more'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
