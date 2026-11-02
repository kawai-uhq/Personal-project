import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('turnstile'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Cloudflare's "Verify you are human" box. Calls onToken with a one-use token once ticked ('' when it expires
 *  or fails). Change `resetKey` to get a fresh box (each token works for one sign-in attempt only). */
export default function Turnstile({ siteKey, onToken, resetKey, onLoadError }: { siteKey: string; onToken: (t: string) => void; resetKey: number; onLoadError?: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useEffect(() => {
    let live = true;
    loadScript()
      .then(() => {
        if (!live || !box.current || !window.turnstile) return;
        id.current = window.turnstile.render(box.current, {
          sitekey: siteKey,
          theme: 'dark',
          size: 'flexible',
          callback: (t: string) => cb.current(t),
          'expired-callback': () => cb.current(''),
          'error-callback': () => cb.current('')
        });
      })
      .catch(() => live && onLoadError?.());
    return () => {
      live = false;
      if (id.current && window.turnstile) window.turnstile.remove(id.current);
      id.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  // a fresh box after every attempt
  useEffect(() => {
    if (resetKey && id.current && window.turnstile) {
      cb.current('');
      window.turnstile.reset(id.current);
    }
  }, [resetKey]);

  return <div ref={box} className="turnstile" />;
}
