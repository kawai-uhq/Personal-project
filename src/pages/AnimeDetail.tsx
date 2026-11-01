import AnimeCast from '../components/AnimeCast';
import { useEffect, useState } from 'react';
import { usePageTitle } from '../lib/title';
import { Link, useParams } from 'react-router-dom';
import { AniRow, AnimeCard } from '../components/AnimeCard';
import Icon from '../components/Icon';
import TrailerModal from '../components/TrailerModal';
import AnimeSeasons from '../components/AnimeSeasons';
import { DetailSkeleton, Row, Status } from '../components/Rows';
import WatchedTick from '../components/WatchedTick';
import { FORMAT_LABEL, STATUS_LABEL, aniFull, availableEpisodes } from '../lib/anilist';
import type { AniFull } from '../lib/anilist';
import { animeStore, useAnimeStore } from '../lib/animeStore';
import { clock } from '../lib/progress';
import Select from '../components/Select';

const CHUNK = 100;

const airsIn = (at: number) => {
  const s = at - Date.now() / 1000;
  if (s <= 0) return 'now';
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((s % 3600) / 60)}m`;
};

/** An anime's title page: details, episodes, related and recommended anime. */
export default function AnimeDetail() {
  const { id } = useParams();
  const aid = Number(id);
  const store = useAnimeStore();
  const [a, setA] = useState<AniFull | null>(null);
  usePageTitle(a?.title);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(0);
  const [toast, setToast] = useState('');
  const [showTrailer, setShowTrailer] = useState(false);

  useEffect(() => {
    let live = true;
    setA(null);
    setError(null);
    setRange(0);
    aniFull(aid).then((r) => live && setA(r)).catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [aid]);

  const hist = store.history().find((w) => w.id === aid);
  const seen = new Set(store.seen(aid));
  if (error) return <main className="page pad-top"><Status kind="error" text={error} /></main>;
  if (!a) return <DetailSkeleton />;

  const avail = availableEpisodes(a);
  const total = Math.max(a.episodes ?? 0, avail);
  const inList = store.list().some((x) => x.id === a.id);
  const loved = store.loved().some((x) => x.id === a.id);
  const playTo = `/anime/watch/${a.id}?e=${hist?.episode ?? 1}&p=${hist?.server ?? 1}&l=${hist?.lang ?? 'sub'}`;
  const nums = Array.from({ length: Math.min(total, avail || total) }, (_, i) => i + 1);
  const start = range * CHUNK;
  const shown = nums.slice(start, start + CHUNK);
  const ranges = Math.ceil(nums.length / CHUNK);
  const epLink = (n: number) => `/anime/watch/${a.id}?e=${n}&p=${hist?.server ?? 1}&l=${hist?.lang ?? 'sub'}`;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: a.title, url });
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
        {(a.banner || a.cover) && <div className="td-bg"><img src={a.banner || a.cover} alt="" /></div>}
        <div className="container td-in">
          <div className="td-side">
            <img className="td-poster" src={a.cover} alt={a.title} />
            <div className="td-btns">
              {avail > 0 ? (
                <Link className="btn primary" to={playTo}><Icon name="play" size={16} fill />{hist ? `Resume EP ${hist.episode}` : 'Watch now'}</Link>
              ) : (
                <button className="btn ghost" disabled>{a.status === 'NOT_YET_RELEASED' ? 'Not released yet' : 'No episodes yet'}</button>
              )}
              <div className="td-row2">
                <button className="btn ghost" onClick={() => store.toggle('list', a)}><Icon name={inList ? 'check' : 'bookmark'} size={16} />Watchlist</button>
                <button className="btn ghost" aria-pressed={loved} onClick={() => store.toggle('loved', a)}><Icon name="heart" size={16} fill={loved} />{loved ? 'Favorite' : 'Add Favorite'}</button>
              </div>
              {a.trailer && <button className="btn ghost" onClick={() => setShowTrailer(true)}><Icon name="play" size={16} />Trailer</button>}
              <button className="btn ghost" onClick={() => void share()}><Icon name="share" size={16} />Share</button>
              {toast && <p className="muted small" role="status">{toast}</p>}
            </div>
          </div>
          <div className="td-info">
            <div className="td-chips">
              {a.score > 0 && <span className="chip rate"><Icon name="star" size={14} fill />{(a.score / 10).toFixed(1)}</span>}
              {a.status && <span className={`chip stat ${a.status === 'FINISHED' || a.status === 'RELEASING' ? 'ok' : ''}`}>{STATUS_LABEL[a.status] ?? a.status}</span>}
              {a.year && <span className="chip"><Icon name="calendar" size={14} />{a.year}</span>}
              {a.format && <span className="chip">{FORMAT_LABEL[a.format] ?? a.format}</span>}
              {a.duration && <span className="chip"><Icon name="clock" size={14} />{a.duration} min</span>}
            </div>
            <h1>{a.title}</h1>
            {a.alt && <p className="tagline">{a.alt}</p>}
            <AnimeSeasons id={a.id} />
            {a.genres.length > 0 && <p className="genres">{a.genres.map((g) => <Link key={g} to={`/anime/explore?genre=${encodeURIComponent(g)}`}>{g}</Link>)}</p>}
            <h3>Overview</h3>
            <p className="overview" style={{ marginTop: 0 }}>{a.desc || 'No description available.'}</p>
            <div className="tstats">
              <div><small>Episodes</small><strong>{a.episodes ?? (avail || '—')}</strong></div>
              <div><small>Aired so far</small><strong>{avail || '—'}</strong></div>
              <div><small>Studio</small><strong>{a.studioId ? <Link className="link" to={`/anime/studio/${a.studioId}`}>{a.studio}</Link> : a.studio || '—'}</strong></div>
              <div><small>Next episode</small><strong>{a.next ? `EP ${a.next.episode} in ${airsIn(a.next.at)}` : '—'}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <AnimeCast id={a.id} />
        <div className="season-head">
          <h2 className="section">Episodes</h2>
          {ranges > 1 && (
            <Select className="field select" value={range} onChange={(e) => setRange(Number(e.target.value))} aria-label="Episode range">
              {Array.from({ length: ranges }, (_, i) => (
                <option key={i} value={i}>{i * CHUNK + 1} – {Math.min((i + 1) * CHUNK, nums.length)}</option>
              ))}
            </Select>
          )}
        </div>
        {nums.length === 0 ? (
          <Status kind="empty" text={a.status === 'NOT_YET_RELEASED' ? 'This anime has not started airing yet.' : 'No episodes available.'} />
        ) : (
          <div className="aep-grid">
            {shown.map((n) => {
              const p = animeStore.pos(a.id, n);
              const done = seen.has(n);
              return (
                <Link key={n} to={epLink(n)} className={`aep ${done ? 'seen' : ''} ${hist?.episode === n ? 'now' : ''}`}>
                  <WatchedTick on={done} onToggle={() => store.setSeen(a.id, n, !done)} />
                  <b>EP {n}</b>
                  <small>{p && !done && p.t > 5 ? `Left at ${clock(p.t)}` : done ? 'Watched' : ' '}</small>
                </Link>
              );
            })}
          </div>
        )}

        {a.related.length > 0 && (
          <Row title="Related">
            {a.related.map((r) => <AnimeCard key={r.item.id} a={r.item} tag={r.relation.toUpperCase()} />)}
          </Row>
        )}
        <AniRow title="You might also like" items={a.recs} />
      </div>
      {showTrailer && a.trailer && <TrailerModal videoKey={a.trailer} title={a.title} onClose={() => setShowTrailer(false)} />}
    </main>
  );
}
