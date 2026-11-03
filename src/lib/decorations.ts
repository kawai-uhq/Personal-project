/** Profile collectibles: avatar decorations, nameplates and profile effects. Their artwork is in public/deco (drawn by scripts/decorations/build.py). */
import type { WatchStats } from './stats';

/** What has to be watched or read to unlock an item */
export type UnlockStat = 'bestStreak' | 'hours' | 'movies' | 'episodes' | 'animeEpisodes' | 'chapters';
export interface Unlock {
  stat: UnlockStat;
  need: number;
}
export interface DecoItem {
  id: string;
  name: string;
  theme: 'anime' | 'movie' | 'classic';
  unlock?: Unlock;
}

const UNIT: Record<UnlockStat, [string, string]> = {
  bestStreak: ['day streak', 'day streak'],
  hours: ['hour watched', 'hours watched'],
  movies: ['movie watched', 'movies watched'],
  episodes: ['TV episode', 'TV episodes'],
  animeEpisodes: ['anime episode', 'anime episodes'],
  chapters: ['manga chapter', 'manga chapters']
};
/** e.g. "Watch 25 movies" / "Reach a 7 day streak" */
export const unlockText = (u: Unlock) =>
  u.stat === 'bestStreak' ? `Reach a ${u.need} day streak` : `${u.stat === 'chapters' ? 'Read' : 'Watch'} ${u.need} ${UNIT[u.stat][1].replace(' watched', '')}`;
export const isUnlocked = (it: { unlock?: Unlock } | undefined, s: Partial<WatchStats> | null) => !it?.unlock || (s?.[it.unlock.stat] ?? 0) >= it.unlock.need;
export const unlockProgress = (u: Unlock, s: Partial<WatchStats> | null) => `${Math.min(s?.[u.stat] ?? 0, u.need)}/${u.need}`;

export const FRAMES: DecoItem[] = [
  { id: 'sakura', name: 'Sakura', theme: 'anime' },
  { id: 'chakra', name: 'Chakra', theme: 'anime' },
  { id: 'spirit', name: 'Spirit Flame', theme: 'anime', unlock: { stat: 'bestStreak', need: 7 } },
  { id: 'film', name: 'Film Reel', theme: 'movie' },
  { id: 'spotlight', name: 'Spotlight', theme: 'movie' },
  { id: 'premiere', name: 'Red Carpet', theme: 'movie', unlock: { stat: 'movies', need: 10 } },
  { id: 'neon', name: 'Neon', theme: 'classic' },
  { id: 'gold', name: 'Gold', theme: 'classic', unlock: { stat: 'hours', need: 100 } },
  { id: 'galaxy', name: 'Galaxy', theme: 'classic' },
  { id: 'lantern', name: 'Lantern Festival', theme: 'anime', unlock: { stat: 'animeEpisodes', need: 50 } },
  { id: 'ramen', name: 'Ramen Steam', theme: 'anime' },
  { id: 'popcorn', name: 'Popcorn Night', theme: 'movie' },
  { id: 'ticket', name: 'Golden Ticket', theme: 'movie', unlock: { stat: 'movies', need: 25 } },
  { id: 'portal', name: 'Galaxy Portal', theme: 'classic', unlock: { stat: 'hours', need: 50 } }
];

/** Profile frames: art around the whole profile card (four corner pieces in public/deco/pframes, plus a border) */
export const PFRAMES: DecoItem[] = [
  { id: 'sakura', name: 'Sakura Bough', theme: 'anime' },
  { id: 'spirit', name: 'Spirit Fire', theme: 'anime', unlock: { stat: 'bestStreak', need: 7 } },
  { id: 'premiere', name: 'Premiere Night', theme: 'movie', unlock: { stat: 'movies', need: 25 } },
  { id: 'galaxy', name: 'Galaxy Drift', theme: 'classic', unlock: { stat: 'hours', need: 25 } },
  { id: 'neon', name: 'Neon Arcade', theme: 'classic' },
  { id: 'gilded', name: 'Gilded Deco', theme: 'classic', unlock: { stat: 'hours', need: 100 } }
];

