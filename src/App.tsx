import { Suspense, lazy, useEffect } from 'react';
import { sectionFor } from './lib/section';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CINEMA_ORIGIN, ORIGINS, hostSection, isShared, migrationHash, onProd } from './lib/site';
import AuthModal from './components/AuthModal';
import Navbar from './components/Navbar';
const Detail = lazy(() => import('./pages/Detail'));
const GenreResults = lazy(() => import('./pages/GenreResults'));
const Genres = lazy(() => import('./pages/Genres'));
const Explore = lazy(() => import('./pages/Explore'));
import Tooltip from './components/Tooltip';
import CrossPromo from './components/CrossPromo';
import Contact from './pages/Contact';
import Floating from './components/Floating';
import Footer from './components/Footer';
import Home from './pages/Home';
import { About, Dmca, Privacy, Terms } from './pages/Legal';
const Help = lazy(() => import('./pages/Help'));
const Live = lazy(() => import('./pages/Live'));
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
const Search = lazy(() => import('./pages/Search'));
const Watch = lazy(() => import('./pages/Watch'));

const pathSection = (p: string) => (p.startsWith('/anime') ? 'anime' : p.startsWith('/manga') ? 'manga' : null);

/** Keeps each page on its own sub-domain: anime on anime.comvie.lol, manga on manga.comvie.lol, everything else on cinema.comvie.lol. */
function useHostRouting() {
  const { pathname, search, hash } = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    if (!onProd()) return;
    const rest = pathname + search + hash;
    const h = location.hostname;
    const ps = pathSection(pathname);
    if (h === 'comvie.lol' || h === 'www.comvie.lol') {
      // the bare domain opens Cinema (or Anime / Manga for their links), bringing this browser's saved data along
      window.location.replace(ORIGINS[ps ?? 'cinema'] + rest + (ps ? '' : migrationHash()));
      return;
    }
    const hs = hostSection();
    if (hs && hs !== 'cinema') {
      if (pathname === '/') nav(`/${hs}`, { replace: true });
      else if (ps !== hs && !isShared(pathname)) window.location.replace(ORIGINS[ps ?? 'cinema'] + rest);
    } else if (ps) {
      window.location.replace(ORIGINS[ps] + rest);
    }
  }, [pathname, search, hash, nav]);
}

export default function App() {
  const { pathname } = useLocation();
  useHostRouting();
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
      <Suspense fallback={<div className="status" style={{ minHeight: '70vh' }}><div className="spinner" aria-label="Loading" /></div>}>
      <Routes>
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
        <Route path="/manga/library" element={<MangaLibrary />} />
        <Route path="/manga/title/:id" element={<MangaDetail />} />
        <Route path="/manga/read/:id" element={<MangaRead />} />
        <Route path="/live" element={<Live />} />
        <Route path="/list" element={<MyList key="main" />} />
        <Route path="/person/:id" element={<PersonPage />} />
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
        <Route path="*" element={<Home />} />
      </Routes>
      </Suspense>
      <Footer />
      {!watching && <Floating />}
      <AuthModal />
      <CrossPromo />
      <Tooltip />
    </>
  );
}
