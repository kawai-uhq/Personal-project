import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import ProviderLogo from '../components/ProviderLogo';
import RegionSelect from '../components/RegionSelect';
import { Grid, GridSkeleton, Status } from '../components/Rows';
import { useRegion } from '../lib/region';
import { LEGACY, colorFor } from '../lib/streamers';
import type { Svc } from '../lib/streamers';
import { tmdb } from '../lib/tmdb';
import { mediaKey } from '../lib/types';
import type { Media, MediaType } from '../lib/types';

/** Everything on one streaming service, with Movies / Series tabs. */
export default function Provider({ anime = false }: { anime?: boolean }) {
  const { id: param } = useParams();
  const id = Number(param) || LEGACY[param ?? ''] || 0;
  const [region] = useRegion();
  const [svc, setSvc] = useState<Svc | null>(null);
  const [type, setType] = useState<MediaType>('movie');
  const [items, setItems] = useState<Media[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // search inside this service
  const [q, setQ] = useState('');
  const [sq, setSq] = useState('');
  const [sItems, setSItems] = useState<Media[]>([]);
  const [sPage, setSPage] = useState(0);
  const [sPages, setSPages] = useState(1);
  const [sBusy, setSBusy] = useState(false);
  const [sErr, setSErr] = useState<string | null>(null);
  const run = useRef(0);
  useEffect(() => {
    const h = window.setTimeout(() => setSq(q.trim()), 400);
    return () => window.clearTimeout(h);
  }, [q]);

  // fetch search pages until a dozen matches turn up (or the results run out)
  const searchFrom = useCallback(
    async (start: number, fresh: boolean) => {
      if (!id || !sq) return;
      const mine = ++run.current;
      setSBusy(true);
      setSErr(null);
      try {
        let page = start;
        let total = 1;
        let found = 0;
        while (page <= total && page < start + 5 && found < 12) {
          const r = await tmdb.searchOn(type, sq, id, region, page, anime);
          if (mine !== run.current) return;
          total = r.pages;
          found += r.items.length;
          setSItems((cur) => {
            const base = fresh && page === start ? [] : cur;
            const seen = new Set(base.map(mediaKey));
            return [...base, ...r.items.filter((m) => !seen.has(mediaKey(m)))];
          });
          setSPage(page);
          setSPages(total);
          page++;
        }
      } catch (e) {
        if (mine === run.current) setSErr((e as Error).message);
      } finally {
        if (mine === run.current) setSBusy(false);
      }
    },
    [id, sq, type, region, anime]
  );
  useEffect(() => {
    setSItems([]);
    setSPage(0);
    setSPages(1);
    if (sq) searchFrom(1, true);
    else {
      run.current++;
      setSBusy(false);
    }
  }, [sq, searchFrom]);

  // name and logo: this country's list first, then the worldwide one
  useEffect(() => {
    let live = true;
    setSvc(null);
    tmdb
      .providers(region)
      .then((l) => l.find((s) => s.id === id) ?? tmdb.providers('').then((g) => g.find((s) => s.id === id)))
      .then((s) => live && setSvc(s ?? { id, name: 'Streaming service', logo: null }))
      .catch(() => live && setSvc({ id, name: 'Streaming service', logo: null }));
    return () => { live = false; };
  }, [id, region]);

  const load = useCallback(
    (p: number) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      const path = `/discover/${type}?with_watch_providers=${id}&watch_region=${region}&with_watch_monetization_types=flatrate|free|ads&sort_by=popularity.desc${anime ? '&with_genres=16&with_original_language=ja' : ''}`;
      tmdb
        .list(path, type, p)
        .then((r) => {
          setItems((cur) => {
            const seen = new Set(cur.map(mediaKey));
            return p === 1 ? r.items : [...cur, ...r.items.filter((m) => !seen.has(mediaKey(m)))];
          });
          setPage(p);
          setPages(r.pages);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    },
    [id, type, region, anime]
  );

  useEffect(() => {
    setItems([]);
    setPage(0);
    load(1);
  }, [load]);

  if (!id) return <main className="page pad-top"><Status kind="empty" text="That service isn't here." /></main>;

  return (
    <main className="page pad-top prov-page" style={{ ['--pc' as string]: colorFor(id) }}>
      <div className="prov-bg" aria-hidden="true" />
      <div className="container">
        <p className="crumb"><Link to={anime ? '/anime' : '/providers'} className="link"><Icon name="chevronLeft" size={14} />{anime ? 'Anime' : 'All providers'}</Link></p>
        <div className="prov-head">
          {svc && <ProviderLogo s={svc} size={72} />}
          <h1 className="title">{svc?.name ?? ' '}</h1>
          <div className="prov-region"><RegionSelect /></div>
        </div>
        <div className="pills" style={{ justifyContent: 'flex-start' }} role="tablist" aria-label="Type">
          {(['movie', 'tv'] as MediaType[]).map((k) => (
            <button key={k} role="tab" aria-selected={type === k} className={`pill ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>
              {k === 'movie' ? 'Movies' : 'Series'}
            </button>
          ))}
        </div>
        <div className="prov-search">
          <Icon name="search" size={16} />
          <input
            className="field"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${type === 'movie' ? 'movies' : 'series'} on ${svc?.name ?? 'this service'}…`}
            aria-label="Search this service"
          />
        </div>
        {sq ? (
          sErr && sItems.length === 0 ? (
            <Status kind="error" text={sErr} retry={() => searchFrom(1, true)} />
          ) : sItems.length === 0 ? (
            <Status kind={sBusy ? 'loading' : 'empty'} text={sBusy ? 'Searching…' : `Nothing for “${sq}” on ${svc?.name ?? 'this service'} in this country.`} />
          ) : (
            <>
              <Grid items={sItems} />
              {sPage < sPages && (
                <div className="center-row">
                  <button className="btn" disabled={sBusy} onClick={() => searchFrom(sPage + 1, false)}>{sBusy ? 'Searching…' : 'Search more'}</button>
                </div>
              )}
            </>
          )
        ) : error && items.length === 0 ? (
          <Status kind="error" text={error} retry={() => load(1)} />
        ) : items.length === 0 && loading ? (
          <GridSkeleton />
        ) : items.length === 0 ? (
          <Status kind="empty" text="Nothing found here. Try another country." />
        ) : (
          <>
            <Grid items={items} />
            {page < pages && (
              <div className="center-row">
                <button className="btn" disabled={loading} onClick={() => load(page + 1)}>{loading ? 'Loading…' : 'Load more'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
