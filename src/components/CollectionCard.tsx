import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { collectionLink, loadCollection } from '../lib/collections';
import type { Coll } from '../lib/collections';
import { posterSrc } from '../lib/tmdb';

const ROTATE_MS = 3600;

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Where each poster sits in the fan, relative to the front one: 0 = front, ±1 / ±2 = behind to the right / left. */
function slotOf(k: number, front: number, n: number): number {
  let d = (k - front + n) % n;
  if (d > n / 2) d -= n;
  return d;
}

/** A collection card: a fan of posters whose front poster changes every few seconds, with the name and tagline below. */
export function CollectionCard({ c, delay = 0 }: { c: Coll; delay?: number }) {
  const [front, setFront] = useState(0);
  const el = useRef<HTMLAnchorElement>(null);
  const n = c.fan.length;

  useEffect(() => {
    if (n < 2 || reducedMotion()) return;
    let visible = true;
    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((e) => (visible = e.some((x) => x.isIntersecting)))
        : null;
    if (io && el.current) io.observe(el.current);
    let timer = 0;
    // cards start at different moments, so a row doesn't change all at once
    const start = window.setTimeout(() => {
      timer = window.setInterval(() => {
        if (visible && !document.hidden) setFront((f) => (f + 1) % n);
      }, ROTATE_MS);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(timer);
      io?.disconnect();
    };
  }, [n, delay]);

  return (
    <Link ref={el} to={collectionLink(c.key)} className="cf" aria-label={`${c.name}: ${c.tagline}`}>
      <span className="cf-fan" aria-hidden="true">
        {c.fan.map((m, k) => {
          const s = slotOf(k, front, n);
          return (
            <img
              key={m.id}
              className="cf-poster"
              data-slot={Math.abs(s) > 2 ? 'hidden' : s}
              src={posterSrc(m.poster as string)}
              alt=""
              loading="lazy"
            />
          );
        })}
      </span>
      <span className="cf-body">
        <strong>{c.name}</strong>
        <small>{c.tagline}</small>
      </span>
    </Link>
  );
}

/** The same card shape while a collection loads (blank posters, no text). */
export function CollectionCardSkeleton() {
  return (
    <span className="cf sk-cf" aria-hidden="true">
      <span className="cf-fan">
        {[-2, -1, 1, 2, 0].map((s) => <span key={s} className="cf-poster" data-slot={s} />)}
      </span>
      <span className="cf-body"><i /><i /></span>
    </span>
  );
}

/** Loads one collection by key and shows its card (nothing if it can't be loaded). */
export function CollectionCardByKey({ k, delay }: { k: string; delay?: number }) {
  const [c, setC] = useState<Coll | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadCollection(k).then((r) => live && setC(r));
    return () => {
      live = false;
    };
  }, [k]);
  if (c === undefined) return <CollectionCardSkeleton />;
  if (!c) return null;
  return <CollectionCard c={c} delay={delay} />;
}