export const NAMEPLATES: DecoItem[] = [
  { id: 'sakura', name: 'Cherry Blossom', theme: 'anime' },
  { id: 'twilight', name: 'Twilight Town', theme: 'anime' },
  { id: 'noir', name: 'Film Noir', theme: 'movie' },
  { id: 'marquee', name: 'Marquee', theme: 'movie', unlock: { stat: 'movies', need: 10 } },
  { id: 'ocean', name: 'Ocean', theme: 'classic' },
  { id: 'aurora', name: 'Aurora', theme: 'classic', unlock: { stat: 'hours', need: 25 } },
  { id: 'ember', name: 'Ember', theme: 'classic', unlock: { stat: 'bestStreak', need: 3 } }
];

export const EFFECTS: DecoItem[] = [
  { id: 'petals', name: 'Falling Petals', theme: 'anime' },
  { id: 'sparkles', name: 'Sparkles', theme: 'classic' },
  { id: 'stars', name: 'Starfield', theme: 'classic', unlock: { stat: 'hours', need: 10 } },
  { id: 'embers', name: 'Embers', theme: 'movie', unlock: { stat: 'bestStreak', need: 3 } }
];

/** Username colours (gradients; some animate) */
export interface NameStyle extends DecoItem {
  css: string;
}
export const NAME_COLORS: NameStyle[] = [
  { id: 'sunset', name: 'Sunset', theme: 'classic', css: 'linear-gradient(90deg, #FFB86B, #FF5F8F)' },
  { id: 'sakura', name: 'Sakura', theme: 'anime', css: 'linear-gradient(90deg, #FFE1EC, #FF8FB8)' },
  { id: 'ocean', name: 'Ocean', theme: 'classic', css: 'linear-gradient(90deg, #8FE3FF, #4F7BFF)' },
  { id: 'mint', name: 'Mint', theme: 'classic', css: 'linear-gradient(90deg, #C8FFE6, #3DDC97)' },
  { id: 'gold', name: 'Gold Shimmer', theme: 'movie', css: 'linear-gradient(100deg, #B8862B 20%, #FFF3B0 40%, #E8B73A 60%, #B8862B 80%)', unlock: { stat: 'movies', need: 10 } },
  { id: 'aurora', name: 'Aurora', theme: 'classic', css: 'linear-gradient(90deg, #46FFB4, #3DE3FF, #B47BFF, #46FFB4)', unlock: { stat: 'hours', need: 25 } },
  { id: 'neon', name: 'Neon Pulse', theme: 'classic', css: 'linear-gradient(90deg, #FF4FD8, #2EE6FF, #FF4FD8)', unlock: { stat: 'bestStreak', need: 3 } },
  { id: 'rainbow', name: 'Rainbow', theme: 'anime', css: 'linear-gradient(90deg, #FF6B6B, #FFD93D, #6BCB77, #4D96FF, #B47BFF, #FF6B6B)', unlock: { stat: 'hours', need: 50 } }
];
/** Username fonts (Google Fonts, loaded only when used) */
export interface NameFont extends DecoItem {
  family: string;
  google?: string;
}
export const NAME_FONTS: NameFont[] = [
  { id: 'fredoka', name: 'Rounded', theme: 'classic', family: "'Fredoka', sans-serif" },
  { id: 'bungee', name: 'Marquee', theme: 'movie', family: "'Bungee', sans-serif", google: 'Bungee' },
  { id: 'cinzel', name: 'Epic', theme: 'movie', family: "'Cinzel', serif", google: 'Cinzel:wght@700' },
  { id: 'pacifico', name: 'Script', theme: 'classic', family: "'Pacifico', cursive", google: 'Pacifico' },
  { id: 'marker', name: 'Marker', theme: 'anime', family: "'Permanent Marker', cursive", google: 'Permanent+Marker' },
  { id: 'pixel', name: 'Pixel', theme: 'classic', family: "'Press Start 2P', monospace", google: 'Press+Start+2P', unlock: { stat: 'hours', need: 10 } },
  { id: 'mincho', name: 'Brush', theme: 'anime', family: "'Yuji Syuku', serif", google: 'Yuji+Syuku', unlock: { stat: 'animeEpisodes', need: 25 } }
];

