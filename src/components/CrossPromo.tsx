import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon';
import { aniCovers } from '../lib/anilist';
import { mangaCovers } from '../lib/manga';
import { useSection } from '../lib/section';
import type { Section } from '../lib/section';
import { sectionHome } from '../lib/site';
import { store } from '../lib/storage';
import { posterSrc, tmdb } from '../lib/tmdb';

const SEEN = 'comvie.promoseen';
const TURN = 'comvie.promoturn';

const COPY: Record<Section, { title: string; text: string }> = {
  cinema: { title: 'We also have movies & TV', text: 'Trending movies, TV shows and live channels on Comvie Cinema.' },
  anime: { title: 'We also have anime', text: 'Thousands of anime series and films, with sub and dub, on Comvie Anime.' },
  manga: { title: 'We also have manga', text: 'Read manga, manhwa and manhua chapter by chapter on Comvie Manga.' }
};

const pick = <T,>(list: T[]): T | null => (list.length ? list[Math.floor(Math.random() * list.length)] : null);

async function coverFor(s: Section): Promise<string | null> {
  if (s === 'anime') return pick(await aniCovers());
  if (s === 'manga') return pick(await mangaCovers());
  const r = await tmdb.feed('trending-day');
  const m = pick(r.items.filter((x) => x.poster));
  return m?.poster ? posterSrc(m.poster) : null;
}

/** Which other section to advertise this visit: the two others take turns. */
function nextTarget(here: Section): Section {
  const others = (['cinema', 'anime', 'manga'] as Section[]).filter((s) => s !== here);
  let n = 0;
  try {
    n = Number(localStorage.getItem(TURN)) || 0;
    localStorage.setItem(TURN, String(n + 1));
  } catch {
    n = Math.floor(Math.random() * 2);
  }
  return others[n % others.length];
}

interface Slide { to: Section; art: string | null }

/**
 * A pop-up that points visitors at the other parts of the site: two slides (e.g. Anime and Manga on Cinema), each over a
 * random cover from that section, switched with arrows, dots or a swipe. Once per visit, never over a video or the reader,
 * and gone for good after "Don't show again".
 */
export default function CrossPromo() {
  const section = useSection();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [at, setAt] = useState(0);
  const [never, setNever] = useState(false);
  const [done, setDone] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);
  const busy = pathname.startsWith('/watch/') || pathname.startsWith('/anime/watch/') || pathname.startsWith('/manga/read/');

  useEffect(() => {
    if (done || busy || store.getPromoHide()) return;
    try {
      if (sessionStorage.getItem(SEEN)) return;
    } catch {
      /* private mode: just show it once per page load */
    }
    let live = true;
    const t = window.setTimeout(async () => {
      const others = (['cinema', 'anime', 'manga'] as Section[]).filter((x) => x !== section);
      const first = nextTarget(section);
      const order = [first, ...others.filter((x) => x !== first)];
      const arts = await Promise.all(order.map((to) => coverFor(to).catch(() => null)));
      if (!live) return;
      setSlides(order.map((to, i) => ({ to, art: arts[i] })));
      setAt(0);
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
  }, [done, busy, section]);

  const n = slides.length;
  const move = (d: number) => n && setAt((i) => (i + d + n) % n);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowRight') move(1);
      else if (e.key === 'ArrowLeft') move(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, n]);

  if (!open || !n) return null;
  const cur = slides[at];
  const { title, text } = COPY[cur.to];
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div
        className={`modal promo promo-${cur.to}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
          setTouchX(null);
        }}
      >
        {slides.map((sl, i) => sl.art && <img key={sl.to} className={`promo-art ${i === at ? 'on' : ''}`} src={sl.art} alt="" />)}
        <div className="promo-shade" />
        <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" size={16} /></button>
        {n > 1 && (
          <>
            <button className="promo-arrow left" aria-label="Previous" onClick={() => move(-1)}><Icon name="chevronLeft" size={20} /></button>
            <button className="promo-arrow right" aria-label="Next" onClick={() => move(1)}><Icon name="chevronRight" size={20} /></button>
          </>
        )}
        <div className="promo-body">
          <h2>{title}</h2>
          <p>{text}</p>
          <a className="btn primary promo-go" href={sectionHome(cur.to)}>
            <Icon name="link" size={16} />Take me there
          </a>
          {n > 1 && (
            <div className="promo-dots" role="tablist" aria-label="Choose">
              {slides.map((sl, i) => (
                <button key={sl.to} role="tab" aria-selected={i === at} aria-label={COPY[sl.to].title} className={i === at ? 'on' : ''} onClick={() => setAt(i)} />
              ))}
            </div>
          )}
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
