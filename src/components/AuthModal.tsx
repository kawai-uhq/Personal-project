import { useEffect, useState } from 'react';
import { AuthError, oauthUrl, sendCode, signInComingSoon, signInPassword, signUpPassword, turnstileSiteKey, updatePassword, verifyCode } from '../lib/auth';
import DiscordIcon from './DiscordIcon';
import { useApp } from '../state';
import Icon from './Icon';
import Turnstile from './Turnstile';

const RESEND_SECONDS = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Step = 'form' | 'code' | 'newpass';

/** Sign in / create an account with email and password, behind Cloudflare's "Verify you are human" box.
 *  "Forgot password?" emails a one-time code, signs in with it, then offers to set a new password. */
export default function AuthModal() {
  const { authOpen, closeAuth, onSignedIn } = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [step, setStep] = useState<Step>('form');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [newPass, setNewPass] = useState('');
  // signed in with a code, waiting for the new password (or a skip)
  const [pending, setPending] = useState<Parameters<typeof onSignedIn>[0] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // Cloudflare check: a one-use token, and a counter that asks the box for a fresh check after each attempt
  const [captcha, setCaptcha] = useState('');
  const [captchaRound, setCaptchaRound] = useState(0);
  const [captchaBroken, setCaptchaBroken] = useState(false);
  const needCaptcha = !!turnstileSiteKey;

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

  const usedCaptcha = () => {
    // each check works for one attempt only
    if (needCaptcha) {
      setCaptcha('');
      setCaptchaRound((n) => n + 1);
    }
  };
  const captchaMissing = () => (needCaptcha && !captcha ? (captchaBroken ? "The verification check couldn't load. Turn off any blocker for this site and reload." : 'Tick "Verify you are human" first.') : null);

  const done = (s: Parameters<typeof onSignedIn>[0]) => {
    setStep('form');
    setPassword('');
    setCode('');
    setNewPass('');
    setPending(null);
    setInfo(null);
    onSignedIn(s);
  };

  const submitForm = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError('Enter a valid email address.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    const miss = captchaMissing();
    if (miss) return setError(miss);
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
    usedCaptcha();
    setBusy(false);
  };

  // "Forgot password?": email a one-time sign-in code
  const sendOtp = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError('Enter your email above first.');
    const miss = captchaMissing();
    if (miss) return setError(miss);
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await sendCode(clean, captcha || undefined);
      setEmail(clean);
      setCode('');
      setStep('code');
      setCooldown(RESEND_SECONDS);
      setInfo(`We emailed a code to ${clean}. Check spam if you don't see it.`);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't send the code. Try again.");
    }
    usedCaptcha();
    setBusy(false);
  };

  const verify = async () => {
    if (code.length < 6) return setError('Enter the code from your email.');
    setBusy(true);
    setError(null);
    try {
      const s = await verifyCode(email, code);
      // signed in: offer to set a new password before closing
      setPending(s);
      setStep('newpass');
      setInfo(null);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'That code is wrong or has expired.');
    }
    setBusy(false);
  };

  const saveNewPass = async () => {
    if (!pending) return;
    if (newPass.length < 6) return setError('Password must be at least 6 characters.');
    setBusy(true);
    setError(null);
    try {
      await updatePassword(pending.accessToken, newPass);
      done(pending);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Couldn't save the new password. Try again.");
    }
    setBusy(false);
  };

  const switchMode = (m: 'in' | 'up') => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const title = step === 'code' ? 'Enter your code' : step === 'newpass' ? 'Set a new password' : mode === 'in' ? 'Welcome Back' : 'Create Account';
  const sub =
    step === 'code'
      ? `Type the code we sent to ${email}.`
      : step === 'newpass'
        ? "You're signed in. Choose a new password so you can sign in with it next time."
        : mode === 'in'
          ? 'Sign in to sync your watchlist & watch progress across devices'
          : 'Join Comvie to back up your library to the cloud';
  // the Cloudflare box is needed to sign in, register, or send / resend a code
  const showCaptcha = needCaptcha && (step === 'form' || step === 'code');

  return (
    <div className="modal-back blur" onMouseDown={(e) => e.target === e.currentTarget && !busy && closeAuth()}>
      <div className="modal auth" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="modal-x" aria-label="Close" onClick={() => (pending ? done(pending) : closeAuth())} disabled={busy}><Icon name="x" size={16} /></button>
        <div className="auth-icon" aria-hidden="true"><Icon name={step === 'newpass' ? 'lock' : step === 'code' || mode === 'in' ? 'login' : 'userPlus'} size={24} /></div>
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
              void (step === 'form' ? submitForm() : step === 'code' ? verify() : saveNewPass());
            }}
          >
            <h2 id="auth-title">{title}</h2>
            <p className="muted small">{sub}</p>

            {step === 'form' && (
              <div className="seg auth-seg" role="tablist" aria-label="Mode">
                <button type="button" role="tab" aria-selected={mode === 'in'} className={mode === 'in' ? 'on' : ''} onClick={() => switchMode('in')}>Sign In</button>
                <button type="button" role="tab" aria-selected={mode === 'up'} className={mode === 'up' ? 'on' : ''} onClick={() => switchMode('up')}>Register</button>
              </div>
            )}

            {step === 'form' && (
              <>
                {/* one tap, no password: Discord sign-in also adds them to the Discord server */}
                <div className="auth-social">
                  <a className="btn auth-discord" href={oauthUrl('discord')}><DiscordIcon size={18} />Continue with Discord</a>
                </div>
                <div className="auth-or"><span>or with email</span></div>
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
              </>
            )}

            {step === 'code' && (
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

            {step === 'newpass' && (
              <label className="auth-label">
                New password
                <span className="auth-input">
                  <Icon name="lock" size={17} />
                  <input
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    placeholder="At least 6 characters"
                    value={newPass}
                    disabled={busy}
                    onChange={(e) => { setNewPass(e.target.value); setError(null); }}
                  />
                </span>
              </label>
            )}

            {showCaptcha && (
              <Turnstile
                siteKey={turnstileSiteKey}
                resetKey={captchaRound}
                // a passed check only clears the "tick the box" reminder, never the reason an attempt failed
                onToken={(t) => { setCaptcha(t); if (t) setError((e) => (e && e.startsWith('Tick "Verify') ? null : e)); }}
                onLoadError={() => setCaptchaBroken(true)}
              />
            )}

            {needCaptcha && captchaBroken && showCaptcha && !error && (
              <p className="error">The "Verify you are human" check couldn't load. Turn off any ad or script blocker for this site, then reload.</p>
            )}
            {error ? <p className="error">{error}</p> : info ? <p className="muted small auth-info">{info}</p> : null}

            <button className="btn primary wide auth-go" type="submit" disabled={busy || (step === 'form' && needCaptcha && !captcha)}>
              {busy
                ? 'Please wait…'
                : step === 'code'
                  ? 'Verify and continue'
                  : step === 'newpass'
                    ? 'Save new password'
                    : mode === 'in'
                      ? <><Icon name="login" size={16} />Sign In</>
                      : <><Icon name="userPlus" size={16} />Create Account</>}
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
                  onClick={() => { setStep('form'); setCode(''); setError(null); setInfo(null); }}
                >
                  Back
                </button>
              </div>
            )}
            {step === 'newpass' && pending && (
              <div className="modal-links">
                <button type="button" className="link" disabled={busy} onClick={() => done(pending)}>
                  Skip for now
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
