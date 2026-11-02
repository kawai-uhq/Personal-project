import { Suspense, lazy, useEffect, useLayoutEffect } from 'react';
import { sectionFor } from './lib/section';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CINEMA_ORIGIN, ORIGINS, hostSection, isCinemaPath, isShared, migrationHash, onProd, stripSection, toLogical } from './lib/site';
import AuthModal from './components/AuthModal';
import Navbar from './components/Navbar';
const Detail = lazy(() => import('./pages/Detail'));
const GenreResults = lazy(() => import('./pages/GenreResults'));
const Genres = lazy(() => import('./pages/Genres'));
const Explore = lazy(() => import('./pages/Explore'));
import Tooltip from './components/Tooltip';
import CrossPromo from './components/CrossPromo';
import ConfirmHost from './components/Confirm';
import CookieBanner from './components/CookieBanner';
import ErrorBoundary from './components/ErrorBoundary';
import { defaultTitle } from './lib/title';
import Contact from './pages/Contact';
import Floating from './components/Floating';
import SportAlerts from './components/SportAlerts';
import Footer from './components/Footer';
import Home from './pages/Home';
import { About, Dmca, Privacy, Terms } from './pages/Legal';
const Help = lazy(() => import('./pages/Help'));
const Live = lazy(() => import('./pages/Live'));
const Sports = lazy(() => import('./pages/Sports'));
const Schedule = lazy(() => import('./pages/Schedule'));
const PersonPage = lazy(() => import('./pages/Person'));
const MyList = lazy(() => import('./pages/MyList'));
const Providers = lazy(() => import('./pages/Providers'));
const Provider = lazy(() => import('./pages/Provider'));
const AnimeHome = lazy(() => import('./pages/AnimeHome'));
const AnimeExplore = lazy(() => import('./pages/AnimeExplore'));
const AnimeGenres = lazy(() => import('./pages/AnimeGenres'));
const AnimeDetail = lazy(() => import('./pages/AnimeDetail'));
const AnimeWatch = lazy(() => import('./pages/AnimeWatch'));
const AnimeLibrary = lazy(() => import('./pages/AnimeLibrary'));
const AnimeSearch = lazy(() => import('./pages/AnimeSearch'));
const MangaHome = lazy(() => import('./pages/MangaHome'));
const MangaBrowse = lazy(() => import('./pages/MangaBrowse'));
const MangaDetail = lazy(() => import('./pages/MangaDetail'));
const MangaRead = lazy(() => import('./pages/MangaRead'));
const MangaLibrary = lazy(() => import('./pages/MangaLibrary'));
const MangaGenres = lazy(() => import('./pages/MangaGenres'));
const AnimeProviders = lazy(() => import('./pages/AniProviders').then((m) => ({ default: m.AnimeProviders })));
const MangaProviders = lazy(() => import('./pages/AniProviders').then((m) => ({ default: m.MangaProviders })));
const AnimeSource = lazy(() => import('./pages/AniProviders').then((m) => ({ default: m.AnimeSource })));
const MangaSource = lazy(() => import('./pages/AniProviders').then((m) => ({ default: m.MangaSource })));
const StudioPage = lazy(() => import('./pages/AniProviders').then((m) => ({ default: m.StudioPage })));
const CreatorPage = lazy(() => import('./pages/AniProviders').then((m) => ({ default: m.CreatorPageView })));
const Account = lazy(() => import('./pages/Account'));
const CinemaMood = lazy(() => import('./pages/DiscoverPages').then((m) => ({ default: m.CinemaMood })));
const AnimeMood = lazy(() => import('./pages/DiscoverPages').then((m) => ({ default: m.AnimeMood })));
const MangaMood = lazy(() => import('./pages/DiscoverPages').then((m) => ({ default: m.MangaMood })));
const CollectionsPage = lazy(() => import('./pages/DiscoverPages').then((m) => ({ default: m.CollectionsPage })));
const CollectionPage = lazy(() => import('./pages/DiscoverPages').then((m) => ({ default: m.CollectionPage })));
const Search = lazy(() => import('./pages/Search'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Watch = lazy(() => import('./pages/Watch'));

const pathSection = (p: string) => (p.startsWith('/anime') ? 'anime' : p.startsWith('/manga') ? 'manga' : null);

/** Keeps each page on its own sub-domain (anime on anime.comvie.lol, manga on manga.comvie.lol, the rest on cinema.comvie.lol)
 *  and keeps the addresses clean there (anime.comvie.lol/explore, not anime.comvie.lol/anime/explore). */
function useHostRouting() {
  const { pathname, search, hash } = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    if (!onProd()) return;
    const tail = search + hash;
    const h = location.hostname;
    const ps = pathSection(pathname);
    const away = (s: 'cinema' | 'anime' | 'manga', path: string) => window.location.replace(ORIGINS[s] + stripSection(path, s) + tail);
    if (h === 'comvie.lol' || h === 'www.comvie.lol') {
      // the bare domain opens Cinema (or Anime / Manga for their links), bringing this browser's saved data along
      if (ps) away(ps, pathname);
      else window.location.replace(CINEMA_ORIGIN + pathname + tail + migrationHash());
      return;
    }
    const hs = hostSection();
    if (hs && hs !== 'cinema') {
      if (ps && ps !== hs) away(ps, pathname); // a manga link on the anime site, or the other way round
      else if (ps === hs) nav(stripSection(pathname, hs) + tail, { replace: true }); // tidy /anime/x -> /x
      else if (isCinemaPath(pathname)) away('cinema', pathname);
    } else if (ps) {
      away(ps, pathname);
    }
  }, [pathname, search, hash, nav]);
}