/** Matching sets: one tap wears every piece */
export interface Bundle {
  id: string;
  name: string;
  theme: 'anime' | 'movie' | 'classic';
  deco: { frame?: string; pframe?: string; nameplate?: string; effect?: string; nameColor?: string; nameFont?: string };
}
export const BUNDLES: Bundle[] = [
  { id: 'sakura', name: 'Sakura Season', theme: 'anime', deco: { frame: 'sakura', pframe: 'sakura', nameplate: 'sakura', effect: 'petals', nameColor: 'sakura', nameFont: 'marker' } },
  { id: 'spirit', name: 'Spirit Night', theme: 'anime', deco: { frame: 'spirit', pframe: 'spirit', nameplate: 'aurora', effect: 'stars', nameColor: 'aurora', nameFont: 'mincho' } },
  { id: 'premiere', name: 'Premiere', theme: 'movie', deco: { frame: 'premiere', pframe: 'premiere', nameplate: 'marquee', effect: 'sparkles', nameColor: 'gold', nameFont: 'bungee' } },
  { id: 'galaxy', name: 'Cosmic', theme: 'classic', deco: { frame: 'galaxy', pframe: 'galaxy', nameplate: 'twilight', effect: 'stars', nameColor: 'ocean', nameFont: 'fredoka' } },
  { id: 'neon', name: 'Neon City', theme: 'classic', deco: { frame: 'neon', pframe: 'neon', nameplate: 'twilight', effect: 'sparkles', nameColor: 'neon', nameFont: 'pixel' } },
  { id: 'royal', name: 'Royal Gold', theme: 'classic', deco: { frame: 'gold', pframe: 'gilded', nameplate: 'noir', effect: 'sparkles', nameColor: 'gold', nameFont: 'cinzel' } },
  { id: 'campfire', name: 'Campfire', theme: 'classic', deco: { frame: 'lantern', pframe: 'spirit', nameplate: 'ember', effect: 'embers', nameColor: 'sunset', nameFont: 'fredoka' } }
];
/** Every item a set needs, with whether each is unlocked */
export function bundleItems(b: Bundle): { kind: string; item: DecoItem | undefined }[] {
  return [
    { kind: 'Avatar decoration', item: FRAMES.find((x) => x.id === b.deco.frame) },
    { kind: 'Profile frame', item: PFRAMES.find((x) => x.id === b.deco.pframe) },
    { kind: 'Nameplate', item: NAMEPLATES.find((x) => x.id === b.deco.nameplate) },
    { kind: 'Profile decoration', item: EFFECTS.find((x) => x.id === b.deco.effect) },
    { kind: 'Name colour', item: NAME_COLORS.find((x) => x.id === b.deco.nameColor) },
    { kind: 'Name font', item: NAME_FONTS.find((x) => x.id === b.deco.nameFont) }
  ].filter((x) => x.item);
}

/** For drawing outside CSS (the shareable profile picture): each nameplate's edge colour and each frame's border colours */
export const NAMEPLATE_EDGE: Record<string, string> = { sakura: '#1C0A1D', twilight: '#0E0A22', noir: '#0A0A0C', marquee: '#2A040B', ocean: '#030A1C', aurora: '#020611', ember: '#0B0505' };
export const PFRAME_COLORS: Record<string, string[]> = {
  galaxy: ['#E4D9FF', '#7B55F0', '#FF8AD8'], sakura: ['#FFE1EC', '#F27BA6', '#B9665C'], neon: ['#FF4FD8', '#8A4BFF', '#2EE6FF'],
  gilded: ['#FFF8D8', '#C8902C', '#7A4F12'], premiere: ['#F5C447', '#C8243C', '#F5C447'], spirit: ['#9CFFF2', '#14A7C7', '#065676']
};

export const AVATAR_COLORS = ['#ff6b57', '#ff9a2e', '#f5c542', '#3ddc97', '#2ec4e6', '#5b8cff', '#a66bff', '#ff5fa2'];
