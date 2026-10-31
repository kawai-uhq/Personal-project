import { Link } from 'react-router-dom';
import Logo from './Logo';
import { openConsent } from '../lib/consent';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <Logo size={26} />
        <nav aria-label="Legal">
          <Link to="/about">About</Link>
          <Link to="/help">Get help</Link>
          <Link to="/legal/terms">Terms</Link>
          <Link to="/legal/privacy">Privacy</Link>
          <Link to="/legal/dmca">DMCA</Link>
          <Link to="/contact">Contact</Link>
          <button type="button" className="footer-link" onClick={openConsent}>Cookie settings</button>
        </nav>
        <p>
          Comvie does not host any video. Movie and show information comes from TMDB; this product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </div>
      <div className="footer-mark" aria-hidden="true">COMVIE</div>
    </footer>
  );
}
