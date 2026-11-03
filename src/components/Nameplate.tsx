import { useEffect, useState } from 'react';
import { discordPlate, DPLATE_RE } from '../lib/profile';
import type { Deco } from '../lib/profile';

/** Class for a profile header: a Comvie nameplate (drawn with CSS) or the person's Discord nameplate. */
export const nameplateClass = (deco?: Deco) =>
  deco?.dplate && DPLATE_RE.test(deco.dplate) ? 'np-discord' : deco?.nameplate ? `np-${deco.nameplate}` : '';

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The Discord nameplate behind a profile header: its looping video (or still picture when motion is reduced). */
export function NameplateMedia({ deco }: { deco?: Deco }) {
  const asset = deco?.dplate && DPLATE_RE.test(deco.dplate) ? deco.dplate : '';
  const [still, setStill] = useState(reducedMotion);
  useEffect(() => setStill(reducedMotion()), [asset]);
  if (!asset) return null;
  const u = discordPlate(asset);
  return (
    <span className="np-media" aria-hidden="true">
      {still ? (
        <img src={u.img} alt="" referrerPolicy="no-referrer" />
      ) : (
        <video
          // set "muted" on the element itself so phones allow it to play on its own
          ref={(el) => {
            if (!el) return;
            el.muted = true;
            void el.play().catch(() => setStill(true));
          }}
          src={u.video}
          poster={u.img}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onError={() => setStill(true)}
        />
      )}
    </span>
  );
}
