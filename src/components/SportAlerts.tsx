import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { LEAD_MS, dropSportReminder, useSportReminders } from '../lib/sportsReminders';
import type { SportReminder } from '../lib/sportsReminders';

/** Site-wide: when a match the viewer asked to be reminded about is about to start, show a bar with a
 *  "Watch now" button (and a system notification if they allowed those). */
export default function SportAlerts() {
  const list = useSportReminders();
  const [now, setNow] = useState(Date.now());
  const [shown, setShown] = useState<SportReminder | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 20000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (shown) return;
    const due = list.find((r) => r.start - now <= LEAD_MS);
    if (!due) return;
    setShown(due);
    dropSportReminder(due.id); // announced once
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
        const n = new Notification(`${due.name} is starting`, { body: 'Tap to watch it live.', tag: `sport-${due.id}` });
        n.onclick = () => {
          window.focus();
          window.location.href = `/sports?e=${encodeURIComponent(due.id)}`;
        };
      }
    } catch {
      /* notifications not available */
    }
  }, [list, now, shown]);

  if (!shown) return null;
  const started = shown.start <= now;
  return (
    <div className="sport-alert" role="status">
      <span className="sport-alert-ic"><Icon name="bell" size={18} /></span>
      <span className="sport-alert-txt">
        <b>{shown.name}</b>
        <small>{started ? 'Live now' : 'Starting in a moment'} · {shown.category}</small>
      </span>
      <Link className="btn small primary" to={`/sports?e=${encodeURIComponent(shown.id)}`} onClick={() => setShown(null)}>
        <Icon name="play" size={13} fill />Watch
      </Link>
      <button className="sport-alert-x" onClick={() => setShown(null)} aria-label="Dismiss"><Icon name="x" size={16} /></button>
    </div>
  );
}
