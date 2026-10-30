import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';

/** A yes/no question in the site's own style (instead of the browser's "cinema.comvie.lol says" box). */
export interface Ask {
  title: string;
  text?: string;
  ok?: string; // confirm button label
  cancel?: string;
  danger?: boolean;
  icon?: IconName;
}

type Pending = Ask & { resolve: (yes: boolean) => void };
let show: ((p: Pending) => void) | null = null;

/** Ask the visitor to confirm something. Resolves true for the confirm button, false otherwise. */
export function askConfirm(a: Ask): Promise<boolean> {
  return new Promise((resolve) => {
    if (show) show({ ...a, resolve });
    else resolve(window.confirm(a.text ? `${a.title}\n\n${a.text}` : a.title)); // fallback before the app has mounted
  });
}

/** Mount once (in App). */
export default function ConfirmHost() {
  const [p, setP] = useState<Pending | null>(null);
  const okBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    show = setP;
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!p) return;
    okBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') answer(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p]);

  const answer = (yes: boolean) => {
    if (!p) return;
    p.resolve(yes);
    setP(null);
  };

  if (!p) return null;
  return (
    <div className="modal-back blur" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
      <div className="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className={`confirm-icon ${p.danger ? 'danger' : ''}`} aria-hidden="true"><Icon name={p.icon ?? (p.danger ? 'trash' : 'check')} size={22} /></div>
        <h2 id="confirm-title">{p.title}</h2>
        {p.text && <p className="muted">{p.text}</p>}
        <div className="confirm-btns">
          <button className="btn ghost" onClick={() => answer(false)}>{p.cancel ?? 'Cancel'}</button>
          <button ref={okBtn} className={`btn ${p.danger ? 'danger-fill' : 'primary'}`} onClick={() => answer(true)}>{p.ok ?? 'OK'}</button>
        </div>
      </div>
    </div>
  );
}
