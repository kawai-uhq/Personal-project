import { useCallback, useEffect, useState } from 'react';
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
export default function Provider() {
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
      const path = `/discover/${type}?with_watch_providers=${id}&watch_region=${region}&with_watch_monetization_types=flatrate|free|ads&sort_by=popularity.desc`;
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
    [id, type, region]
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
        <p className="crumb"><Link to="/providers" className="link"><Icon name="chevronLeft" size={14} />All providers</Link></p>
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
        {error && items.length === 0 ? (
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
