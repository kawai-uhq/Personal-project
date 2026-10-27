import { useEffect, useState } from 'react';
import { useRegion } from '../lib/region';
import { tmdb } from '../lib/tmdb';

/** Country picker for the streaming catalogues (shared choice, remembered on this device). */
export default function RegionSelect() {
  const [value, setValue] = useRegion();
  const [list, setList] = useState<{ code: string; name: string }[]>([]);
  useEffect(() => {
    tmdb.regions().then(setList).catch(() => {});
  }, []);
  const opts = list.length ? list : [{ code: value, name: value }];
  return (
    <select className="field select dd" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Country">
      {opts.map((r) => (
        <option key={r.code} value={r.code}>{r.name}</option>
      ))}
    </select>
  );
}
