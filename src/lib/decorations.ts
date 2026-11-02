/** Profile decorations, all drawn with CSS (no outside images): avatar frames, nameplates and profile effects. */
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
  { id: 'galaxy', name: 'Galaxy', theme: 'classic' }
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
