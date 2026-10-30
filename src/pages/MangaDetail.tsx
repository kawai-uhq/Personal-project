import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { MangaCard, MangaRow } from '../components/MangaCard';
import { DetailSkeleton, Row, Status } from '../components/Rows';
import { MANGA_STATUS, chapterLabel, kindOf, mangaFull, mdChapters, mdFind } from '../lib/manga';
import type { Chapter, MangaFull } from '../lib/manga';
import { mangaStore, useMangaStore } from '../lib/mangaStore';

const day = (t: number) => (t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** A manga's title page: details, chapter list, related and recommended titles. */
export default function MangaDetail() {
  const { id } = useParams();
  const mid = Number(id);
  const store = useMangaStore();
  const [m, setM] = useState<MangaFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chs, setChs] = useState<Chapter[] | null>(null);
  const [chError, setChError] = useState<string | null>(null);
  const [newest, setNewest] = useState(true);
  const [toast, setToast] = useState('');

  const loadChapters = (manga: MangaFull) => {
    setChs(null);
    setChError(null);
    mdFind(manga)
      .then((md) => (md ? mdChapters(md) : []))
      .then(setChs)
      .catch((e: Error) => setChError(e.message));
  };

  useEffect(() => {
    let live = true;
    setM(null);
    setError(null);
    setChs(null);
    mangaFull(mid)
      .then((r) => {
        if (!live) return;
        setM(r);
        loadChapters(r);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mid]);

  const seen = new Set(store.seen(mid));
  const last = store.history().find((w) => w.id === mid);
  const ordered = useMemo(() => (chs ? (newest ? [...chs].reverse() : chs) : []), [chs, newest]);

  if (error) return <main className="page pad-top"><Status kind="error" text={error} /></main>;
  if (!m) return <DetailSkeleton />;

  const inList = store.list().some((x) => x.id === m.id);
  const first = chs?.[0];
  const startTo = last ? `/manga/read/${m.id}?c=${last.chapterId}` : first ? `/manga/read/${m.id}?c=${first.id}` : '';
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
              {startTo ? (
                <Link className="btn primary" to={startTo}><Icon name="book" size={16} />{last ? `Continue ${last.label}` : 'Start reading'}</Link>
              ) : (
                <button className="btn ghost" disabled>{chs === null && !chError ? 'Finding chapters…' : 'No chapters yet'}</button>
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
              <div><small>Chapters</small><strong>{m.chapters ?? (chs?.length || '—')}</strong></div>
              <div><small>Volumes</small><strong>{m.volumes ?? '—'}</strong></div>
              <div><small>Author</small><strong>{m.authors.join(', ') || '—'}</strong></div>
              <div><small>Available to read</small><strong>{chs ? chs.length : '…'}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <div className="season-head">
          <h2 className="section">Chapters</h2>
          {chs && chs.length > 1 && (
            <button className="btn small ghost" onClick={() => setNewest((n) => !n)}><Icon name="filter" size={14} />{newest ? 'Newest first' : 'Oldest first'}</button>
          )}
        </div>
        {chError ? (
          <Status kind="error" text={chError} retry={() => loadChapters(m)} />
        ) : chs === null ? (
          <Status kind="loading" />
        ) : chs.length === 0 ? (
          <Status kind="empty" text="No English chapters were found for this title." />
        ) : (
          <div className="mch-list">
            {ordered.map((c) => (
              <Link key={c.id} to={`/manga/read/${m.id}?c=${c.id}`} className={`mch ${seen.has(c.id) ? 'seen' : ''} ${last?.chapterId === c.id ? 'now' : ''}`}>
                <b>{chapterLabel(c)}</b>
                <span>{c.title || (c.vol ? `Volume ${c.vol}` : '')}</span>
                <small>{seen.has(c.id) ? 'Read' : day(c.at)}</small>
              </Link>
            ))}
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
