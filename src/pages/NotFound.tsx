import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { useSection } from '../lib/section';
import { toPublic as P } from '../lib/site';

/** Unknown address. */
export default function NotFound() {
  const section = useSection();
  const home = section === 'cinema' ? '/' : P(`/${section}`);
  const search = section === 'cinema' ? '/search' : P(`/${section}/search`);
  return (
    <main className="page pad-top">
      <div className="container mid nf">
        <div className="nf-code" aria-hidden="true">404</div>
        <h1 className="title">Page not <span className="accent">found</span></h1>
        <p className="muted">That address doesn't lead anywhere on Comvie. It may have moved, or the link has a typo.</p>
        <div className="nf-btns">
          <Link className="btn primary" to={home}><Icon name="home" size={16} />Go home</Link>
          <Link className="btn ghost" to={search}><Icon name="search" size={16} />Search</Link>
        </div>
      </div>
    </main>
  );
}
