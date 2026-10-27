import { useEffect, useState } from 'react';

const KEY = 'comvie.region';
const subs = new Set<() => void>();

const guess = (): string => {
  try {
    const m = (navigator.language || '').match(/-([A-Za-z]{2})$/);
    if (m) return m[1].toUpperCase();
  } catch { /* ignore */ }
  return 'US';
};

export const getRegion = (): string => {
  try {
    return localStorage.getItem(KEY) || guess();
  } catch {
    return guess();
  }
};

export const setRegion = (r: string) => {
  try { localStorage.setItem(KEY, r); } catch { /* ignore */ }
  subs.forEach((f) => f());
};

/** The country whose streaming catalogue is shown; shared by every component that uses it. */
export function useRegion(): [string, (r: string) => void] {
  const [r, set] = useState(getRegion);
  useEffect(() => {
    const f = () => set(getRegion());
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);
  return [r, setRegion];
}
