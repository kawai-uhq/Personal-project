import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ANIME_PROVIDERS } from '../lib/anime';
import { useRegion } from '../lib/region';
import { tmdb } from '../lib/tmdb';
import type { Svc } from '../lib/streamers';
import { Row } from './Rows';
import ProviderLogo from './ProviderLogo';

/** The anime streaming services available in the visitor's country; each opens an anime-only list. */
export default function AnimeProviderRow() {
  const [region] = useRegion();
  const [list, setList] = useState<Svc[]>([]);
  useEffect(() => {
    let live = true;
    tmdb
      .providers(region)
      .then((l) => {
        if (!live) return;
        const rank = (id: number) => ANIME_PROVIDERS.indexOf(id);
        // Prime Video has two ids in some countries: show just one
        const seen = new Set<string>();
        setList(
          l
            .filter((p) => rank(p.id) >= 0 && p.logo)
            .sort((a, b) => rank(a.id) - rank(b.id))
            .filter((p) => !seen.has(p.name) && !!seen.add(p.name))
        );
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [region]);
  if (!list.length) return null;
  return (
    <Row title="Browse by Provider">
      {list.map((p) => (
        <Link key={p.id} to={`/anime/provider/${p.id}`} className="ptile">
          <ProviderLogo s={p} />
          <span>{p.name}</span>
        </Link>
      ))}
    </Row>
  );
}
