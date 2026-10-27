import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRegion } from '../lib/region';
import { tmdb } from '../lib/tmdb';
import type { Svc } from '../lib/streamers';
import { Row } from './Rows';
import ProviderLogo from './ProviderLogo';

/** "Browse by Provider": the most popular services in the visitor's country, then a tile for every one. */
export default function ProviderRow() {
  const [region] = useRegion();
  const [list, setList] = useState<Svc[]>([]);
  useEffect(() => {
    let live = true;
    tmdb.providers(region).then((l) => live && setList(l.filter((p) => p.logo).slice(0, 20))).catch(() => {});
    return () => {
      live = false;
    };
  }, [region]);
  if (!list.length) return null;
  return (
    <Row title="Browse by Provider" to="/providers">
      {list.map((p) => (
        <Link key={p.id} to={`/provider/${p.id}`} className="ptile">
          <ProviderLogo s={p} />
          <span>{p.name}</span>
        </Link>
      ))}
      <Link to="/providers" className="ptile">
        <span className="plogo all" style={{ width: 64, height: 64 }}>All</span>
        <span>See all</span>
      </Link>
    </Row>
  );
}
