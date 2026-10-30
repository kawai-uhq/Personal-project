import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Row } from './Rows';
import { linkSources } from '../lib/anilist';
import type { LinkSource } from '../lib/anilist';
import { toPublic as P } from '../lib/site';

/** A site's logo on its brand colour (AniList gives small transparent icons). */
export function SourceLogo({ s, size = 44 }: { s: LinkSource; size?: number }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="src-logo" style={{ width: size, height: size, background: s.color || '#2a2133' }}>
      {s.icon && !bad ? <img src={s.icon} alt="" onError={() => setBad(true)} /> : <b>{s.site.charAt(0)}</b>}
    </span>
  );
}

/** Home-page row like Cinema's "Browse by Provider": streaming services (anime) or publishers (manga). */
export default function AniSourceRow({ kind }: { kind: 'anime' | 'manga' }) {
  const [list, setList] = useState<LinkSource[]>([]);
  useEffect(() => {
    let live = true;
    linkSources(kind === 'anime' ? 'ANIME' : 'MANGA').then((l) => live && setList(l.slice(0, 18))).catch(() => undefined);
    return () => { live = false; };
  }, [kind]);
  if (!list.length) return null;
  const all = P(kind === 'anime' ? '/anime/studios' : '/manga/publishers');
  const one = (id: number) => P(kind === 'anime' ? `/anime/streaming/${id}` : `/manga/publisher/${id}`);
  return (
    <Row title={kind === 'anime' ? 'Browse by Studio & Streaming' : 'Browse by Publisher & Mangaka'} to={all}>
      {list.map((s) => (
        <Link key={s.id} to={one(s.id)} className="ptile">
          <SourceLogo s={s} size={64} />
          <span>{s.site}</span>
        </Link>
      ))}
      <Link to={all} className="ptile">
        <span className="plogo all" style={{ width: 64, height: 64 }}>All</span>
        <span>{kind === 'anime' ? 'Studios' : 'Mangaka'}</span>
      </Link>
    </Row>
  );
}
