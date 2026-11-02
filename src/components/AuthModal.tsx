import { useEffect, useState } from 'react';
import { AuthError, signInComingSoon, signInPassword, signUpPassword, turnstileSiteKey } from '../lib/auth';
import { useApp } from '../state';
import Icon from './Icon';
import Turnstile from './Turnstile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sign in / create an account with email and password, behind Cloudflare's "Verify you are human" box. */
export default function AuthModal() {
  const { authOpen, closeAuth, onSignedIn } = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Cloudflare check: a one-use token, and a counter that asks the box for a fresh check after each attempt
  const [captcha, setCaptcha] = useState('');
  const [captchaRound, setCaptchaRound] = useState(0);
  const [captchaBroken, setCaptchaBroken] = useState(false);
  const needCaptcha = !!turnstileSiteKey;

  useEffect(() => {
    if (!authOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && closeAuth();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOpen, busy, closeAuth]);

  if (!authOpen) return null;

  const done = (s: Parameters<typeof onSignedIn>[0]) => {
    setPassword('');
    setInfo(null);
    onSignedIn(s);
  };

  const submit = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (needCaptcha && !captcha) return setError(captchaBroken ? "The verification check couldn't load. Turn off any blocker for this site and reload." : 'Tick "Verify you are human" first.');
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'in') {
        done(await signInPassword(clean, password, captcha || undefined));
      } else {
        const s = await signUpPassword(clean, password, username.trim(), captcha || undefined);
        if (s) done(s);
        else {
          // Supabase wants the email confirmed first (its "Confirm email" setting is on)
          setMode('in');
          setEmail(clean);
          setPassword('');
          setInfo(`Account created. Open the link in the email we sent to ${clean} to confirm it, then sign in here. Check spam if you don't see it.`);
        }
      }
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    }
    // each check works for one attempt only
    if (needCaptcha) {
      setCaptcha('');
      setCaptchaRound((n) => n + 1);
    }
    setBusy(false);
  };

  const switchMode = (m: 'in' | 'up') => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  return (
    <div className="modal-back blur" onMouseDown={(e) => e.target === e.currentTarget && !busy && closeAuth()}>
      <div className="modal auth" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-x" aria-label="Close" onClick={closeAuth} disabled={busy}><Icon name="x" size={16} /></button>
        <div className="auth-icon" aria-hidden="true"><Icon name={mode === 'in' ? 'login' : 'userPlus'} size={24} /></div>
        {signInComingSoon ? (
          <>
            <h2 id="auth-title">Sign-in is coming soon</h2>
            <p className="muted">
              This feature is coming soon. Until then, your Watchlist and watch history are saved on this device.
            </p>
            <button className="btn primary wide" onClick={closeAuth}>Got it</button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <h2 id="auth-title">{mode === 'in' ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="muted small">
              {mode === 'in' ? 'Sign in to sync your watchlist & watch progress across devices' : 'Join Comvie to back up your library to the cloud'}
            </p>

            <div className="seg auth-seg" role="tablist" aria-label="Mode">
              <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => switchMode('in')}>Sign In</button>
              <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => switchMode('up')}>Register</button>
            </div>

            {mode === 'up' && (
              <label className="auth-label">
                Username (Optional)
                <span className="auth-input">
                  <Icon name="user" size={17} />
                  <input autoComplete="username" placeholder="kawai_pirate" maxLength={30} value={username} disabled={busy} onChange={(e) => setUsername(e.target.value)} />
                </span>
              </label>
            )}
            <label className="auth-label">
              Email Address
              <span className="auth-input">
                <Icon name="mail" size={17} />
                <input
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="name@example.com"
                  value={email}
                  disabled={busy}
                  onChange={(e) => { setEmail(e.target.value); setError(null); }}
                />
              </span>
            </label>
            <label className="auth-label">
              Password
              <span className="auth-input">
                <Icon name="lock" size={17} />
                <input
                  type="password"
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  value={password}
                  disabled={busy}
                  onChange={(e) => { setPassword(e.target.value); setError(null); }}
                />
              </span>
            </label>

            {needCaptcha && (
              <Turnstile
                siteKey={turnstileSiteKey}
                resetKey={captchaRound}
                onToken={(t) => { setCaptcha(t); if (t) setError(null); }}
                onLoadError={() => setCaptchaBroken(true)}
              />
            )}

            {needCaptcha && captchaBroken && !error && (
              <p className="error">The "Verify you are human" check couldn't load. Turn off any ad or script blocker for this site, then reload.</p>
            )}
            {error ? <p className="error">{error}</p> : info ? <p className="muted small auth-info">{info}</p> : null}

            <button className="btn primary wide auth-go" type="submit" disabled={busy || (needCaptcha && !captcha)}>
              {busy ? 'Please wait…' : mode === 'in' ? <><Icon name="login" size={16} />Sign In</> : <><Icon name="userPlus" size={16} />Create Account</>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
