import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import Turnstile from '../Turnstile';
import { sendCode, turnstileSiteKey } from '../../lib/auth';
import { useApp } from '../../state';

interface Device {
  id: string;
  browser: string;
  os: string;
  kind: string;
  place: string;
  firstSeen: string;
  lastSeen: string;
  current: boolean;
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!isFinite(m)) return '';
  if (m < 60) return 'active now';
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

/** The account's signed-in devices with sign-out, protected by a code sent to the account's email. */
export default function Devices() {
  const { session, getToken } = useApp();
  const [list, setList] = useState<Device[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<string | null>(null); // a session id or 'others'
  const [step, setStep] = useState<'send' | 'code'>('send');
  const [captcha, setCaptcha] = useState('');
  const [round, setRound] = useState(0);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const token = await tokenRef.current();
      const r = await fetch('/api/account?action=devices', { headers: { Authorization: `Bearer ${token ?? ''}` } });
      if (!r.ok) throw new Error(String(r.status));
      setList(((await r.json()).devices ?? []) as Device[]);
    } catch (e) {
      console.error('[devices] list', e);
      setFailed(true);
    }
  }, []);
  useEffect(() => void load(), [load, session?.email]);

  if (!session) return null;
  const others = (list ?? []).filter((d) => !d.current);

  const start = (t: string) => {
    setTarget(t);
    setStep('send');
    setCode('');
    setMsg(null);
    setRound((n) => n + 1);
  };
  const send = async () => {
    if (turnstileSiteKey && !captcha) return setMsg({ ok: false, text: 'Tick "Verify you are human" first.' });
    setBusy(true);
    setMsg(null);
    try {
      await sendCode(session.email, captcha || undefined);
      setStep('code');
      setMsg({ ok: true, text: `We emailed a code to ${session.email}.` });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't send the code. Try again." });
      setRound((n) => n + 1);
      setCaptcha('');
    }
    setBusy(false);
  };
  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const token = await getToken();
      const r = await fetch('/api/account', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token ?? ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signout', target, code })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.');
      setTarget(null);
      setMsg({ ok: true, text: target === 'others' ? 'Signed out of all other devices.' : 'That device was signed out.' });
      void load();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong. Try again.' });
    }
    setBusy(false);
  };

  const label = (d: Device) => `${d.browser}${d.os ? ` on ${d.os}` : ''}`;
  const which = target === 'others' ? 'all other devices' : label(list?.find((d) => d.id === target) ?? ({ browser: 'that device', os: '' } as Device));

  return (
    <div className="acct-panel">
      {failed && <p className="muted small">Couldn't load your devices right now. <button className="link" onClick={() => void load()}>Try again</button></p>}
      {!list && !failed && <p className="muted small">Loading devices…</p>}
      {list && list.length === 0 && <p className="muted small">This device will show here shortly.</p>}
      {list?.map((d) => (
        <div key={d.id} className="acct-line dev">
          <span className="dev-ico"><Icon name={d.kind === 'phone' || d.kind === 'tablet' ? 'video' : 'tv'} size={18} /></span>
          <div>
            <strong>{label(d)} {d.current && <span className="acct-badge sm">This device</span>}</strong>
            <small className="muted">{[d.place || 'Unknown place', ago(d.lastSeen)].filter(Boolean).join(' · ')}</small>
          </div>
          {!d.current && <button className="btn small ghost danger" disabled={busy} onClick={() => start(d.id)}>Sign out</button>}
        </div>
      ))}
      {others.length > 1 && !target && (
        <button className="btn ghost danger" onClick={() => start('others')}><Icon name="login" size={16} />Sign out of all other devices</button>
      )}

      {target && (
        <div className="dev-confirm">
          <p className="small">To sign out of <strong>{which}</strong>, confirm with a code sent to your email.</p>
          {step === 'send' ? (
            <>
              {turnstileSiteKey && <Turnstile siteKey={turnstileSiteKey} resetKey={round} onToken={setCaptcha} />}
              <div className="pe-row">
                <button className="btn primary" disabled={busy} onClick={() => void send()}>{busy ? 'Sending…' : 'Email me a code'}</button>
                <button className="btn ghost" onClick={() => setTarget(null)}>Cancel</button>
              </div>
            </>
          ) : (
            <form className="pe-row" onSubmit={confirm}>
              <span className="auth-input"><Icon name="lock" size={16} /><input inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="Code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></span>
              <button className="btn primary" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign out'}</button>
              <button type="button" className="btn ghost" onClick={() => setTarget(null)}>Cancel</button>
            </form>
          )}
        </div>
      )}
      {msg && <p className={`small ${msg.ok ? 'pe-ok' : 'error'}`}>{msg.text}</p>}
      <p className="muted small">A signed-out device stops working within about an hour. Places are approximate.</p>
    </div>
  );
}
