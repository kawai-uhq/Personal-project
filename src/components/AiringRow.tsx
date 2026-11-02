import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { Row } from './Rows';
import { animeWeek, startOfDay, tvWeek } from '../lib/schedule';
import type { Airing } from '../lib/schedule';
import { toPublic as P } from '../lib/site';

const DAY = 86400000;

const dayLabel = (t: number) => {
  const d = startOfDay(t);
  const today = startOfDay(Date.now());
  if (d === today) return 'Today';
  if (d === today + DAY) return 'Tomorrow';
  return new Date(t).toLocaleDateString([], { weekday: 'short' });
};

/** Home page: episodes airing this week (shows in the viewer's list first), loaded when the row comes near. */
export default function AiringRow({ kind }: { kind: 'tv' | 'anime' }) {
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [items, setItems] = useState<Airing[]>([]);

  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') return setNear(true);
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (setNear(true), io.disconnect()), { rootMargin: '300px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    let live = true;
    (kind === 'anime' ? animeWeek() : tvWeek())
      .then((all) => {
        if (!live) return;
        const now = Date.now();
        // still to come (or out in the last 12 hours), the viewer's own shows first
        const soon = all.filter((x) => x.at > now - 12 * 3600000).sort((a, b) => Number(b.mine) - Number(a.mine) || a.at - b.at);
        setItems(soon.slice(0, 20));
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [near, kind]);

  return (
    <div ref={host} style={near ? undefined : { minHeight: 120 }}>
      {items.length > 0 && (
        <Row title="Airing this week" to={P(kind === 'anime' ? '/anime/schedule' : '/schedule')}>
          {items.map((x) => (
            <Link key={x.key} to={P(x.to)} className={`air-card ${x.mine ? 'mine' : ''}`}>
              {x.image ? <img src={x.image} alt="" loading="lazy" /> : <span className="air-ph"><Icon name="tv" size={18} /></span>}
              <span className="air-txt">
                <small className="air-when">
                  {dayLabel(x.at)}
                  {x.timeKnown ? ` · ${new Date(x.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
                  {x.aired && <em>Out</em>}
                </small>
                <b>{x.title}</b>
                <small>{x.label}</small>
              </span>
              {x.mine && <span className="air-mine" title="In your list or history"><Icon name="bookmark" size={13} /></span>}
            </Link>
          ))}
        </Row>
      )}
    </div>
  );
}
