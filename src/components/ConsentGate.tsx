import { useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';
import { mediaAllowed, openConsent, useConsent } from '../lib/consent';

/**
 * Wraps a third-party player / trailer. With "Essential only" chosen, shows a tap-to-load card instead,
 * so nothing from the other site loads (or sets cookies) until you ask for it.
 */
export default function ConsentGate({ children, label, className, compact, onOpen }: { children: ReactNode; label: string; className?: string; compact?: boolean; onOpen?: () => void }) {
  const consent = useConsent();
  const [once, setOnce] = useState(false);
  if (mediaAllowed(consent) || once) return <>{children}</>;
  if (compact) return null;
  return (
    <div className={`gate ${className ?? ''}`}>
      <Icon name="play" size={28} fill />
      <strong>{label}</strong>
      <p>This loads from another site, which may set its own cookies.</p>
      <div className="gate-btns">
        <button className="btn primary" onClick={() => { setOnce(true); onOpen?.(); }}><Icon name="play" size={15} fill />Load</button>
        <button className="btn ghost" onClick={openConsent}>Cookie settings</button>
      </div>
    </div>
  );
}
