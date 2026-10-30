import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon';
import { aniCovers } from '../lib/anilist';
import { useSection } from '../lib/section';
import { sectionHome } from '../lib/site';
import { store } from '../lib/storage';
import { posterSrc, tmdb } from '../lib/tmdb';

const SEEN = 'comvie.promoseen';

/**
 * A pop-up that points visitors at the other half of the site: on Cinema it advertises Anime (over a random anime cover),
 * on Anime it advertises Cinema (over a random movie or show poster). Once per visit, never over a video, and gone for good
 * after "Don't show again".
 */
export default function CrossPromo() {
  const section = useSection();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [art, setArt] = useState<string | null>(null);
  const [never, setNever] = useState(false);
  const [done, setDone] = useState(false);
  const toAnime = section === 'cinema';
  const playing = pathname.startsWith('/watch/') || pathname.startsWith('/anime/watch/');

  useEffect(() => {
    if (done || playing || store.getPromoHide()) return;
    try {
      if (sessionStorage.getItem(SEEN)) return;
    } catch {
      /* private mode: just show it once per page load */
    }
    let live = true;
    const t = window.setTimeout(async () => {
      let pic: string | null = null;
      try {
        if (toAnime) {
          const covers = await aniCovers();
          pic = covers[Math.floor(Math.random() * covers.length)] ?? null;
        } else {
          const r = await tmdb.feed('trending-day');
          const withPoster = r.items.filter((m) => m.poster);
          const m = withPoster[Math.floor(Math.random() * withPoster.length)];
          pic = m?.poster ? posterSrc(m.poster) : null;
        }
      } catch {
        /* show it without a picture */
      }
      if (!live) return;
      setArt(pic);
      setOpen(true);
      setDone(true);
      try {
        sessionStorage.setItem(SEEN, '1');
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [done, playing, toAnime]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const title = toAnime ? 'We also have anime' : 'We also have movies & TV';
  const text = toAnime
    ? 'Thousands of anime series and films, with sub and dub, on Comvie Anime.'
    : 'Trending movies, TV shows and live channels on Comvie Cinema.';
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="modal promo" role="dialog" aria-modal="true" aria-label={title}>
        {art && <img className="promo-art" src={art} alt="" />}
        <div className="promo-shade" />
        <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" size={16} /></button>
        <div className="promo-body">
          <h2>{title}</h2>
          <p>{text}</p>
          <a className="btn primary promo-go" href={sectionHome(toAnime ? 'anime' : 'cinema')}>
            <Icon name="link" size={16} />Take me there
          </a>
          <label className="promo-never">
            <input
              type="checkbox"
              checked={never}
              onChange={(e) => {
                setNever(e.target.checked);
                store.savePromoHide(e.target.checked);
              }}
            />
            Don't show this again
          </label>
        </div>
      </div>
    </div>
  );
}
