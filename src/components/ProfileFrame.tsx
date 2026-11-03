import { PFRAMES } from '../lib/decorations';

const IDS = new Set(PFRAMES.map((f) => f.id));
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

/** A profile frame: art around the whole profile card (a border plus four animated corner pieces that poke out past it).
 *  Put it inside an element with position: relative that wraps the card. */
export default function ProfileFrame({ id }: { id?: string }) {
  if (!id || !IDS.has(id)) return null;
  return (
    <span className={`pframe pf-${id}`} aria-hidden="true">
      {CORNERS.map((c) => (
        <img key={c} className={`pf-c pf-${c}`} src={`/deco/pframes/${id}-${c}.svg`} alt="" decoding="async" draggable={false} />
      ))}
    </span>
  );
}