export default function App() {
  const location = useLocation();
  const pathname = toLogical(location.pathname);
  const logical = pathname === location.pathname ? location : { ...location, pathname };
  useHostRouting();
  // default tab title (layout effect: runs before pages set their own, e.g. a movie's name)
  useLayoutEffect(() => {
    document.title = defaultTitle(pathname);
  }, [pathname]);
  const watching = pathname.startsWith('/watch/');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // the anime section has its own orange accent
  const section = sectionFor(pathname);
  useEffect(() => {
    const c = document.documentElement.classList;
    c.toggle('anime', section === 'anime');
    c.toggle('manga', section === 'manga');
    return () => c.remove('anime', 'manga');
  }, [section]);

  return (
    <>
      <Navbar />
      <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<div className="status" style={{ minHeight: '70vh' }}><div className="spinner" aria-label="Loading" /></div>}>
      <Routes location={logical}>
        <Route path="/" element={<Home />} />
        <Route path="/movies" element={<Explore key="m" kind="movie" />} />
        <Route path="/tv" element={<Explore key="t" kind="tv" />} />
        <Route path="/explore/:feed" element={<Explore key="x" />} />
        <Route path="/search" element={<Search />} />
        <Route path="/genres" element={<Genres />} />
        <Route path="/genres/:type/:id" element={<GenreResults />} />
        <Route path="/provider/:id" element={<Provider />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/anime" element={<AnimeHome />} />
        <Route path="/anime/search" element={<AnimeSearch />} />
        <Route path="/anime/explore" element={<AnimeExplore />} />
        <Route path="/anime/genres" element={<AnimeGenres />} />
        <Route path="/anime/library" element={<AnimeLibrary />} />
        <Route path="/anime/title/:id" element={<AnimeDetail />} />
        <Route path="/anime/watch/:id" element={<AnimeWatch />} />
        <Route path="/manga" element={<MangaHome />} />
        <Route path="/manga/explore" element={<MangaBrowse />} />
        <Route path="/manga/search" element={<MangaBrowse />} />
        <Route path="/manga/genres" element={<MangaGenres />} />
        <Route path="/manga/publishers" element={<MangaProviders />} />
        <Route path="/manga/publisher/:id" element={<MangaSource />} />
        <Route path="/manga/creator/:id" element={<CreatorPage />} />
        <Route path="/anime/studios" element={<AnimeProviders />} />
        <Route path="/anime/streaming/:id" element={<AnimeSource />} />
        <Route path="/anime/studio/:id" element={<StudioPage />} />
        <Route path="/manga/library" element={<MangaLibrary />} />
        <Route path="/manga/title/:id" element={<MangaDetail />} />
        <Route path="/manga/read/:id" element={<MangaRead />} />
        <Route path="/manga/*" element={<NotFound />} />
        <Route path="/anime/*" element={<NotFound />} />
        <Route path="/live" element={<Live />} />
        <Route path="/sports" element={<Sports />} />
        <Route path="/schedule" element={<Schedule key="tv" kind="tv" />} />
        <Route path="/anime/schedule" element={<Schedule key="anime" kind="anime" />} />
        <Route path="/list" element={<MyList key="main" />} />
        <Route path="/person/:id" element={<PersonPage />} />
        <Route path="/account" element={<Account />} />
        <Route path="/mood/:id" element={<CinemaMood />} />
        <Route path="/anime/mood/:id" element={<AnimeMood />} />
        <Route path="/manga/mood/:id" element={<MangaMood />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collection/:id" element={<CollectionPage />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/about" element={<About />} />
        <Route path="/help" element={<Help />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/legal/dmca" element={<Dmca />} />
        <Route path="/terms" element={<Navigate to="/legal/terms" replace />} />
        <Route path="/privacy" element={<Navigate to="/legal/privacy" replace />} />
        <Route path="/takedown" element={<Navigate to="/legal/dmca" replace />} />
        <Route path="/title/:type/:id" element={<Detail />} />
        <Route path="/watch/:type/:id" element={<Watch />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
      <Footer />
      {!watching && <Floating />}
      <AuthModal />
      <CrossPromo />
      <SportAlerts />
      <ConfirmHost />
      <CookieBanner />
      <Tooltip />
    </>
  );
}
