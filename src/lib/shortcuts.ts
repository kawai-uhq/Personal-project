import { useEffect, useRef } from 'react';

/** Single-key shortcuts on a page (n, p, s, r…). Ignored while typing, with modifier keys held, or when the key
 *  press goes to the video player itself (a player frame keeps keys while it has focus). */
export function useShortcuts(map: Record<string, (() => void) | null | undefined>) {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || t.closest('input, textarea, select'))) return;
      const run = ref.current[e.key.toLowerCase()];
      if (!run) return;
      e.preventDefault();
      run();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);
}
