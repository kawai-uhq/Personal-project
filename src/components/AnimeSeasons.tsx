import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FORMAT_LABEL, aniSeasons } from '../lib/anilist';
import type { SeasonItem } from '../lib/anilist';
import Select from './Select';

/** A drop-down with every season / part of the franchise this anime belongs to. */
export default function AnimeSeasons({ id, to = '/anime/title/' }: { id: number; to?: string }) {
  const nav = useNavigate();
  const [list, setList] = useState<SeasonItem[]>([]);
  useEffect(() => {
    let live = true;
    setList([]);
    aniSeasons(id).then((r) => live && setList(r)).catch(() => undefined);
    return () => { live = false; };
  }, [id]);
  if (list.length < 2) return null;
  return (
    <label className="aseasons">
      <span>Seasons</span>
      <Select className="field select" value={id} onChange={(e) => nav(`${to}${e.target.value}`)} aria-label="Seasons and parts">
        {list.map((s, i) => (
          <option key={s.id} value={s.id}>
            {`${i + 1}. ${s.title}${s.format && s.format !== 'TV' ? ` (${FORMAT_LABEL[s.format] ?? s.format})` : ''}${s.year ? ` · ${s.year}` : ''}`}
          </option>
        ))}
      </Select>
    </label>
  );
}
