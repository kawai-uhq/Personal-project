import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { onOpenConsent, setConsent, useConsent } from '../lib/consent';

/** The "we use cookies" notice: Accept all / Essential only / Manage. Shown until a choice is made. */
export default function CookieBanner() {
  const consent = useConsent();
  const [open, setOpen] = useState(!consent);
  const [manage, setManage] = useState(false);
  const [media, setMedia] = useState(consent?.media ?? true);

  useEffect(() => onOpenConsent(() => { setMedia(consent?.media ?? true); setManage(true); setOpen(true); }), [consent]);
  useEffect(() => { if (!consent) setOpen(true); }, [consent]);

  if (!open) return null;
  const done = (m: boolean) => {
    setConsent(m);
    setOpen(false);
    setManage(false);
  };
  return (
    <div className="cookie" role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className="cookie-top">
        <span className="cookie-icon" aria-hidden="true"><Icon name="cookie" size={20} /></span>
        <div>
          <h2 id="cookie-title">We use cookies</h2>
          <p>
            Comvie uses cookies and your browser's storage to keep you signed in and remember your lists and settings. We don't run ads or tracking.
            Video players and trailers load from other sites, which may set their own cookies. <Link className="link" to="/legal/privacy">Privacy Policy</Link>
          </p>
        </div>
      </div>
      {manage && (
        <div className="cookie-opts">
          <div className="cookie-opt">
            <div><strong>Essential</strong><small>Sign-in, settings, your lists and this choice. Always on.</small></div>
            <span className="cookie-always">Always on</span>
          </div>
          <div className="cookie-opt">
            <div><strong>Third-party media</strong><small>Load video players and YouTube trailers automatically. Off: tap to load each one.</small></div>
            <button type="button" role="switch" aria-checked={media} aria-label="Third-party media" className={`set-switch ${media ? 'on' : ''}`} onClick={() => setMedia(!media)}><i /></button>
          </div>
        </div>
      )}
      <div className="cookie-btns">
        {manage ? (
          <button className="btn primary" onClick={() => done(media)}>Save choices</button>
        ) : (
          <>
            <button className="btn primary" onClick={() => done(true)}>Accept all</button>
            <button className="btn ghost" onClick={() => done(false)}>Essential only</button>
            <button className="btn ghost" onClick={() => setManage(true)}>Manage</button>
          </>
        )}
      </div>
    </div>
  );
}
