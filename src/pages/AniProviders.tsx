import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { AnimeCard } from '../components/AnimeCard';
import { MangaCard } from '../components/MangaCard';
import { GridSkeleton, Status } from '../components/Rows';
import { aniList, linkSources, studioAnime, topStudios } from '../lib/anilist';
import type { Ani, LinkSource, StudioLite } from '../lib/anilist';
import { creatorWorks, mangaList, topCreators } from '../lib/manga';
import type { Creator, CreatorPage, Manga } from '../lib/manga';
import { toPublic as P } from '../lib/site';
import { SourceLogo } from '../components/AniSourceRow';

type Kind = 'anime' | 'manga';

function useList<T>(load: () => Promise<T[]>, deps: unknown[]) {
  const [list, setList] = useState<T[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setList(null);
    setError(null);
    load().then((l) => live && setList(l)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { list, error, retry: () => setTick((n) => n + 1) };
}

/** Anime: streaming services and animation studios. Manga: reading platforms / publishers and mangaka. */
function ProvidersPage({ kind }: { kind: Kind }) {
  const anime = kind === 'anime';
  const [q, setQ] = useState('');
  const sites = useList<LinkSource>(() => linkSources(anime ? 'ANIME' : 'MANGA'), [kind]);
  const people = useList<StudioLite | Creator>(() => (anime ? topStudios() : topCreators()), [kind]);
  const n = q.trim().toLowerCase();
  const shownSites = useMemo(() => (sites.list ?? []).filter((s) => !n || s.site.toLowerCase().includes(n)), [sites.list, n]);
  const shownPeople = useMemo(() => (people.list ?? []).filter((s) => !n || s.name.toLowerCase().includes(n)), [people.list, n]);

  return (
    <main className="page pad-top">
      <div className="container">
        <div className="page-head">
          <div>
            <h1 className="title">{anime ? <>Studios &amp; <span className="accent">Streaming</span></> : <>Publishers &amp; <span className="accent">Mangaka</span></>}</h1>
            <p className="muted">
              {anime
                ? 'Browse anime by the service that streams it (Crunchyroll, Netflix, HIDIVE…) or the studio that made it (MAPPA, ufotable…).'
                : 'Browse manga by the platform or publisher that releases it (MANGA Plus, VIZ, WEBTOON…) or by the mangaka who created it.'}
            </p>
          </div>
        </div>
        <div className="prov-search">
          <Icon name="search" size={16} />
          <input className="field" type="search" placeholder={anime ? 'Search services and studios…' : 'Search publishers and mangaka…'} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        </div>

        <h2 className="section">{anime ? 'Streaming services' : 'Publishers & reading platforms'}</h2>
        {sites.error ? (
          <Status kind="error" text={sites.error} retry={sites.retry} />
        ) : !sites.list ? (
          <Status kind="loading" />
        ) : shownSites.length === 0 ? (
          <Status kind="empty" text="Nothing matches." />
        ) : (
          <div className="pgrid">
            {shownSites.map((s) => (
              <Link key={s.id} to={P(kind === 'anime' ? `/anime/streaming/${s.id}` : `/manga/publisher/${s.id}`)} className="ptile">
                <SourceLogo s={s} />
                <span>{s.site}</span>
              </Link>
            ))}
          </div>
        )}

        <h2 className="section" style={{ marginTop: 28 }}>{anime ? 'Animation studios' : 'Mangaka'}</h2>
        {people.error ? (
          <Status kind="error" text={people.error} retry={people.retry} />
        ) : !people.list ? (
          <Status kind="loading" />
        ) : shownPeople.length === 0 ? (
          <Status kind="empty" text="Nothing matches." />
        ) : (
          <div className="studio-grid">
            {shownPeople.map((p) => (
              <Link key={p.id} to={P(anime ? `/anime/studio/${p.id}` : `/manga/creator/${p.id}`)} className={`studio ${anime ? '' : 'person'}`}>
                {p.art && <img className="studio-art" src={p.art} alt="" loading="lazy" />}
                <span className="studio-shade" />
                {'image' in p && p.image && <img className="studio-face" src={p.image} alt="" loading="lazy" />}
                <strong>{p.name}</strong>
                <small>{anime ? 'Studio' : 'Mangaka'}<Icon name="arrowRight" size={12} /></small>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

export const AnimeProviders = () => <ProvidersPage kind="anime" />;
export const MangaProviders = () => <ProvidersPage kind="manga" />;

/** A page of titles with "Load more". */
function TitleGrid<T extends { id: number }>({ load, deps, card }: { load: (page: number) => Promise<{ items: T[]; more: boolean }>; deps: unknown[]; card: (x: T) => JSX.Element }) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const run = (p: number) => {
    setBusy(true);
    setError(null);
    load(p)
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
    run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  if (error && !items.length) return <Status kind="error" text={error} retry={() => run(1)} />;
  if (busy && !items.length) return <GridSkeleton />;
  if (!items.length) return <Status kind="empty" text="Nothing listed here yet." />;
  return (
    <>
      <div className="grid cards">{items.map(card)}</div>
      {more && <div className="center-row"><button className="btn" disabled={busy} onClick={() => run(page + 1)}>{busy ? 'Loading…' : 'Load more'}</button></div>}
    </>
  );
}

/** Everything on one streaming service (anime) or reading platform (manga). */
function SourcePage({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const sid = Number(id);
  const anime = kind === 'anime';
  const [src, setSrc] = useState<LinkSource | null>(null);
  useEffect(() => {
    linkSources(anime ? 'ANIME' : 'MANGA').then((l) => setSrc(l.find((s) => s.id === sid) ?? null)).catch(() => undefined);
  }, [anime, sid]);
  return (
    <main className="page pad-top">
      <div className="container">
        <p className="crumb"><Link to={P(kind === 'anime' ? '/anime/studios' : '/manga/publishers')} className="link"><Icon name="chevronLeft" size={14} />{anime ? 'Studios & Streaming' : 'Publishers & Mangaka'}</Link></p>
        <div className="prov-head">
          {src && <SourceLogo s={src} size={52} />}
          <h1 className="title">{src?.site ?? '…'}</h1>
        </div>
        <p className="muted" style={{ marginBottom: 16 }}>{anime ? 'Anime available on this service, most popular first.' : 'Titles released on this platform, most popular first.'}</p>
        {anime ? (
          <TitleGrid<Ani> deps={[sid]} load={(p) => aniList({ licensedById: sid, sort: 'POPULARITY_DESC', page: p, perPage: 30 })} card={(a) => <AnimeCard key={a.id} a={a} />} />
        ) : (
          <TitleGrid<Manga> deps={[sid]} load={(p) => mangaList({ licensedById: sid, sort: 'POPULARITY_DESC', page: p, perPage: 30 })} card={(m) => <MangaCard key={m.id} m={m} />} />
        )}
      </div>
    </main>
  );
}

export const AnimeSource = () => <SourcePage kind="anime" />;
export const MangaSource = () => <SourcePage kind="manga" />;

/** A studio's anime. */
export function StudioPage() {
  const { id } = useParams();
  const sid = Number(id);
  const [name, setName] = useState('');
  return (
    <main className="page pad-top">
      <div className="container">
        <p className="crumb"><Link to={P('/anime/studios')} className="link"><Icon name="chevronLeft" size={14} />Studios &amp; Streaming</Link></p>
        <h1 className="title">{name || '…'}</h1>
        <p className="muted" style={{ marginBottom: 16 }}>Anime made by this studio, most popular first.</p>
        <TitleGrid<Ani>
          deps={[sid]}
          load={(p) => studioAnime(sid, p).then((r) => { setName(r.name); return r; })}
          card={(a) => <AnimeCard key={a.id} a={a} />}
        />
      </div>
    </main>
  );
}

/** A mangaka: photo, short bio and works. */
export function CreatorPageView() {
  const { id } = useParams();
  const cid = Number(id);
  const [info, setInfo] = useState<CreatorPage | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <main className="page pad-top">
      <div className="container">
        <p className="crumb"><Link to={P('/manga/publishers')} className="link"><Icon name="chevronLeft" size={14} />Publishers &amp; Mangaka</Link></p>
        <div className="creator-head">
          {info?.image && <img src={info.image} alt="" />}
          <div>
            <h1 className="title">{info?.name || '…'}</h1>
            {info?.native && <p className="tagline">{info.native}</p>}
            {info?.about && (
              <p className={`overview creator-about ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)}>{info.about}</p>
            )}
          </div>
        </div>
        <h2 className="section">Works</h2>
        <TitleGrid<Manga>
          deps={[cid]}
          load={(p) => creatorWorks(cid, p).then((r) => { if (p === 1) setInfo(r); return r; })}
          card={(m) => <MangaCard key={m.id} m={m} />}
        />
      </div>
    </main>
  );
}
