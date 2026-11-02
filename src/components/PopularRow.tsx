import { useEffect, useRef, useState } from 'react';
import { AnimeCard } from './AnimeCard';
import { PosterRow, Row } from './Rows';
import { aniByIds } from '../lib/anilist';
import type { Ani } from '../lib/anilist';
import { popularKeys } from '../lib/popular';
import { tmdb } from '../lib/tmdb';
import type { Media } from '../lib/types';

const MIN = 5; // the row only shows once enough titles have been played

function useNear() {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { host, near };
}

/** Cinema home: the movies and shows visitors played most this week. */
export function PopularCinemaRow() {
  const { host, near } = useNear();
  const [items, setItems] = useState<Media[]>([]);
  useEffect(() => {
    if (!near) return;
    let live = true;
    popularKeys('cinema').then(async (keys) => {
      if (keys.length < MIN) return;
      const got = await Promise.all(
        keys.map(({ k }) => {
          const [t, id] = k.split(':');
          return tmdb.details(t === 'tv' ? 'tv' : 'movie', Number(id)).then((d) => d.media).catch(() => null);
        })
      );
      if (live) setItems(got.filter((m): m is Media => !!m && !!m.poster));
    });
    return () => {
      live = false;
    };
  }, [near]);
  return <div ref={host}>{items.length >= MIN && <PosterRow title="Popular on comvie this week" items={items} />}</div>;
}

/** Anime home: the anime visitors played most this week. */
export function PopularAnimeRow() {
  const { host, near } = useNear();
  const [items, setItems] = useState<Ani[]>([]);
  useEffect(() => {
    if (!near) return;
    let live = true;
    popularKeys('anime').then(async (keys) => {
      if (keys.length < MIN) return;
      const got = await aniByIds(keys.map(({ k }) => Number(k.split(':')[1]))).catch(() => [] as Ani[]);
      if (live) setItems(got);
    });
    return () => {
      live = false;
    };
  }, [near]);
  return (
    <div ref={host}>
      {items.length >= MIN && (
        <Row title="Popular on comvie this week">
          {items.map((a) => <AnimeCard key={a.id} a={a} />)}
        </Row>
      )}
    </div>
  );
}
