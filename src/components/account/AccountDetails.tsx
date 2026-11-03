import { useState } from 'react';
import Icon from '../Icon';
import { updateEmail, updatePassword } from '../../lib/auth';
import { useApp } from '../../state';

/** Change password and change email. */
export default function AccountDetails() {
  const { session, getToken } = useApp();
  const [open, setOpen] = useState<'pass' | 'email' | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!session) return null;

  const run = async (job: (token: string) => Promise<void>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in again, then try once more.');
      await job(token);
      setMsg({ ok: true, text: done });
      setPw('');
      setPw2('');
      setEmail('');
      setOpen(null);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
    }
    setBusy(false);
  };

  const savePass = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return setMsg({ ok: false, text: 'Use at least 8 characters.' });
    if (pw !== pw2) return setMsg({ ok: false, text: "The two passwords don't match." });
    void run((t) => updatePassword(t, pw), 'Password changed.');
  };
  const saveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return setMsg({ ok: false, text: 'Enter a valid email address.' });
    if (v === session.email.toLowerCase()) return setMsg({ ok: false, text: "That's already your email." });
    void run((t) => updateEmail(t, v), `Check ${v} (and your current inbox) for a confirmation link. The change happens once you open it.`);
  };

  return (
    <div className="acct-panel">
      <div className="acct-line">
        <div>
          <strong>Email</strong>
          <small className="muted">{session.email}</small>
        </div>
        <button className="btn small ghost" onClick={() => { setOpen(open === 'email' ? null : 'email'); setMsg(null); }}><Icon name="mail" size={14} />Change email</button>
      </div>
      {open === 'email' && (
        <form className="acct-form" onSubmit={saveEmail}>
          <span className="auth-input"><Icon name="mail" size={16} /><input type="email" autoComplete="email" placeholder="New email" value={email} onChange={(e) => setEmail(e.target.value)} /></span>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Send confirmation'}</button>
        </form>
      )}
      <div className="acct-line">
        <div>
          <strong>Password</strong>
          <small className="muted">Signed in with Discord? Set one here to sign in with your email too.</small>
        </div>
        <button className="btn small ghost" onClick={() => { setOpen(open === 'pass' ? null : 'pass'); setMsg(null); }}><Icon name="lock" size={14} />Change password</button>
      </div>
      {open === 'pass' && (
        <form className="acct-form" onSubmit={savePass}>
          <span className="auth-input"><Icon name="lock" size={16} /><input type="password" autoComplete="new-password" placeholder="New password (8+ characters)" value={pw} onChange={(e) => setPw(e.target.value)} /></span>
          <span className="auth-input"><Icon name="lock" size={16} /><input type="password" autoComplete="new-password" placeholder="Type it again" value={pw2} onChange={(e) => setPw2(e.target.value)} /></span>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
        </form>
      )}
      {msg && <p className={`small ${msg.ok ? 'pe-ok' : 'error'}`}>{msg.text}</p>}
    </div>
  );
}
