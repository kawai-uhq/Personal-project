import { Suspense, lazy, useEffect } from 'react';
import SectionSplash from './components/SectionSplash';
import { sectionFor } from './lib/section';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AuthModal from './components/AuthModal';
import Navbar from './components/Navbar';
const Detail = lazy(() => import('./pages/Detail'));
const GenreResults = lazy(() => import('./pages/GenreResults'));
const Genres = lazy(() => import('./pages/Genres'));
const Explore = lazy(() => import('./pages/Explore'));
import Tooltip from './components/Tooltip';
import DiscordPopup from './components/DiscordPopup';
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
const Search = lazy(() => import('./pages/Search'));
const Settings = lazy(() => import('./pages/Settings'));
const Watch = lazy(() => import('./pages/Watch'));

export default function App() {
  const { pathname } = useLocation();
  const watching = pathname.startsWith('/watch/');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // the anime section has its own orange accent
  const section = sectionFor(pathname);
  const anime = section === 'anime';
  useEffect(() => {
    document.documentElement.classList.toggle('anime', anime);
    return () => document.documentElement.classList.remove('anime');
  }, [anime]);

  return (
    <>
      <Navbar />
      <SectionSplash section={section} />
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
        <Route path="/anime/explore" element={<AnimeExplore />} />
        <Route path="/anime/genres" element={<AnimeGenres />} />
        <Route path="/anime/library" element={<AnimeLibrary />} />
        <Route path="/anime/title/:id" element={<AnimeDetail />} />
        <Route path="/anime/watch/:id" element={<AnimeWatch />} />
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
        <Route path="/settings" element={<Settings />} />
        <Route path="/title/:type/:id" element={<Detail />} />
        <Route path="/watch/:type/:id" element={<Watch />} />
        <Route path="*" element={<Home />} />
      </Routes>
      </Suspense>
      <Footer />
      {!watching && <Floating />}
      <AuthModal />
      <DiscordPopup />
      <Tooltip />
    </>
  );
}
