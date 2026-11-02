/** "Remind me" for upcoming sports matches: saved on this device, and announced (in the page, plus a system
 *  notification when allowed) when the match is about to start while the site is open. */
import { useEffect, useState } from 'react';
import type { SportEvent } from './sports';

export interface SportReminder {
  id: string;
  name: string;
  start: number;
  category: string;
}

const KEY = 'comvie.sportremind';
const EVT = 'comvie:sportremind';
/** announce a match this long before it starts */
export const LEAD_MS = 2 * 60 * 1000;

function read(): SportReminder[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    // matches that started more than 3 hours ago are dropped
    return Array.isArray(v) ? v.filter((r) => r && r.id && Number(r.start) > Date.now() - 3 * 3600000) : [];
  } catch {
    return [];
  }
}

function write(list: SportReminder[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* storage blocked: reminders last for this visit only */
  }
  window.dispatchEvent(new Event(EVT));
}

export const sportReminders = read;

export function hasSportReminder(id: string) {
  return read().some((r) => r.id === id);
}

/** Turn a reminder on or off. Turning one on also asks (once) for permission to show system notifications. */
export function toggleSportReminder(e: SportEvent) {
  const cur = read();
  if (cur.some((r) => r.id === e.id)) return write(cur.filter((r) => r.id !== e.id));
  write([...cur, { id: e.id, name: e.name, start: e.start, category: e.category }].sort((a, b) => a.start - b.start));
  try {
    if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission();
  } catch {
    /* not supported */
  }
}

export function dropSportReminder(id: string) {
  write(read().filter((r) => r.id !== id));
}

/** The saved reminders, kept in step across components and tabs */
export function useSportReminders(): SportReminder[] {
  const [list, setList] = useState<SportReminder[]>(read);
  useEffect(() => {
    const on = () => setList(read());
    window.addEventListener(EVT, on);
    window.addEventListener('storage', on);
    return () => {
      window.removeEventListener(EVT, on);
      window.removeEventListener('storage', on);
    };
  }, []);
  return list;
}
