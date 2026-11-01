import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { AnimeCard } from '../components/AnimeCard';
import { MangaCard } from '../components/MangaCard';
import { MoodCard, moodPath, moodsFor } from '../components/Discover';
import { Grid, GridSkeleton, Status } from '../components/Rows';
import { aniList } from '../lib/anilist';
import type { Ani } from '../lib/anilist';
import { ANIME_MOODS, CINEMA_MOODS, MANGA_MOODS } from '../lib/discover';
import { COLLECTION_KEYS, loadCollection } from '../lib/collections';
import type { Coll } from '../lib/collections';
import { CollectionCardByKey } from '../components/CollectionCard';
import { usePageTitle } from '../lib/title';
import { mangaList } from '../lib/manga';
import type { Manga } from '../lib/manga';
import { IMG, backdropSrc, posterSrc, tmdb } from '../lib/tmdb';
import type { Media } from '../lib/types';

type Kind = 'cinema' | 'anime' | 'manga';

/** Titles for one mood, with "Load more". */
export function MoodPage({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const mood = moodsFor(kind).find((m) => m.id === id);
  const [items, setItems] = useState<(Media | Ani | Manga)[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = (p: number) => {
    if (!mood) return;
    setBusy(true);
    setError(null);
    const job: Promise<{ items: (Media | Ani | Manga)[]; more: boolean }> =
      kind === 'cinema'
        ? tmdb.list(CINEMA_MOODS.find((m) => m.id === id)!.path, 'movie', p).then((r) => ({ items: r.items, more: p < r.pages }))
        : kind === 'anime'
          ? aniList({ ...ANIME_MOODS.find((m) => m.id === id)!.q, page: p, perPage: 30 })
          : mangaList({ ...MANGA_MOODS.find((m) => m.id === id)!.q, page: p, perPage: 30 });
    job
      .then((r) => {
        setItems((cur) => (p === 1 ? r.items : [...cur, ...r.items.filter((x) => !cur.some((c) => c.id === x.id))]));
        setPage(p);
        setMore(r.more);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };
  useEffect(() => {
    setItems([]);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  if (!mood) return <main className="page pad-top"><Status kind="empty" text="That mood doesn't exist." /></main>;
  const others = moodsFor(kind).filter((m) => m.id !== mood.id);
  return (
    <main className="page pad-top">
      <div className="container">
        <header className="mood-head" style={{ ['--h' as any]: mood.hue }}>
          <span className="mood-icon big"><Icon name={mood.icon} size={26} /></span>
          <div>
            <h1 className="title">{mood.label}</h1>
            <p className="muted">{mood.blurb}</p>
          </div>
        </header>
        {error && !items.length ? (
          <Status kind="error" text={error} retry={() => load(1)} />
        ) : busy && !items.length ? (
          <GridSkeleton />
        ) : !items.length ? (
          <Status kind="empty" text="Nothing here right now." />
        ) : kind === 'cinema' ? (
          <Grid items={items as Media[]} cards />
        ) : (
          <div className="grid cards">
            {kind === 'anime' ? (items as Ani[]).map((a) => <AnimeCard key={a.id} a={a} />) : (items as Manga[]).map((m) => <MangaCard key={m.id} m={m} />)}
          </div>
        )}
        {more && items.length > 0 && <div className="center-row"><button className="btn" disabled={busy} onClick={() => load(page + 1)}>{busy ? 'Loading…' : 'Load more'}</button></div>}
        <h2 className="section" style={{ marginTop: 28 }}>Other moods</h2>
        <div className="mood-grid">{others.map((m) => <MoodCard key={m.id} m={m} to={moodPath(kind, m.id)} />)}</div>
      </div>
    </main>
  );
}

export const CinemaMood = () => <MoodPage kind="cinema" />;
export const AnimeMood = () => <MoodPage kind="anime" />;
export const MangaMood = () => <MoodPage kind="manga" />;

/** Every collection: studios, directors and film series, as poster-fan cards. */
export function CollectionsPage() {
  return (
    <main className="page pad-top">
      <div className="container">
        <div className="page-head"><div><h1 className="title">Film <span className="accent">Collections</span></h1><p className="muted">Studios, directors and whole film series.</p></div></div>
        <div className="cf-grid">
          {COLLECTION_KEYS.map((k, i) => <CollectionCardByKey key={k} k={k} delay={(i % 3) * 1200} />)}
        </div>
      </div>
    </main>
  );
}

/** One collection: a backdrop header with its name and tagline, then every film. */
export function CollectionPage() {
  const { id = '' } = useParams();
  const [c, setC] = useState<Coll | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    setC(undefined);
    loadCollection(id).then((r) => live && setC(r));
    return () => { live = false; };
  }, [id]);
  usePageTitle(c ? c.name : null);
  if (c === null) return <main className="page pad-top"><Status kind="error" text="This collection couldn't be loaded. Try again in a moment." /></main>;
  const what = c?.kind === 'studio' ? 'Studio' : c?.kind === 'director' ? 'Director' : 'Collection';
  return (
    <main className="page">
      <section className="ch">
        {c?.backdrop && <img className="ch-bg" src={backdropSrc(c.backdrop)} alt="" />}
        <div className="container ch-in">
          <p className="crumb"><Link to="/collections" className="link"><Icon name="chevronLeft" size={14} />Collections</Link></p>
          <span className="ch-kind">{what}</span>
          <h1 className="ch-title">{c?.name ?? '…'}</h1>
          {c && <p className="ch-tag">{c.tagline}</p>}
          {c && <p className="ch-count">{c.items.length} films · in release order</p>}
        </div>
      </section>
      <div className="container">
        {c?.overview && <p className="overview ch-ov">{c.overview}</p>}
        {!c ? <GridSkeleton /> : <Grid items={c.items} cards />}
      </div>
    </main>
  );
}
