import { useEffect, useState } from 'react';
import { PosterRow } from './Rows';
import { tmdb } from '../lib/tmdb';
import type { Media, WatchEntry } from '../lib/types';
import { mediaKey } from '../lib/types';

const ROWS = 2;

/** "Because you watched …": TMDB recommendations for the last couple of titles in the viewer's history,
 *  leaving out anything they've already watched. */
export default function BecauseRows({ history }: { history: WatchEntry[] }) {
  // the most recent distinct titles (history is newest first)
  const seeds: Media[] = [];
  for (const w of history) {
    if (seeds.length >= ROWS) break;
    if (!seeds.some((m) => mediaKey(m) === mediaKey(w.media))) seeds.push(w.media);
  }
  const seedKey = seeds.map(mediaKey).join(',');
  const [rows, setRows] = useState<{ seed: Media; items: Media[] }[]>([]);

  useEffect(() => {
    if (!seeds.length) return setRows([]);
    let live = true;
    const watched = new Set(history.map((w) => mediaKey(w.media)));
    Promise.all(
      seeds.map((seed) =>
        tmdb
          .similar(seed.type, seed.id)
          .then((items) => ({ seed, items: items.filter((m) => m.poster && !watched.has(mediaKey(m))) }))
          .catch(() => ({ seed, items: [] as Media[] }))
      )
    ).then((r) => {
      if (!live) return;
      // the second row doesn't repeat what the first one already shows
      const shown = new Set<string>();
      setRows(
        r.map((x) => {
          const items = x.items.filter((m) => !shown.has(mediaKey(m)));
          items.forEach((m) => shown.add(mediaKey(m)));
          return { seed: x.seed, items };
        })
      );
    });
    return () => {
      live = false;
    };
    // only when the titles the rows are based on change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  return (
    <>
      {rows.map((r) =>
        r.items.length >= 4 ? <PosterRow key={mediaKey(r.seed)} title={`Because you watched ${r.seed.title}`} items={r.items} /> : null
      )}
    </>
  );
}
