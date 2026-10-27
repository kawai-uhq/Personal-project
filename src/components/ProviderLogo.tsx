import { useState } from 'react';
import { colorFor } from '../lib/streamers';
import type { Svc } from '../lib/streamers';

/** A service's logo tile. Shows a coloured initial when there is no logo (or it fails to load). */
export default function ProviderLogo({ s, size = 64 }: { s: Svc; size?: number }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="plogo" style={{ width: size, height: size, background: colorFor(s.id) }} aria-hidden="true">
      {s.logo && !bad ? (
        <img src={`https://image.tmdb.org/t/p/w185${s.logo}`} alt="" loading="lazy" onError={() => setBad(true)} />
      ) : (
        <b>{s.name.charAt(0)}</b>
      )}
    </span>
  );
}
