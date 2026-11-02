import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { Status } from '../components/Rows';
import { animeWeek, startOfDay, tvWeek } from '../lib/schedule';
import type { Airing } from '../lib/schedule';
import { toPublic as P } from '../lib/site';
import { usePageTitle } from '../lib/title';

const DAY = 86400000;
const ONLY_KEY = 'comvie.schedule.mine';

/** "Airing this week": a tab per day (today + 6), the episodes airing that day, and an "Only my list" switch. */
export default function Schedule({ kind }: { kind: 'tv' | 'anime' }) {
  usePageTitle(kind === 'anime' ? 'Anime schedule' : 'TV schedule');
  const [items, setItems] = useState<Airing[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = startOfDay(Date.now());
  const [day, setDay] = useState(today);
  const [mineOnly, setMineOnly] = useState(() => {
    try { return localStorage.getItem(ONLY_KEY) === '1'; } catch { return false; }
  });

  const load = () => {
    setError(null);
    setItems(null);
    (kind === 'anime' ? animeWeek() : tvWeek())
      .then(setItems)
      .catch(() => setError("Couldn't load the schedule right now. Try again in a minute."));
  };
  useEffect(load, [kind]);

  const toggleMine = () =>
    setMineOnly((v) => {
      try { localStorage.setItem(ONLY_KEY, v ? '0' : '1'); } catch { /* storage blocked */ }
      return !v;
    });

  const pool = useMemo(() => (items ?? []).filter((x) => !mineOnly || x.mine), [items, mineOnly]);
  const days = Array.from({ length: 7 }, (_, i) => today + i * DAY);
  const countOn = (d: number) => pool.filter((x) => startOfDay(x.at) === d).length;
  const list = pool.filter((x) => startOfDay(x.at) === day);
  const mineCount = (items ?? []).filter((x) => x.mine).length;

  const dayName = (d: number, i: number) => (i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(d).toLocaleDateString([], { weekday: 'short' }));

  return (
    <main className="page pad-top">
      <div className="container">
        <div className="page-head">
          <div>
            <h1 className="title">Airing <span className="accent">this week</span></h1>
            <p className="muted">
              {kind === 'anime' ? 'New anime episodes, in your local time.' : 'New episodes of shows on air, and of the shows in your watchlist and history.'}
            </p>
          </div>
        </div>

        <div className="sch-bar">
          <div className="sch-days" role="tablist" aria-label="Day">
            {days.map((d, i) => (
              <button key={d} role="tab" aria-selected={day === d} className={`sch-day ${day === d ? 'on' : ''}`} onClick={() => setDay(d)}>
                <b>{dayName(d, i)}</b>
                <small>{new Date(d).toLocaleDateString([], { day: 'numeric', month: 'short' })}{items ? ` · ${countOn(d)}` : ''}</small>
              </button>
            ))}
          </div>
          <button type="button" className={`ep-skipf ${mineOnly ? 'on' : ''}`} role="switch" aria-checked={mineOnly} onClick={toggleMine}>
            <i aria-hidden="true" />Only my list{items ? ` (${mineCount})` : ''}
          </button>
        </div>

        {error ? (
          <Status kind="error" text={error} retry={load} />
        ) : !items ? (
          <Status kind="loading" />
        ) : list.length === 0 ? (
          <Status
            kind="empty"
            text={mineOnly ? (mineCount ? 'Nothing from your list airs this day.' : `Nothing from your list airs this week. Add ${kind === 'anime' ? 'anime' : 'shows'} to your watchlist to see them here.`) : 'Nothing airs this day.'}
          />
        ) : (
          <div className="sch-list">
            {list.map((x) => (
              <Link key={x.key} to={P(x.to)} className={`sch-item ${x.aired ? 'aired' : ''}`}>
                <span className="sch-time">
                  {x.timeKnown ? new Date(x.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'All day'}
                  {x.aired && <em>Out</em>}
                </span>
                {x.image ? <img src={x.image} alt="" loading="lazy" /> : <span className="sch-ph"><Icon name="tv" size={18} /></span>}
                <span className="sch-txt">
                  <b>{x.title}</b>
                  <small>{x.label}{x.name ? ` · ${x.name}` : ''}</small>
                </span>
                {x.mine && <span className="sch-mine" title="In your list or history"><Icon name="bookmark" size={14} /></span>}
                <Icon name="chevronRight" size={16} />
              </Link>
            ))}
          </div>
        )}

        {kind === 'tv' && <p className="muted small sch-foot">TV schedules give a day but not a time, so episodes show as "All day".</p>}
      </div>
    </main>
  );
}
