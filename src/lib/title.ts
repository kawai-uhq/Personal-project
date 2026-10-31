import { useEffect } from 'react';
import { sectionFor } from './section';

const SECTION_NAME = { cinema: 'Comvie', anime: 'Comvie Anime', manga: 'Comvie Manga' } as const;

// in-app paths → page names (the most specific match wins)
const NAMES: [RegExp, string][] = [
  [/^\/$/, ''], [/^\/movies$/, 'Movies'], [/^\/tv$/, 'TV Shows'], [/^\/live$/, 'Live TV'], [/^\/genres/, 'Genres'],
  [/^\/list$/, 'My Library'], [/^\/search/, 'Search'], [/^\/providers$/, 'Providers'], [/^\/collections$/, 'Collections'],
  [/^\/explore\//, 'Explore'], [/^\/mood\//, 'Mood'], [/^\/account/, 'Account'], [/^\/contact/, 'Contact'], [/^\/about/, 'About'],
  [/^\/help/, 'Help'], [/^\/legal\/terms/, 'Terms of Service'], [/^\/legal\/privacy/, 'Privacy Policy'], [/^\/legal\/dmca/, 'DMCA'],
  [/^\/anime$/, ''], [/^\/anime\/explore/, 'Explore'], [/^\/anime\/genres/, 'Genres'], [/^\/anime\/library/, 'Library'],
  [/^\/anime\/search/, 'Search'], [/^\/anime\/studios/, 'Studios & Streaming'], [/^\/anime\/mood\//, 'Mood'],
  [/^\/manga$/, ''], [/^\/manga\/explore/, 'Explore'], [/^\/manga\/genres/, 'Genres'], [/^\/manga\/library/, 'Library'],
  [/^\/manga\/search/, 'Search'], [/^\/manga\/publishers/, 'Publishers & Mangaka'], [/^\/manga\/mood\//, 'Mood']
];

/** The tab title for an in-app path (pages with a specific title set their own with usePageTitle). */
export function defaultTitle(path: string): string {
  const site = SECTION_NAME[sectionFor(path)];
  const hit = NAMES.find(([re]) => re.test(path));
  return hit && hit[1] ? `${hit[1]} · ${site}` : site;
}

/** Name this page's browser tab, e.g. usePageTitle(movie?.title). */
export function usePageTitle(name: string | null | undefined, path?: string) {
  useEffect(() => {
    if (!name) return;
    const site = SECTION_NAME[sectionFor(path ?? location.pathname)];
    document.title = `${name} · ${site}`;
  }, [name, path]);
}
