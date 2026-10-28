export type MediaType = 'movie' | 'tv';

export interface Media {
  id: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  overview: string;
  type: MediaType;
  rating: number;
  year: string;
  votes?: number;
  /** Japanese animation (set when TMDB gave us its genres and language) */
  anime?: boolean;
  /** Set for AniList entries (open /anime/title/:id) with a full cover URL */
  ani?: boolean;
  img?: string;
}

export const mediaKey = (m: Media) => `${m.type}:${m.id}`;

export interface Season {
  number: number;
  name: string;
  episodeCount: number;
}

export interface Episode {
  number: number;
  name: string;
  overview: string;
  still: string | null;
  rating: number;
  runtime: number;
  airDate: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  photo: string | null;
}

export interface Person {
  id: number;
  name: string;
  bio: string;
  photo: string | null;
  born: string;
  place: string;
  knownFor: string;
}

export interface Details {
  media: Media;
  lastAired: { season: number; episode: number; date: string } | null;
  genres: string[];
  runtime: number;
  tagline: string;
  seasons: Season[];
  status: string;
  votes: number;
  firstAir: string;
  lastAir: string;
  totalEpisodes: number;
  studios: string[];
}

export interface WatchEntry {
  media: Media;
  season: number | null;
  episode: number | null;
  providerId: string;
  watchedAt: number;
}

export const progressLabel = (w: WatchEntry) =>
  w.media.type === 'tv' && w.season && w.episode ? `S${w.season} · E${w.episode}` : 'Movie';

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
}
