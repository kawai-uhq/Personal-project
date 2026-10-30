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

/**
 * A pop-up that points visitors at another part of the site, over a random cover from it: Cinema advertises Anime and Manga,
 * Anime advertises Cinema and Manga, Manga advertises Cinema and Anime (taking turns). Once per visit, never over a video
 * or the reader, and gone for good after "Don't show again".
 */
export default function CrossPromo() {
  const section = useSection();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Section | null>(null);
  const [art, setArt] = useState<string | null>(null);
  const [never, setNever] = useState(false);
  const [done, setDone] = useState(false);
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
      const to = nextTarget(section);
      let pic: string | null = null;
      try {
        pic = await coverFor(to);
      } catch {
        /* show it without a picture */
      }
      if (!live) return;
      setTarget(to);
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
  }, [done, busy, section]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open || !target || target === section) return null;
  const { title, text } = COPY[target];
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className={`modal promo promo-${target}`} role="dialog" aria-modal="true" aria-label={title}>
        {art && <img className="promo-art" src={art} alt="" />}
        <div className="promo-shade" />
        <button className="modal-close" aria-label="Close" onClick={() => setOpen(false)}><Icon name="x" size={16} /></button>
        <div className="promo-body">
          <h2>{title}</h2>
          <p>{text}</p>
          <a className="btn primary promo-go" href={sectionHome(target)}>
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
