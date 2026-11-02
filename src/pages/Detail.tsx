import { useAnimeHome } from '../lib/animeLink';
import { useNavigate as useNav2 } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { usePageTitle } from '../lib/title';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import { votesShort } from '../lib/format';
import { DetailSkeleton, PosterRow, Row, Status } from '../components/Rows';
import TrailerModal from '../components/TrailerModal';
import WatchedTick from '../components/WatchedTick';
import { isWatched, setWatched } from '../lib/progress';
import { toggleReminder, useReminders } from '../lib/reminders';
import { IMG, backdropSrc, posterSrc, profileSrc, tmdb } from '../lib/tmdb';
import { mediaKey } from '../lib/types';
import type { CastMember, Details, Episode, Media, MediaType } from '../lib/types';
import { useApp } from '../state';
import Select from '../components/Select';

const fmtDate = (d: string) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function DetailPage() {
  const { type, id } = useParams();
  const t: MediaType = type === 'tv' ? 'tv' : 'movie';
  const mid = Number(id);
  const { isFavorite, toggleFavorite, isLoved, toggleLoved, history } = useApp();

  const rem = useReminders();
  const [wv, setWv] = useState(0);
  const [d, setD] = useState<Details | null>(null);
  usePageTitle(d?.media.title);
  const [error, setError] = useState<string | null>(null);
  const [season, setSeason] = useState(1);
  const [eps, setEps] = useState<Episode[]>([]);
  const [more, setMore] = useState<Media[]>([]);
  const [toast, setToast] = useState('');
  const [trailer, setTrailer] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [directors, setDirectors] = useState<string[]>([]);
  // anime are shown in the anime section: once it's found there, go (the main page stays if it isn't)
  const go2 = useNav2();
  const animeHome = useAnimeHome(d?.media, (aid) => `/anime/title/${aid}`);
  useEffect(() => {
    if (animeHome.to) go2(animeHome.to, { replace: true });
  }, [animeHome.to, go2]);

  useEffect(() => {
    let live = true;
    setD(null);
    setError(null);
    setEps([]);
    setMore([]);
    setTrailer(null);
    setShowTrailer(false);
    setCast([]);
    setDirectors([]);
    const resume = history.find((w) => w.media.id === mid && w.media.type === t);
    setSeason(resume?.season ?? 1);
    tmdb.details(t, mid).then((r) => live && setD(r)).catch((e: Error) => live && setError(e.message));
    tmdb.similar(t, mid).then((r) => live && setMore(r)).catch(() => undefined);
    tmdb.trailer(t, mid).then((k) => live && setTrailer(k)).catch(() => undefined);
    tmdb
      .credits(t, mid)
      .then((c) => {
        if (!live) return;
        setCast(c.cast);
        setDirectors(c.directors);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // history only seeds the starting season
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, mid]);

  useEffect(() => {
    if (t !== 'tv') return;
    let live = true;
    tmdb.episodes(mid, season).then((r) => live && setEps(r)).catch(() => live && setEps([]));
    return () => {
      live = false;
    };
  }, [t, mid, season]);

  if (error) return <main className="page pad-top"><Status kind="error" text={error} /></main>;
  if (!d || animeHome.looking || animeHome.to) return <DetailSkeleton />;

  const m = d.media;
  const resume = history.find((w) => mediaKey(w.media) === mediaKey(m));
  const playTo = `/watch/${m.type}/${m.id}${m.type === 'tv' ? `?s=${resume?.season ?? 1}&e=${resume?.episode ?? 1}` : ''}`;
  const fav = isFavorite(m);
  const love = isLoved(m);
  const y1 = d.firstAir.slice(0, 4) || m.year;
  const y2 = d.lastAir.slice(0, 4);
  const yearRange =
    m.type === 'tv' && y1 ? (d.status === 'Ended' || d.status === 'Canceled' ? (y2 && y2 !== y1 ? `${y1} - ${y2}` : y1) : `${y1} - Present`) : y1;

  const upcoming = !!d.firstAir && d.firstAir > new Date().toISOString().slice(0, 10);
  void wv;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: m.title, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast('Link copied');
        setTimeout(() => setToast(''), 1800);
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <main className="page">
      <section className="td">
        {m.backdrop && <div className="td-bg"><img src={backdropSrc(m.backdrop)} alt="" /></div>}
        <div className="container td-in">
          <div className="td-side">
            {m.poster ? <img className="td-poster" src={posterSrc(m.poster)} alt={m.title} /> : <div className="td-poster" />}
            <div className="td-btns">
              <Link className="btn primary" to={playTo}>
                <Icon name="play" size={16} fill />{resume ? (m.type === 'tv' && resume.season ? `Resume S${resume.season} E${resume.episode}` : 'Resume') : 'Play'}
              </Link>
              {trailer && <button className="btn ghost" onClick={() => setShowTrailer(true)}><Icon name="video" size={16} />Watch Trailer</button>}
              <div className="td-row2">
                <button className="btn ghost" onClick={() => toggleFavorite(m)}><Icon name={fav ? 'check' : 'bookmark'} size={16} />Watchlist</button>
                <button className="btn ghost" aria-pressed={love} onClick={() => toggleLoved(m)}><Icon name="heart" size={16} fill={love} />{love ? 'Favorite' : 'Add Favorite'}</button>
              </div>
              {upcoming && (
                <button className="btn ghost" aria-pressed={rem.has(m)} onClick={() => toggleReminder(m, d.firstAir)}>
                  <Icon name="bell" size={16} fill={rem.has(m)} />{rem.has(m) ? 'Reminder set' : 'Remind me'}
                </button>
              )}
              <button className="btn ghost" onClick={() => void share()}><Icon name="share" size={16} />Share</button>
              {toast && <p className="muted small" role="status">{toast}</p>}
            </div>
          </div>
          <div className="td-info">
            <div className="td-chips">
              {m.rating > 0 && (
                <span className="chip rate"><Icon name="star" size={14} fill />{m.rating.toFixed(1)}{d.votes > 0 && <small>({votesShort(d.votes)})</small>}</span>
              )}
              {d.status && <span className={`chip stat ${d.status === 'Released' || d.status === 'Ended' ? 'ok' : ''}`}>{d.status}</span>}
              <span className="chip"><Icon name="calendar" size={14} />{yearRange}</span>
              {d.runtime > 0 && <span className="chip"><Icon name="clock" size={14} />{d.runtime} min</span>}
            </div>
            <h1>{m.title}</h1>
            {d.tagline && <p className="tagline">“{d.tagline}”</p>}
            {d.genres.length > 0 && <p className="genres">{d.genres.map((g) => <span key={g}>{g}</span>)}</p>}
            <h3>Overview</h3>
            <p className="overview" style={{ marginTop: 0 }}>{m.overview || 'No description available.'}</p>
            {directors.length > 0 && <p className="muted small">Director: {directors.join(', ')}</p>}

            {m.type === 'tv' && (
              <div className="tstats">
                <div><small>Seasons</small><strong>{d.seasons.length}</strong></div>
                <div><small>Total Episodes</small><strong>{d.totalEpisodes || '—'}</strong></div>
                <div><small>First Air Date</small><strong>{fmtDate(d.firstAir)}</strong></div>
                <div><small>Last Air Date</small><strong>{fmtDate(d.lastAir)}</strong></div>
              </div>
            )}
            {d.studios.length > 0 && (
              <>
                <h3>Networks &amp; Studios</h3>
                <div className="studios">{d.studios.map((n) => <span className="chip" key={n}>{n}</span>)}</div>
              </>
            )}
          </div>
        </div>
      </section>

      {m.type === 'tv' && d.seasons.length > 0 && (
        <div className="container">
          <div className="season-head">
            <h2 className="section">Episodes &amp; Seasons</h2>
            <Select className="field select" value={season} onChange={(e) => setSeason(Number(e.target.value))} aria-label="Season">
              {d.seasons.map((s) => (
                <option key={s.number} value={s.number}>{s.name} ({s.episodeCount} episodes)</option>
              ))}
            </Select>
          </div>
          <p className="ep-sub">Select a season to view detailed episode list</p>
          <div className="ep-list">
            {eps.map((e) => (
              <Link key={e.number} className={`ep-row ${isWatched('tv', m.id, season, e.number) ? 'seen' : ''}`} to={`/watch/tv/${m.id}?s=${season}&e=${e.number}`}>
                <span className="ep-img">
                  {e.still ? <img src={IMG.still + e.still} alt="" loading="lazy" /> : null}
                  <span className="ep-tag">E{e.number}</span>
                </span>
                <span>
                  <WatchedTick
                    on={isWatched('tv', m.id, season, e.number)}
                    onToggle={() => {
                      setWatched('tv', m.id, season, e.number, !isWatched('tv', m.id, season, e.number));
                      setWv((n) => n + 1);
                    }}
                  />
                  {e.rating > 0 && <span className="ep-score"><Icon name="star" size={12} fill />{e.rating.toFixed(1)}</span>}
                  <h4>{e.number}. {e.name}</h4>
                  <span className="ep-meta">
                    {e.airDate && <span><Icon name="calendar" size={13} />{e.airDate}</span>}
                    {e.runtime > 0 && <span><Icon name="clock" size={13} />{e.runtime} min</span>}
                  </span>
                  <p>{e.overview || 'No description available.'}</p>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      {cast.length > 0 && (
        <Row title="Cast">
          {cast.map((c) => (
            <Link key={c.id} to={`/person/${c.id}`} className="cast-card">
              <span className="cast-photo">
                {c.photo ? <img src={profileSrc(c.photo)} alt="" loading="lazy" /> : <b>{c.name.slice(0, 1)}</b>}
              </span>
              <strong>{c.name}</strong>
              {c.character && <small>{c.character}</small>}
            </Link>
          ))}
        </Row>
      )}
      <PosterRow title="More Like This" items={more} />
      {showTrailer && trailer && <TrailerModal videoKey={trailer} title={m.title} onClose={() => setShowTrailer(false)} />}
    </main>
  );
}
