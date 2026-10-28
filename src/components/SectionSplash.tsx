import { useEffect, useRef, useState } from 'react';
import type { Section } from '../lib/section';
import { LogoMark } from './Logo';

/** A short full-screen loading screen shown when you switch between Cinema and Anime. */
export default function SectionSplash({ section }: { section: Section }) {
  const [show, setShow] = useState<Section | null>(null);
  const prev = useRef(section);
  useEffect(() => {
    if (prev.current === section) return;
    prev.current = section;
    setShow(section);
    const t = window.setTimeout(() => setShow(null), 1150);
    return () => window.clearTimeout(t);
  }, [section]);
  if (!show) return null;
  return (
    <div className={`splash ${show}`} role="status" aria-live="polite">
      <LogoMark size={76} />
      <h2>{show === 'anime' ? 'Entering Anime' : 'Back to Cinema'}</h2>
      <p>{show === 'anime' ? 'Series, films and streaming services from Japan' : 'Movies, TV shows and live channels'}</p>
      <span className="splash-bar"><i /></span>
    </div>
  );
}
