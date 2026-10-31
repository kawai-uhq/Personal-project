import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { MangaCard, MangaRow } from '../components/MangaCard';
import { DetailSkeleton, Row, Status } from '../components/Rows';
import Select from '../components/Select';
import { MANGA_STATUS, chapterLabel, hostOf, kindOf, langName, mangaFull, mdChapters, mdFind, mdLanguages } from '../lib/manga';
import type { Chapter, MangaFull } from '../lib/manga';
import { mangaStore, useMangaStore } from '../lib/mangaStore';

const day = (t: number) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const LANG_KEY = 'comvie.manga.lang';
const savedLang = () => {
  try { return localStorage.getItem(LANG_KEY) || 'en'; } catch { return 'en'; }
};

/** A manga's title page: details, chapter list (with language choice), related and recommended titles. */
export default function MangaDetail() {
  const { id } = useParams();
  const mid = Number(id);
  const store = useMangaStore();
  const [m, setM] = useState<MangaFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mdId, setMdId] = useState<string | null | undefined>(undefined); // undefined = still looking
  const [langs, setLangs] = useState<string[]>([]);
  const [lang, setLang] = useState('en');
  const [chs, setChs] = useState<Chapter[] | null>(null);
  const [chError, setChError] = useState<string | null>(null);
  const [newest, setNewest] = useState(true);
  const [toast, setToast] = useState('');
  const [tick, setTick] = useState(0);

  // the series, then where it lives on MangaDex and which languages it has
  useEffect(() => {
    let live = true;
    setM(null);
    setError(null);
    setMdId(undefined);
    setLangs([]);
    setChs(null);
    setChError(null);
    mangaFull(mid)
      .then(async (r) => {
        if (!live) return;
        setM(r);
        const md = await mdFind(r);
        if (!live) return;
        setMdId(md);
        if (!md) return;
        const l = await mdLanguages(md).catch(() => ['en']);
        if (!live) return;
        const list = l.length ? l : ['en'];
        setLangs(list);
        const want = savedLang();
        setLang(list.includes(want) ? want : list.includes('en') ? 'en' : list[0]);
      })
      .catch((e: Error) => {
        if (!live) return;
        if (m) setChError(e.message);
        else setError(e.message);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid, tick]);

  // the chapters in the chosen language
  useEffect(() => {
    if (!mdId || !langs.length) return;
    let live = true;
    setChs(null);
    setChError(null);
    mdChapters(mdId, lang).then((c) => live && setChs(c)).catch((e: Error) => live && setChError(e.message));
    return () => {
      live = false;
    };
  }, [mdId, lang, langs.length]);

  const pickLang = (l: string) => {
    setLang(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
  };

  const seen = new Set(store.seen(mid));
  const last = store.history().find((w) => w.id === mid);
  const ordered = useMemo(() => (chs ? (newest ? [...chs].reverse() : chs) : []), [chs, newest]);
  const readable = chs?.filter((c) => !c.ext) ?? [];
  const official = chs?.filter((c) => c.ext) ?? [];

  if (error) return <main className="page pad-top"><Status kind="error" text={error} retry={() => setTick((n) => n + 1)} /></main>;
  if (!m) return <DetailSkeleton />;

  const inList = store.list().some((x) => x.id === m.id);
  const readTo = (c: Chapter) => `/manga/read/${m.id}?c=${c.id}&l=${lang}`;
  // AniList import: "read up to N" becomes "continue at chapter N+1" once the chapter list is known
  const fromAniList = last && !last.chapterId && last.progress && chs
    ? chs.find((c) => !c.ext && parseFloat(c.num) === last.progress! + 1) ?? chs.find((c) => !c.ext && parseFloat(c.num) === last.progress)
    : null;
  const resume = last && (last.lang ?? 'en') === lang && chs?.some((c) => c.id === last.chapterId)
    ? last
    : fromAniList
      ? { ...last!, chapterId: fromAniList.id, label: chapterLabel(fromAniList) }
      : null;
  const firstReadable = readable[0];
  const firstOfficial = official[0];
  const looking = mdId === undefined || (mdId && chs === null && !chError);

  let emptyText = 'No chapters were found for this title.';
  if (mdId === null) emptyText = "This title couldn't be found on MangaDex, our chapter source.";
  else if (chs && chs.length === 0) emptyText = langs.length > 1 ? `No ${langName(lang)} chapters. Try another language above.` : `No ${langName(lang)} chapters have been uploaded yet.`;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: m.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast('Link copied');
        setTimeout(() => setToast(''), 1800);
      }
    } catch { /* dismissed */ }
  };

  return (
    <main className="page">
      <section className="td">
        {(m.banner || m.cover) && <div className="td-bg"><img src={m.banner || m.cover} alt="" /></div>}
        <div className="container td-in">
          <div className="td-side">
            <img className="td-poster" src={m.cover} alt={m.title} />
            <div className="td-btns">
              {resume ? (
                <Link className="btn primary" to={`/manga/read/${m.id}?c=${resume.chapterId}&l=${lang}`}><Icon name="book" size={16} />Continue {resume.label}</Link>
              ) : firstReadable ? (
                <Link className="btn primary" to={readTo(firstReadable)}><Icon name="book" size={16} />Start reading</Link>
              ) : firstOfficial ? (
                <a className="btn primary" href={firstOfficial.ext!} target="_blank" rel="noopener noreferrer"><Icon name="link" size={16} />Read on {hostOf(firstOfficial.ext!)}</a>
              ) : (
                <button className="btn ghost" disabled>{looking ? 'Finding chapters…' : 'No chapters yet'}</button>
              )}
              <button className="btn ghost" onClick={() => mangaStore.toggleList(m)}><Icon name={inList ? 'check' : 'bookmark'} size={16} />{inList ? 'In Library' : 'Add to Library'}</button>
              <button className="btn ghost" onClick={() => void share()}><Icon name="share" size={16} />Share</button>
              {toast && <p className="muted small" role="status">{toast}</p>}
            </div>
          </div>
          <div className="td-info">
            <div className="td-chips">
              {m.score > 0 && <span className="chip rate"><Icon name="star" size={14} fill />{(m.score / 10).toFixed(1)}</span>}
              <span className="chip">{kindOf(m)}</span>
              {m.status && <span className={`chip stat ${m.status === 'FINISHED' || m.status === 'RELEASING' ? 'ok' : ''}`}>{MANGA_STATUS[m.status] ?? m.status}</span>}
              {m.year && <span className="chip"><Icon name="calendar" size={14} />{m.year}</span>}
            </div>
            <h1>{m.title}</h1>
            {m.alt && <p className="tagline">{m.alt}</p>}
            {m.genres.length > 0 && <p className="genres">{m.genres.map((g) => <Link key={g} to={`/manga/explore?genre=${encodeURIComponent(g)}`}>{g}</Link>)}</p>}
            <h3>Overview</h3>
            <p className="overview" style={{ marginTop: 0 }}>{m.desc || 'No description available.'}</p>
            <div className="tstats">
              <div><small>Chapters</small><strong>{m.chapters ?? '—'}</strong></div>
              <div><small>Volumes</small><strong>{m.volumes ?? '—'}</strong></div>
              <div><small>Author</small><strong>{m.creators.length ? m.creators.map((c, i) => <span key={c.id}>{i > 0 && ', '}<Link className="link" to={`/manga/creator/${c.id}`}>{c.name}</Link></span>) : m.authors.join(', ') || '—'}</strong></div>
              <div><small>Readable here</small><strong>{chs ? readable.length : '…'}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="season-head mch-head">
          <h2 className="section">Chapters</h2>
          <div className="mch-tools">
            {langs.length > 1 && (
              <Select className="field select" value={lang} onChange={(e) => pickLang(e.target.value)} aria-label="Language">
                {langs.map((l) => <option key={l} value={l}>{langName(l)}</option>)}
              </Select>
            )}
            {chs && chs.length > 1 && (
              <button className="btn small ghost" onClick={() => setNewest((n) => !n)}><Icon name="filter" size={14} />{newest ? 'Newest first' : 'Oldest first'}</button>
            )}
          </div>
        </div>
        {official.length > 0 && (
          <p className="muted small mch-note">
            Chapters marked <b className="mch-off">Official</b> are licensed and open on {hostOf(official[0].ext!)} in a new tab.
            {readable.length === 0 && langs.length > 1 ? ' Other languages may have chapters you can read here.' : ''}
          </p>
        )}
        {chError ? (
          <Status kind="error" text={chError} retry={() => setTick((n) => n + 1)} />
        ) : looking ? (
          <Status kind="loading" />
        ) : !chs || chs.length === 0 ? (
          <Status kind="empty" text={emptyText} />
        ) : (
          <div className="mch-list">
            {ordered.map((c) =>
              c.ext ? (
                <a key={c.id} href={c.ext} target="_blank" rel="noopener noreferrer" className="mch ext">
                  <b>{chapterLabel(c)}</b>
                  <span>{c.title || (c.vol ? `Volume ${c.vol}` : '')}</span>
                  <small className="mch-off">Official <Icon name="link" size={11} /></small>
                </a>
              ) : (
                <Link key={c.id} to={readTo(c)} className={`mch ${seen.has(c.id) ? 'seen' : ''} ${last?.chapterId === c.id ? 'now' : ''}`}>
                  <b>{chapterLabel(c)}</b>
                  <span>{c.title || (c.vol ? `Volume ${c.vol}` : '')}</span>
                  <small>{seen.has(c.id) ? 'Read' : day(c.at)}</small>
                </Link>
              )
            )}
          </div>
        )}

        {m.related.length > 0 && (
          <Row title="Related">
            {m.related.map((r) => <MangaCard key={r.item.id} m={r.item} tag={r.relation.toUpperCase()} />)}
          </Row>
        )}
        <MangaRow title="You might also like" items={m.recs} />
      </div>
    </main>
  );
}
