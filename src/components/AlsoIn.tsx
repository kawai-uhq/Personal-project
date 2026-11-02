import { useEffect, useState } from 'react';
import { AnimeCard } from './AnimeCard';
import { MangaCard } from './MangaCard';
import { Row } from './Rows';
import { aniSearchSafe } from '../lib/anilist';
import type { Ani } from '../lib/anilist';
import { mangaSearchSafe } from '../lib/manga';
import type { Manga } from '../lib/manga';

/** Main-site search: the same search in the anime and manga sections, as two rows ("Also in Anime / Manga").
 *  Their cards open on anime.comvie.lol / manga.comvie.lol. */
export default function AlsoIn({ q }: { q: string }) {
  const [anime, setAnime] = useState<Ani[]>([]);
  const [manga, setManga] = useState<Manga[]>([]);
  useEffect(() => {
    const term = q.trim();
    setAnime([]);
    setManga([]);
    if (term.length < 2) return;
    let live = true;
    aniSearchSafe(term).then((r) => live && setAnime(r)).catch(() => undefined);
    mangaSearchSafe(term).then((r) => live && setManga(r)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [q]);
  const enc = encodeURIComponent(q.trim());
  return (
    <>
      {anime.length > 0 && (
        <Row title="Also in Anime" to={`/anime/search?q=${enc}`}>
          {anime.map((a) => <AnimeCard key={a.id} a={a} />)}
        </Row>
      )}
      {manga.length > 0 && (
        <Row title="Also in Manga" to={`/manga/search?q=${enc}`}>
          {manga.map((m) => <MangaCard key={m.id} m={m} />)}
        </Row>
      )}
    </>
  );
}
