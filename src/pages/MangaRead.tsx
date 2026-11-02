import { useEffect, useRef, useState } from 'react';
import { usePageTitle } from '../lib/title';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Select from '../components/Select';
import { Status } from '../components/Rows';
import { chapterLabel, mangaFull, mdChapters, mdFind, mdPages } from '../lib/manga';
import type { Chapter, MangaFull, PageSet } from '../lib/manga';
import { mangaStore } from '../lib/mangaStore';
import { reportProgress } from '../lib/anilistAccount';

type Mode = 'strip' | 'pages';
interface ReaderPrefs { mode: Mode; rtl: boolean }
const PREFS = 'comvie.reader';
const POS = 'comvie.readpos';

const readJson = <T,>(k: string, fb: T): T => {
  try { return JSON.parse(localStorage.getItem(k) || '') as T; } catch { return fb; }
};
const writeJson = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ }
};

/** Reading mode for a title: what the viewer chose for it, else page-by-page right-to-left for Japanese manga
 *  and a long strip for manhwa / manhua / webtoons. */
function prefsFor(id: number, country: string | null): ReaderPrefs {
  const saved = readJson<Record<string, ReaderPrefs>>(PREFS, {})[id];
  if (saved) return saved;
  return country === 'JP' ? { mode: 'pages', rtl: true } : { mode: 'strip', rtl: false };
}
function savePrefs(id: number, p: ReaderPrefs) {
  const all = readJson<Record<string, ReaderPrefs>>(PREFS, {});
  all[id] = p;
  const keys = Object.keys(all);
  if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete all[k]);
  writeJson(PREFS, all);
}
/** The page the viewer was on, per title */
const savedPage = (id: number, chapter: string) => {
  const p = readJson<Record<string, { c: string; p: number }>>(POS, {})[id];
  return p && p.c === chapter ? p.p : 0;
};
function savePage(id: number, chapter: string, page: number) {
  const all = readJson<Record<string, { c: string; p: number }>>(POS, {});
  all[id] = { c: chapter, p: page };
  const keys = Object.keys(all);
  if (keys.length > 300) keys.slice(0, keys.length - 300).forEach((k) => delete all[k]);
  writeJson(POS, all);
}

/** One page image that walks down its list of copies when one fails to load */
function PageImg({ tries, i, eager, className }: { tries: string[]; i: number; eager?: boolean; className?: string }) {
  return (
    <img
      className={className}
      src={tries[0]}
      alt={`Page ${i + 1}`}
      data-page={i}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={(e) => {
        // a page that fails to load moves down its list: data-saver copy, then MangaDex's own server
        const img = e.currentTarget;
        const step = Number(img.dataset.try || '0') + 1;
        const alt = tries[step];
        if (alt) {
          img.dataset.try = String(step);
          img.src = alt;
        } else {
          img.classList.add('mr-broken');
          img.alt = `Page ${i + 1} couldn't be loaded`;
        }
      }}
    />
  );
}

/** The reader: one chapter as a long vertical strip or page by page (right to left for manga), with
 *  next / previous chapter, and the page you were on remembered. */
