import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import ProviderLogo from '../components/ProviderLogo';
import RegionSelect from '../components/RegionSelect';
import { Status } from '../components/Rows';
import { useRegion } from '../lib/region';
import { tmdb } from '../lib/tmdb';
import type { Svc } from '../lib/streamers';

/** Every streaming service available in the chosen country. */
export default function Providers() {
  const [region] = useRegion();
  const [list, setList] = useState<Svc[] | null>(null);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    setList(null);
    setError(false);
    tmdb.providers(region).then((l) => live && setList(l)).catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [region]);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (list ?? []).filter((p) => !n || p.name.toLowerCase().includes(n));
  }, [list, q]);

  return (
    <main className="page pad-top">
      <div className="container">
        <p className="crumb"><Link to="/" className="link"><Icon name="chevronLeft" size={14} />Home</Link></p>
        <div className="page-head">
          <div>
            <h1 className="title">Browse by <span className="accent">Provider</span></h1>
            <p className="muted">Every streaming service available in your country{list ? ` (${list.length})` : ''}.</p>
          </div>
          <div className="head-tools">
            <RegionSelect />
          </div>
        </div>
        <input className="field" type="search" placeholder="Search services…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search services" />
        {error ? (
          <Status kind="error" text="Couldn't load the services." retry={() => setQ((x) => x + '')} />
        ) : !list ? (
          <Status kind="loading" text="Loading…" />
        ) : shown.length === 0 ? (
          <Status kind="empty" text="No services found." />
        ) : (
          <div className="pgrid">
            {shown.map((p) => (
              <Link key={p.id} to={`/provider/${p.id}`} className="ptile">
                <ProviderLogo s={p} />
                <span>{p.name}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
