import { useLocation } from 'react-router-dom';
import { hostSection } from './site';

export type Section = 'cinema' | 'anime';

// Pages of the main site; everything else (a title page, search, settings…) stays in whichever section you came from
const MAIN = new Set(['/', '/movies', '/tv', '/live', '/genres', '/list']);
let current: Section = 'cinema';

export function sectionFor(pathname: string): Section {
  const h = hostSection();
  if (h) return (current = h);
  if (pathname.startsWith('/anime')) current = 'anime';
  else if (MAIN.has(pathname)) current = 'cinema';
  return current;
}

export const useSection = (): Section => sectionFor(useLocation().pathname);
