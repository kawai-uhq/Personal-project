import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IMG } from '../lib/tmdb';
import type { Media } from '../lib/types';

/**
 * Frosted-glass backdrop for the whole home page: a soft blurred copy of the featured title's artwork
 * that stays behind everything from top to bottom and crossfades as the billboard changes.
 * (Rendered on <body> so scrolling and page animations never move it.)
 */
export default function Ambient({ items, urls, active }: { items?: Media[]; urls?: string[]; active: number }) {
  const list: string[] = urls ?? (items ?? []).map((m) => (m.backdrop ? IMG.still + m.backdrop : ''));
  useEffect(() => {
    document.documentElement.classList.add('has-ambient');
    return () => document.documentElement.classList.remove('has-ambient');
  }, []);

  return createPortal(
    <div className="ambient" aria-hidden="true">
      {list.map((u, n) => (u ? <img key={u} className={n === active ? 'on' : ''} src={u} alt="" /> : null))}
      <div className="ambient-glass" />
    </div>,
    document.body
  );
}
