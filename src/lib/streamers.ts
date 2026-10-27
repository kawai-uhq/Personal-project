/** Helpers for "Browse by Provider": brand colours, the chosen country, and old-style links. */

// Known brand colours (TMDB provider id -> colour). Anything else gets a colour made from its id.
const COLORS: Record<number, string> = {
  8: '#e50914', 9: '#00a8e1', 119: '#00a8e1', 337: '#1f4fd8', 122: '#3b5bdb', 350: '#8e8e93', 2: '#8e8e93',
  15: '#1ce783', 1899: '#7a3df0', 384: '#7a3df0', 531: '#0064ff', 386: '#ffcc00', 283: '#f47521', 192: '#ff0000',
  232: '#7d3cff', 237: '#e50914', 11: '#0a4bff', 73: '#ff5a1f'
};

export interface Svc { id: number; name: string; logo: string | null }

export const colorFor = (id: number): string => COLORS[id] ?? `hsl(${(id * 47) % 360} 65% 48%)`;

// /provider/netflix style links from the first version keep working
export const LEGACY: Record<string, number> = {
  netflix: 8, 'prime-video': 9, 'disney-plus': 337, jiohotstar: 122, 'apple-tv-plus': 350,
  hulu: 15, 'hbo-max': 1899, 'paramount-plus': 531, peacock: 386, crunchyroll: 283
};