export default function MangaRead() {
  const { id } = useParams();
  const mid = Number(id);
  const [sp] = useSearchParams();
  const cid = sp.get('c') ?? '';
  const lang = sp.get('l') || 'en';
  const nav = useNavigate();
  const [m, setM] = useState<MangaFull | null>(null);
  usePageTitle(m ? `${m.title}` : null);
  const [chs, setChs] = useState<Chapter[] | null>(null);
  const [pages, setPages] = useState<PageSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const saver = useRef<Set<string>>(new Set());
  const [prefs, setPrefs] = useState<ReaderPrefs>({ mode: 'strip', rtl: false });
  const [page, setPage] = useState(0); // current page (both modes)
  const strip = useRef<HTMLDivElement>(null);

  // the series and its chapter list (once per title)
  useEffect(() => {
    let live = true;
    setError(null);
    mangaFull(mid)
      .then(async (r) => {
        if (!live) return;
        setM(r);
        setPrefs(prefsFor(r.id, r.country));
        const md = await mdFind(r);
        const list = md ? await mdChapters(md, lang) : [];
        // only chapters with pages here; official-site links stay on the title page
        if (live) setChs(list.filter((c) => !c.ext));
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [mid, lang, tick]);

  const idx = chs ? chs.findIndex((c) => c.id === cid) : -1;
  const cur = idx >= 0 && chs ? chs[idx] : null;
  const prev = idx > 0 && chs ? chs[idx - 1] : null;
  const next = idx >= 0 && chs && idx < chs.length - 1 ? chs[idx + 1] : null;

  // the pages of this chapter
  useEffect(() => {
    if (!cid) return;
    let live = true;
    setPages(null);
    saver.current = new Set();
    setPage(savedPage(mid, cid));
    mdPages(cid).then((p) => live && setPages(p)).catch((e: Error) => live && setError(e.message));
    window.scrollTo(0, 0);
    return () => {
      live = false;
    };
  }, [cid, tick]);

  // remember where you are
  useEffect(() => {
    if (m && cur) {
      mangaStore.addRead(m, cur.id, chapterLabel(cur), lang);
      mangaStore.markSeen(m.id, cur.id);
      const n = Math.floor(parseFloat(cur.num));
      if (n > 0) void reportProgress(m.id, n, m.chapters);
    }
  }, [m, cur, lang]);

  // warm up the next chapter's page list
  useEffect(() => {
    if (pages && next) void mdPages(next.id).catch(() => undefined);
  }, [pages, next]);

  const go = (c: Chapter | null) => c && nav(`/manga/read/${mid}?c=${c.id}&l=${lang}`);
  const count = pages?.full.length ?? 0;

  // remember the page
  useEffect(() => {
    if (pages && cid) savePage(mid, cid, page);
  }, [page, pages, cid, mid]);

  // page-by-page: forward / back, moving to the next / previous chapter at the ends
  const forward = () => (page < count - 1 ? setPage(page + 1) : go(next));
  const backward = () => (page > 0 ? setPage(page - 1) : go(prev));

  // strip: jump back to the saved page once the pages are there, then keep track of the page in view
  useEffect(() => {
    if (prefs.mode !== 'strip' || !pages || !strip.current) return;
    const start = savedPage(mid, cid);
    if (start > 0) strip.current.querySelector<HTMLElement>(`[data-page="${start}"]`)?.scrollIntoView({ block: 'start' });
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (es) => {
        const vis = es.filter((x) => x.isIntersecting).map((x) => Number((x.target as HTMLElement).dataset.page));
        if (vis.length) setPage(Math.min(...vis));
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    strip.current.querySelectorAll('img[data-page]').forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.mode, pages]);

  // keys: in page mode the arrows turn pages (reversed for right-to-left); in the strip they switch chapters
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (prefs.mode === 'pages') {
        if (e.key === 'ArrowRight') (prefs.rtl ? backward : forward)();
        if (e.key === 'ArrowLeft') (prefs.rtl ? forward : backward)();
        if (e.key === ' ') {
          e.preventDefault();
          forward();
        }
        return;
      }
      if (e.key === 'ArrowRight' && next) go(next);
      if (e.key === 'ArrowLeft' && prev) go(prev);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, prev, prefs, page, count]);

  const changePrefs = (p: ReaderPrefs) => {
    setPrefs(p);
    if (m) savePrefs(m.id, p);
  };

  const back = `/manga/title/${mid}`;
  if (error) return <main className="page pad-top"><Status kind="error" text={error} retry={() => { setError(null); setTick((n) => n + 1); }} /></main>;
  if (!m || !chs) return <main className="page pad-top"><Status kind="loading" /></main>;
  if (!cur) return <main className="page pad-top"><Status kind="empty" text="That chapter isn't available." /><div className="center-row"><Link className="btn" to={back}>Back to {m.title}</Link></div></main>;

  const bar = (
    <div className="mr-nav">
      <button className="btn small ghost" disabled={!prev} onClick={() => go(prev)}><Icon name="chevronLeft" size={16} />Prev</button>
      <button className="btn small primary" disabled={!next} onClick={() => go(next)}>Next<Icon name="chevronRight" size={16} /></button>
    </div>
  );

  return (
    <main className="page pad-top mr">
      <div className="mr-top">
        <Link to={back} className="mr-back"><Icon name="chevronLeft" size={18} />{m.title}</Link>
        <Select className="field select" value={cur.id} onChange={(e) => nav(`/manga/read/${mid}?c=${e.target.value}&l=${lang}`)} aria-label="Chapter">
          {[...chs].reverse().map((c) => <option key={c.id} value={c.id}>{chapterLabel(c)}{c.title ? ` · ${c.title}` : ''}</option>)}
        </Select>
        {bar}
      </div>
      <div className="mr-modes">
        <div className="seg mr-seg" role="radiogroup" aria-label="Reading mode">
          <button type="button" role="radio" aria-checked={prefs.mode === 'strip'} className={prefs.mode === 'strip' ? 'on' : ''} onClick={() => changePrefs({ ...prefs, mode: 'strip' })}>Long strip</button>
          <button type="button" role="radio" aria-checked={prefs.mode === 'pages'} className={prefs.mode === 'pages' ? 'on' : ''} onClick={() => changePrefs({ ...prefs, mode: 'pages' })}>Page by page</button>
        </div>
        {prefs.mode === 'pages' && (
          <button type="button" className="btn small ghost" onClick={() => changePrefs({ ...prefs, rtl: !prefs.rtl })} title="Which way pages turn">
            {prefs.rtl ? 'Right to left' : 'Left to right'}
          </button>
        )}
        {count > 0 && <span className="muted small mr-count">Page {Math.min(page + 1, count)} / {count}</span>}
      </div>
      <h1 className="mr-title">{chapterLabel(cur)}{cur.title ? <span> · {cur.title}</span> : null}</h1>
      {!pages ? (
        <Status kind="loading" />
      ) : pages.full.length === 0 ? (
        <Status kind="empty" text="This chapter has no pages." />
      ) : prefs.mode === 'pages' ? (
        <div className={`mr-book ${prefs.rtl ? 'rtl' : ''}`}>
          <div className="mr-sheet">
            <PageImg key={pages.full[Math.min(page, count - 1)]} tries={pages.tries[Math.min(page, count - 1)] ?? [pages.full[Math.min(page, count - 1)]]} i={Math.min(page, count - 1)} eager className="mr-one" />
            {/* tap zones: the outer edges turn pages (the left edge goes forward when reading right to left) */}
            <button className="mr-zone left" aria-label={prefs.rtl ? 'Next page' : 'Previous page'} onClick={prefs.rtl ? forward : backward} />
            <button className="mr-zone right" aria-label={prefs.rtl ? 'Previous page' : 'Next page'} onClick={prefs.rtl ? backward : forward} />
          </div>
          <div className="mr-progress" aria-hidden="true"><i style={{ width: `${((Math.min(page, count - 1) + 1) / count) * 100}%` }} /></div>
          {/* the next two pages load in the background so turning is instant */}
          <div hidden>
            {[1, 2].map((d) => pages.full[page + d] && <img key={d} src={pages.full[page + d]} alt="" />)}
          </div>
        </div>
      ) : (
        <div className="mr-pages" ref={strip}>
          {pages.full.map((src, i) => (
            <PageImg key={src} tries={pages.tries[i] ?? [src]} i={i} eager={i < 3} />
          ))}
        </div>
      )}
      <div className="mr-end">
        <p className="muted">{next ? `End of ${chapterLabel(cur)}` : `You're caught up. That's the latest ${chapterLabel(cur)} available.`}</p>
        {bar}
        <p className="muted small">Chapters and scans come from <a className="link" href="https://mangadex.org" target="_blank" rel="noopener noreferrer">MangaDex</a> and its scanlation groups.</p>
      </div>
    </main>
  );
}
