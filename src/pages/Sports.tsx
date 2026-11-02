import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConsentGate from '../components/ConsentGate';
import Icon from '../components/Icon';
import { Status } from '../components/Rows';
import { usePageTitle } from '../lib/title';
import { loadSports, stateOf } from '../lib/sports';
import { toggleSportReminder, useSportReminders } from '../lib/sportsReminders';
import type { SportEvent, SportState } from '../lib/sports';

const ORDER: Record<SportState, number> = { live: 0, soon: 1, later: 2, ended: 3 };

const when = (e: SportEvent, s: SportState, now: number) => {
  if (s === 'live') return e.alwaysLive ? '24/7' : 'Live now';
  const mins = Math.round((e.start - now) / 60000);
  if (s === 'soon') return mins <= 1 ? 'Starting now' : `In ${mins} min`;
  const d = new Date(e.start);
  const today = new Date(now).toDateString() === d.toDateString();
  const tomorrow = new Date(now + 86400000).toDateString() === d.toDateString();
  const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (today) return `Today ${t}`;
  if (tomorrow) return `Tomorrow ${t}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} ${t}`;
};

/** Live and upcoming sports events (schedule from ppv.st). Same layout as the Live TV page. */
export default function Sports() {
  const [sp, setSp] = useSearchParams();
  const [all, setAll] = useState<SportEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [q, setQ] = useState('');
  const listTop = useRef<HTMLDivElement>(null);
  const cat = sp.get('c') ?? 'all';
  const playing = sp.get('e');

  const load = (quiet = false) => {
    if (!quiet) {
      setError(null);
      setAll(null);
    }
    loadSports()
      .then((r) => {
        setAll(r);
        setError(null);
      })
      .catch((e: Error) => !quiet && setError(e.message));
  };
  useEffect(() => {
    load();
    // events start and end all day: refresh the schedule quietly every minute
    const r = window.setInterval(() => load(true), 60000);
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.clearInterval(r);
      window.clearInterval(t);
    };
  }, []);

  const reminders = useSportReminders();
  const reminded = new Set(reminders.map((r) => r.id));
  const current = all?.find((e) => e.id === playing) ?? null;
  usePageTitle(current ? `${current.name} · Live` : 'Live Sports');

  const upcoming = useMemo(() => (all ?? []).filter((e) => stateOf(e, now) !== 'ended'), [all, now]);
  // matches (games, fights, races with a start time) are kept apart from 24/7 channels
  const matches = useMemo(() => upcoming.filter((e) => !e.alwaysLive), [upcoming]);
  const channels = useMemo(() => upcoming.filter((e) => e.alwaysLive), [upcoming]);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    matches.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [matches]);
  const liveCount = matches.filter((e) => stateOf(e, now) === 'live').length;
  // "Matches" falls back to the channels when the schedule has no matches at all
  const view = cat === 'all' && matches.length === 0 ? 'channels' : cat;
  const pool = view === 'channels' ? channels : matches;

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return pool
      .filter((e) => (view === 'live' ? stateOf(e, now) === 'live' : view === 'all' || view === 'channels' ? true : e.category === view))
      .filter((e) => !words || `${e.name} ${e.tag} ${e.category}`.toLowerCase().includes(words))
      .sort((a, b) => {
        const sa = stateOf(a, now);
        const sb = stateOf(b, now);
        if (sa !== sb) return ORDER[sa] - ORDER[sb];
        if (a.alwaysLive !== b.alwaysLive) return a.alwaysLive ? 1 : -1; // real events before 24/7 channels
        return (a.start || 0) - (b.start || 0);
      });
  }, [pool, view, q, now]);

  const pick = (e: SportEvent) => {
    const n = new URLSearchParams(sp);
    n.set('e', e.id);
    setSp(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const close = () => {
    const n = new URLSearchParams(sp);
    n.delete('e');
    setSp(n);
  };
  const setCat = (c: string) => {
    const n = new URLSearchParams(sp);
    n.set('c', c);
    setSp(n, { replace: true });
  };

  const curState = current ? stateOf(current, now) : null;

  return (
    <main className="page pad-top">
      <div className="container">
        <section className="live-hero">
          <span className="live-badge">LIVE EVENTS</span>
          <h1 className="title">Live Sports &amp; <span className="accent">Events</span></h1>
          <p className="muted">Football, basketball, fights, racing and more, live and upcoming. Streams usually open a few minutes before the start.</p>
          {all && (
            <p className="stats">
              <span><Icon name="live" size={14} />{liveCount} Live now</span>
              <span><Icon name="calendar" size={14} />{matches.length} {matches.length === 1 ? 'Match' : 'Matches'}</span>
              {channels.length > 0 && <span><Icon name="tv" size={14} />{channels.length} {channels.length === 1 ? 'Channel' : 'Channels'}</span>}
            </p>
          )}
          {all && <button className="btn small ghost live-refresh" onClick={() => load()}><Icon name="refresh" size={14} />Refresh</button>}
        </section>

        {current && curState && (
          <section className="now">
            <div className="now-head">
              <h2 className="section"><span className="live-dot" aria-hidden="true" /> Now streaming: <span className="accent">{current.name}</span></h2>
            </div>
            <div className="live-player">
              <div className="lp-head">
                <span className="lp-logo sp-logo"><Icon name="trophy" size={20} /></span>
                <div className="lp-info">
                  <div className="lp-title">
                    <strong>{current.name}</strong>
                    <span className={`sp-state ${curState}`}>{curState === 'live' && <i />}{when(current, curState, now)}</span>
                  </div>
                  <small>{[current.tag, current.category].filter(Boolean).join(' · ')}</small>
                </div>
                {curState !== 'live' && current.start > 0 && (
                  <button className={`lp-icon ${reminded.has(current.id) ? 'on' : ''}`} onClick={() => toggleSportReminder(current)} aria-pressed={reminded.has(current.id)} aria-label="Remind me when it starts" title={reminded.has(current.id) ? 'Reminder on, tap to cancel' : 'Remind me when it starts'}><Icon name="bell" size={18} /></button>
                )}
                <button className="lp-icon" onClick={() => listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} aria-label="Show the event list" title="Event list"><Icon name="grid" size={18} /></button>
                <a className="lp-icon" href={current.page} target="_blank" rel="noopener noreferrer" aria-label="Open the stream in a new tab" title="Not loading? Open the stream in a new tab"><Icon name="link" size={18} /></a>
                <button className="lp-icon" onClick={close} aria-label="Close the player" title="Close"><Icon name="x" size={18} /></button>
              </div>
              <div className="lp-stage">
                <ConsentGate label="Load the player" className="sp-gate">
                  <iframe
                    key={current.embed}
                    className="sp-frame"
                    src={current.embed}
                    title={current.name}
                    allow="autoplay *; fullscreen *; picture-in-picture; encrypted-media *"
                    allowFullScreen
                  />
                </ConsentGate>
              </div>
              {curState !== 'live' && <p className="lp-hint">This hasn't started yet. The stream usually appears a few minutes before the start, so keep this page open.</p>}
            </div>
          </section>
        )}

        {error ? (
          <Status kind="error" text={error} retry={() => load()} />
        ) : !all ? (
          <Status kind="loading" />
        ) : (
          <>
            <div className="live-filters" ref={listTop}>
              <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search teams, leagues or sports…" aria-label="Search events" />
            </div>
            <div className="chips flush" role="tablist" aria-label="Categories">
              <button role="tab" aria-selected={view === 'all'} className={`chip ${view === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>Matches</button>
              <button role="tab" aria-selected={view === 'live'} className={`chip ${view === 'live' ? 'on' : ''}`} onClick={() => setCat('live')}>Live now</button>
              {cats.map(([c]) => (
                <button key={c} role="tab" aria-selected={view === c} className={`chip ${view === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
              ))}
              {channels.length > 0 && (
                <button role="tab" aria-selected={view === 'channels'} className={`chip ${view === 'channels' ? 'on' : ''}`} onClick={() => setCat('channels')}>24/7 Channels</button>
              )}
            </div>
            <p className="muted small">
              {view === 'channels'
                ? `${shown.length} channels that stream all day${cat === 'all' ? ' (no matches are scheduled right now)' : ''}`
                : `Showing ${shown.length} of ${matches.length} matches`}
            </p>

            {shown.length === 0 ? (
              <Status kind="empty" text={view === 'live' ? 'No match is live right now. Check "Matches" for what\'s coming up, or the 24/7 channels.' : 'Nothing matches your search.'} />
            ) : (
              <div className="sp-grid">
                {shown.map((e) => {
                  const s = stateOf(e, now);
                  return (
                    <div key={e.id} className={`sp-card ${e.id === playing ? 'on' : ''}`}>
                      <button className="sp-hit" onClick={() => pick(e)} aria-label={`Watch ${e.name}`} />
                      {(s === 'soon' || s === 'later') && e.start > 0 && (
                        <button
                          className={`sp-bell ${reminded.has(e.id) ? 'on' : ''}`}
                          onClick={() => toggleSportReminder(e)}
                          aria-pressed={reminded.has(e.id)}
                          aria-label={reminded.has(e.id) ? `Cancel the reminder for ${e.name}` : `Remind me when ${e.name} starts`}
                          title={reminded.has(e.id) ? 'Reminder on, tap to cancel' : 'Remind me when it starts'}
                        >
                          <Icon name="bell" size={15} />
                        </button>
                      )}
                      <span className="sp-img">
                        {e.poster ? <img src={e.poster} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(ev) => (ev.currentTarget.style.display = 'none')} /> : <Icon name="trophy" size={34} />}
                        <span className={`sp-state ${s}`}>{s === 'live' && <i />}{when(e, s, now)}</span>
                      </span>
                      <span className="sp-body">
                        <strong>{e.name}</strong>
                        <span className="channel-meta">
                          <small>{e.tag || e.category}</small>
                          <em>{e.category}</em>
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
