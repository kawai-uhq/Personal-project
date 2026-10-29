import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { FORMAT_LABEL, STATUS_LABEL } from '../lib/anilist';
import type { Ani } from '../lib/anilist';

/** Rotating billboard for anime (banner art when AniList has it). */
export default function AnimeBillboard({ items, onActive }: { items: Ani[]; onActive?: (index: number) => void }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = items.length;
  useEffect(() => {
    onActive?.(i);
  }, [i, onActive]);
  useEffect(() => {
    if (n < 2 || paused) return;
    const t = window.setTimeout(() => setI((x) => (x + 1) % n), 7000);
    return () => window.clearTimeout(t);
  }, [i, n, paused]);
  if (!n) return null;
  return (
    <section className={`abb ${paused ? 'paused' : ''}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {items.map((a, k) => (
        <div key={a.id} className={`abb-slide ${k === i ? 'on' : ''}`} aria-hidden={k !== i}>
          <img src={a.banner || a.cover} alt="" className={a.banner ? '' : 'abb-cover'} loading={k === 0 ? 'eager' : 'lazy'} />
          <div className="abb-shade" />
          <div className="abb-body">
            <div className="td-chips">
              {a.score > 0 && <span className="chip rate"><Icon name="star" size={14} fill />{(a.score / 10).toFixed(1)}</span>}
              {a.year && <span className="chip"><Icon name="calendar" size={14} />{a.year}</span>}
              {a.format && <span className="chip">{FORMAT_LABEL[a.format] ?? a.format}</span>}
              {a.status && <span className="chip stat ok">{STATUS_LABEL[a.status] ?? a.status}</span>}
            </div>
            <h1>{a.title}</h1>
            <p className="abb-genres">{a.genres.slice(0, 4).join(' · ')}</p>
            <p className="abb-desc">{a.desc}</p>
            <div className="abb-btns">
              <Link to={`/anime/watch/${a.id}?e=1`} className="btn primary"><Icon name="play" size={16} fill />Watch now</Link>
              <Link to={`/anime/title/${a.id}`} className="btn ghost"><Icon name="info" size={16} />Details</Link>
            </div>
          </div>
        </div>
      ))}
      {n > 1 && (
        <div className="dots" role="tablist" aria-label="Choose a featured anime">
          <button className="dot-arrow prev" aria-label="Previous anime" onClick={() => setI((x) => (x - 1 + n) % n)}>
            <Icon name="chevronLeft" size={16} />
          </button>
          {items.map((a, k) => (
            <button key={a.id} role="tab" aria-selected={k === i} aria-label={`Show ${a.title}`} className={`dot ${k === i ? 'on' : ''}`} onClick={() => setI(k)}>
              {k === i && (
                <svg key={i} className="dot-ring" viewBox="0 0 28 28" aria-hidden="true">
                  <circle className="trk" cx="14" cy="14" r="11" />
                  <circle className="arc" cx="14" cy="14" r="11" />
                </svg>
              )}
            </button>
          ))}
          <button className="dot-arrow next" aria-label="Next anime" onClick={() => setI((x) => (x + 1) % n)}>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
