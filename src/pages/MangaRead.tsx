import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon';
import Select from '../components/Select';
import { Status } from '../components/Rows';
import { chapterLabel, mangaFull, mdChapters, mdFind, mdPages } from '../lib/manga';
import type { Chapter, MangaFull, PageSet } from '../lib/manga';
import { mangaStore } from '../lib/mangaStore';
import { reportProgress } from '../lib/anilistAccount';

/** The reader: pages of one chapter in a long vertical strip, with next / previous chapter. */
export default function MangaRead() {
  const { id } = useParams();
  const mid = Number(id);
  const [sp] = useSearchParams();
  const cid = sp.get('c') ?? '';
  const lang = sp.get('l') || 'en';
  const nav = useNavigate();
  const [m, setM] = useState<MangaFull | null>(null);
  const [chs, setChs] = useState<Chapter[] | null>(null);
  const [pages, setPages] = useState<PageSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const saver = useRef<Set<string>>(new Set());

  // the series and its chapter list (once per title)
  useEffect(() => {
    let live = true;
    setError(null);
    mangaFull(mid)
      .then(async (r) => {
        if (!live) return;
        setM(r);
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

  // arrow keys switch chapters
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea')) return;
      if (e.key === 'ArrowRight' && next) go(next);
      if (e.key === 'ArrowLeft' && prev) go(prev);
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, prev]);

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
      <h1 className="mr-title">{chapterLabel(cur)}{cur.title ? <span> · {cur.title}</span> : null}</h1>
      {!pages ? (
        <Status kind="loading" />
      ) : pages.full.length === 0 ? (
        <Status kind="empty" text="This chapter has no pages." />
      ) : (
        <div className="mr-pages">
          {pages.full.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`Page ${i + 1}`}
              loading={i < 3 ? 'eager' : 'lazy'}
              decoding="async"
              onError={(e) => {
                // a page that fails to load is retried once from the smaller "data saver" copy
                const alt = pages.saver[i];
                if (alt && !saver.current.has(src)) {
                  saver.current.add(src);
                  e.currentTarget.src = alt;
                }
              }}
            />
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
