import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConsentGate from '../components/ConsentGate';
import Icon from '../components/Icon';
import { Status } from '../components/Rows';
import { usePageTitle } from '../lib/title';
import { loadSports, stateOf } from '../lib/sports';
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

/** Live and upcoming sports events (schedule from ppv.st), with the player at the top of the page. */
export default function Sports() {
  const [sp, setSp] = useSearchParams();
  const [all, setAll] = useState<SportEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [q, setQ] = useState('');
  const cat = sp.get('c') ?? 'live';
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
    // the schedule changes as events start and end: refresh it quietly every minute
    const r = window.setInterval(() => load(true), 60000);
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      window.clearInterval(r);
      window.clearInterval(t);
    };
  }, []);

  const current = all?.find((e) => e.id === playing) ?? null;
  usePageTitle(current ? `${current.name} · Live` : 'Live Sports');

  const live = useMemo(() => (all ?? []).filter((e) => stateOf(e, now) !== 'ended'), [all, now]);
  const cats = useMemo(() => {
    const m = new Map<string, number>();
    live.forEach((e) => m.set(e.category, (m.get(e.category) ?? 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [live]);
  const liveCount = live.filter((e) => stateOf(e, now) === 'live').length;

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase();
    return live
      .filter((e) => (cat === 'live' ? stateOf(e, now) === 'live' : cat === 'all' ? true : e.category === cat))
      .filter((e) => !words || `${e.name} ${e.tag} ${e.category}`.toLowerCase().includes(words))
      .sort((a, b) => {
        const sa = stateOf(a, now);
        const sb = stateOf(b, now);
        if (sa !== sb) return ORDER[sa] - ORDER[sb];
        if (a.alwaysLive !== b.alwaysLive) return a.alwaysLive ? 1 : -1; // real events before 24/7 channels
        return (a.start || 0) - (b.start || 0);
      });
  }, [live, cat, q, now]);

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

  return (
    <div className="container pad-top sp">
      {current ? (
        <section className="sp-player">
          <div className="sp-ph">
            <div>
              <span className={`sp-state ${stateOf(current, now)}`}>{when(current, stateOf(current, now), now)}</span>
              <h1>{current.name}</h1>
              <small>{[current.tag, current.category].filter(Boolean).join(' · ')}</small>
            </div>
            <button className="btn small ghost" onClick={close}><Icon name="x" size={15} />Close</button>
          </div>
          <ConsentGate label="Load the player" className="wp-frame" onOpen={() => undefined}>
            <iframe
              key={current.embed}
              className="wp-frame"
              src={current.embed}
              title={current.name}
              allow="autoplay *; fullscreen *; picture-in-picture; encrypted-media *"
              allowFullScreen
            />
          </ConsentGate>
          {stateOf(current, now) !== 'live' && (
            <p className="sp-note">This hasn't started yet. The stream usually appears a few minutes before kick-off. Keep this page open.</p>
          )}
        </section>
      ) : (
        <section className="live-hero">
          <span className="live-badge"><span className="live-dot" />LIVE SPORTS</span>
          <h1 className="title">Sports</h1>
          <p className="muted">Football, basketball, fights, racing and more, live and upcoming. Pick an event to watch it here.</p>
        </section>
      )}

      <div className="sp-bar">
        <div className="sp-chips" role="tablist" aria-label="Category">
          <button role="tab" aria-selected={cat === 'live'} className={`chip ${cat === 'live' ? 'on' : ''}`} onClick={() => setCat('live')}>
            <span className="live-dot" />Live now{all && ` · ${liveCount}`}
          </button>
          <button role="tab" aria-selected={cat === 'all'} className={`chip ${cat === 'all' ? 'on' : ''}`} onClick={() => setCat('all')}>All{all && ` · ${live.length}`}</button>
          {cats.map(([c, n]) => (
            <button key={c} role="tab" aria-selected={cat === c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c} · {n}</button>
          ))}
        </div>
        <input className="field sp-search" type="search" placeholder="Search teams, leagues…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
      </div>

      {error ? (
        <Status kind="error" text={error} retry={() => load()} />
      ) : !all ? (
        <Status kind="loading" />
      ) : shown.length === 0 ? (
        <Status kind="empty" text={cat === 'live' ? 'Nothing is live right now. Check "All" for upcoming events.' : 'No events match.'} />
      ) : (
        <div className="sp-grid">
          {shown.map((e) => {
            const s = stateOf(e, now);
            return (
              <button key={e.id} className={`sp-card ${e.id === playing ? 'now' : ''}`} onClick={() => pick(e)}>
                <span className="sp-img">
                  {e.poster ? <img src={e.poster} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(ev) => (ev.currentTarget.style.display = 'none')} /> : null}
                  <span className="sp-cat"><Icon name="trophy" size={14} />{e.category}</span>
                  <span className={`sp-state ${s}`}>{s === 'live' && <i />}{when(e, s, now)}</span>
                </span>
                <span className="sp-body">
                  <b>{e.name}</b>
                  {e.tag && <small>{e.tag}</small>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
