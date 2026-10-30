import { useEffect, useState } from 'react';
import { AuthError, resendSignup, sendCode, signInComingSoon, signInPassword, signUpPassword, verifyCode } from '../lib/auth';
import { useApp } from '../state';
import Icon from './Icon';

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthModal() {
  const { authOpen, closeAuth, onSignedIn } = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // which kind of code the code step is waiting for: a sign-in code, or the code that confirms a new account
  const [codeType, setCodeType] = useState<'email' | 'signup'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (!authOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && closeAuth();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOpen, busy, closeAuth]);

  if (!authOpen) return null;

  const done = (s: Parameters<typeof onSignedIn>[0]) => {
    setStep('form');
    setPassword('');
    setCode('');
    setInfo(null);
    onSignedIn(s);
  };

  const submitForm = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'in') {
        done(await signInPassword(clean, password));
      } else {
        const s = await signUpPassword(clean, password, username.trim());
        if (s) done(s);
        else {
          // Supabase wants the email confirmed: ask for the code from the email right here
          setEmail(clean);
          setCode('');
          setCodeType('signup');
          setStep('code');
          setCooldown(RESEND_SECONDS);
          setInfo(`We emailed a verification code to ${clean}. Check spam if you don't see it.`);
        }
      }
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    }
    setBusy(false);
  };

  // Alternative: a one-time code instead of a password
  const sendOtp = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError('Enter your email above first.');
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (step === 'code' && codeType === 'signup') await resendSignup(clean);
      else {
        await sendCode(clean);
        setCodeType('email');
      }
      setEmail(clean);
      setCode('');
      setStep('code');
      setCooldown(RESEND_SECONDS);
      setInfo(`We emailed a code to ${clean}. Check spam if you don't see it.`);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't send the code. Try again.");
    }
    setBusy(false);
  };

  const verify = async () => {
    if (code.length < 6) return setError('Enter the code from your email.');
    setBusy(true);
    setError(null);
    try {
      done(await verifyCode(email, code, codeType));
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'That code is wrong or has expired.');
    }
    setBusy(false);
  };

  const icon = <Icon name={step === 'code' || mode === 'in' ? 'login' : 'userPlus'} size={24} />;

  return (
    <div className="modal-back blur" onMouseDown={(e) => e.target === e.currentTarget && !busy && closeAuth()}>
      <div className="modal auth" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-x" aria-label="Close" onClick={closeAuth} disabled={busy}><Icon name="x" size={16} /></button>
        <div className="auth-icon" aria-hidden="true">{icon}</div>
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
              void (step === 'form' ? submitForm() : verify());
            }}
          >
            <h2 id="auth-title">{step === 'code' ? (codeType === 'signup' ? 'Verify your email' : 'Enter your code') : mode === 'in' ? 'Welcome Back' : 'Create Account'}</h2>
            <p className="muted small">
              {step === 'code'
                ? `Type the code we sent to ${email}.`
                : mode === 'in'
                  ? 'Sign in to sync your watchlist & watch progress across devices'
                  : 'Join Comvie to back up your library to the cloud'}
            </p>

            {step === 'form' && (
              <div className="seg auth-seg" role="tablist" aria-label="Mode">
                <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => { setMode('in'); setError(null); }}>Sign In</button>
                <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => { setMode('up'); setError(null); }}>Register</button>
              </div>
            )}

            {step === 'form' ? (
              <>
                {mode === 'up' && (
                  <label className="auth-label">
                    Username (Optional)
                    <span className="auth-input">
                      <Icon name="user" size={17} />
                      <input autoComplete="username" placeholder="movie_buff" maxLength={30} value={username} disabled={busy} onChange={(e) => setUsername(e.target.value)} />
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
              </>
            ) : (
              <label className="auth-label">
                Verification code
                <span className="auth-input">
                  <Icon name="lock" size={17} />
                  <input
                    className="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    placeholder="Enter code"
                    value={code}
                    disabled={busy}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 10)); setError(null); }}
                  />
                </span>
              </label>
            )}

            {error ? <p className="error">{error}</p> : info ? <p className="muted small">{info}</p> : null}

            <button className="btn primary wide auth-go" type="submit" disabled={busy}>
              {busy ? 'Please wait…' : step === 'code' ? (codeType === 'signup' ? 'Verify and create account' : 'Verify and continue') : mode === 'in' ? <><Icon name="login" size={16} />Sign In</> : <><Icon name="userPlus" size={16} />Create Account</>}
            </button>

            {step === 'form' && mode === 'in' && (
              <div className="modal-links">
                <button type="button" className="link" disabled={busy} onClick={() => void sendOtp()}>
                  Forgot password? Email me a code
                </button>
              </div>
            )}
            {step === 'code' && (
              <div className="modal-links">
                <button type="button" className="link" disabled={busy || cooldown > 0} onClick={() => void sendOtp()}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
                <button
                  type="button"
                  className="link"
                  disabled={busy}
                  onClick={() => { setStep('form'); setCode(''); setCodeType('email'); setError(null); setInfo(null); }}
                >
                  Back
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
