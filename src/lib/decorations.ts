/** Profile collectibles: avatar decorations, nameplates and profile effects. Their artwork is in public/deco (drawn by scripts/decorations/build.py). */
export interface DecoItem {
  id: string;
  name: string;
  theme: 'anime' | 'movie' | 'classic';
}

export const FRAMES: DecoItem[] = [
  { id: 'sakura', name: 'Sakura', theme: 'anime' },
  { id: 'chakra', name: 'Chakra', theme: 'anime' },
  { id: 'spirit', name: 'Spirit Flame', theme: 'anime' },
  { id: 'film', name: 'Film Reel', theme: 'movie' },
  { id: 'spotlight', name: 'Spotlight', theme: 'movie' },
  { id: 'premiere', name: 'Red Carpet', theme: 'movie' },
  { id: 'neon', name: 'Neon', theme: 'classic' },
  { id: 'gold', name: 'Gold', theme: 'classic' },
  { id: 'galaxy', name: 'Galaxy', theme: 'classic' },
  { id: 'lantern', name: 'Lantern Festival', theme: 'anime' },
  { id: 'ramen', name: 'Ramen Steam', theme: 'anime' },
  { id: 'popcorn', name: 'Popcorn Night', theme: 'movie' },
  { id: 'ticket', name: 'Golden Ticket', theme: 'movie' },
  { id: 'portal', name: 'Galaxy Portal', theme: 'classic' }
];

/** Profile frames: art around the whole profile card (four corner pieces in public/deco/pframes, plus a border) */
export const PFRAMES: DecoItem[] = [
  { id: 'sakura', name: 'Sakura Bough', theme: 'anime' },
  { id: 'spirit', name: 'Spirit Fire', theme: 'anime' },
  { id: 'premiere', name: 'Premiere Night', theme: 'movie' },
  { id: 'galaxy', name: 'Galaxy Drift', theme: 'classic' },
  { id: 'neon', name: 'Neon Arcade', theme: 'classic' },
  { id: 'gilded', name: 'Gilded Deco', theme: 'classic' }
];

export const NAMEPLATES: DecoItem[] = [
  { id: 'sakura', name: 'Cherry Blossom', theme: 'anime' },
  { id: 'twilight', name: 'Twilight Town', theme: 'anime' },
  { id: 'noir', name: 'Film Noir', theme: 'movie' },
  { id: 'marquee', name: 'Marquee', theme: 'movie' },
  { id: 'ocean', name: 'Ocean', theme: 'classic' },
  { id: 'aurora', name: 'Aurora', theme: 'classic' },
  { id: 'ember', name: 'Ember', theme: 'classic' }
];

export const EFFECTS: DecoItem[] = [
  { id: 'petals', name: 'Falling Petals', theme: 'anime' },
  { id: 'sparkles', name: 'Sparkles', theme: 'classic' },
  { id: 'stars', name: 'Starfield', theme: 'classic' },
  { id: 'embers', name: 'Embers', theme: 'movie' }
];

export const AVATAR_COLORS = ['#ff6b57', '#ff9a2e', '#f5c542', '#3ddc97', '#2ec4e6', '#5b8cff', '#a66bff', '#ff5fa2'];
