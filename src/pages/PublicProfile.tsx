import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { NameplateMedia, nameplateClass } from '../components/Nameplate';
import ProfileFrame from '../components/ProfileFrame';
import Icon from '../components/Icon';
import StatsGrid from '../components/account/StatsGrid';
import { publicProfile } from '../lib/profile';
import type { Profile } from '../lib/profile';
import { posterSrc } from '../lib/tmdb';
import { toPublic as P } from '../lib/site';

/** Someone's public profile: comvie.lol/u/<username> */
export default function PublicProfile() {
  const { name = '' } = useParams();
  const [p, setP] = useState<Profile | null | undefined>(undefined);

  useEffect(() => {
    let live = true;
    setP(undefined);
    publicProfile(name.toLowerCase()).then((x) => live && setP(x));
    return () => {
      live = false;
    };
  }, [name]);

  useEffect(() => {
    if (p?.username) document.title = `@${p.username} · Comvie`;
  }, [p?.username]);

  if (p === undefined) {
    return <main className="page pad-top"><div className="container mid"><p className="muted">Loading profile…</p></div></main>;
  }
  if (!p) {
    return (
      <main className="page pad-top">
        <div className="container mid acct">
          <div className="acct-card acct-empty">
            <span className="acct-avatar"><Icon name="user" size={26} /></span>
            <h1 className="title">Profile not found</h1>
            <p className="muted">There's no public profile called @{name}. It may be private or the name may have changed.</p>
            <Link className="btn primary" to="/">Go home</Link>
          </div>
        </div>
      </main>
    );
  }

  const d = p.public_data || {};
  const deco = p.deco || {};
  const joined = new Date(p.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const shelf = (title: string, items: { key: string; to: string; img: string | null; name: string; sub?: string }[]) =>
    items.length > 0 && (
      <>
        <h2 className="section">{title}</h2>
        <div className="pp-shelf">
          {items.map((it) => (
            <Link key={it.key} className="pp-item" to={it.to} title={it.name}>
              {it.img ? <img src={it.img} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className="pp-noimg"><Icon name="film" size={22} /></span>}
              <small>{it.name}</small>
              {it.sub && <em>{it.sub}</em>}
            </Link>
          ))}
        </div>
      </>
    );

  return (
    <main className="page pad-top">
      <div className="container mid acct">
        <div className={`pf-wrap ${deco.pframe ? 'has-pf' : ''}`}>
          <div className={`acct-card acct-hero pp-hero ${nameplateClass(deco)}`}>
            <NameplateMedia deco={deco} />
            {deco.effect && <span className={`fx fx-${deco.effect}`} />}
            <div className="acct-top">
              <Avatar avatar={p.avatar} deco={deco} letter={p.username || '?'} size={92} />
              <div>
                <h1 className="acct-name">@{p.username}</h1>
                <p className="muted"><Icon name="calendar" size={14} /> Joined {joined}</p>
              </div>
            </div>
          </div>
          <ProfileFrame id={deco.pframe} />
        </div>

        {d.stats && (
          <>
            <h2 className="section">Stats</h2>
            <StatsGrid stats={d.stats} />
          </>
        )}

        {shelf(
          'Watching',
          (d.watching ?? []).map((w) => ({ key: `w${w.type}${w.id}`, to: `/title/${w.type}/${w.id}`, img: w.poster ? posterSrc(w.poster) : null, name: w.title, sub: w.label }))
        )}
        {shelf(
          'Favorites',
          (d.favorites ?? []).map((m) => ({ key: `f${m.type}${m.id}`, to: `/title/${m.type}/${m.id}`, img: m.poster ? posterSrc(m.poster) : null, name: m.title }))
        )}
        {shelf(
          'Favorite anime',
          (d.anime ?? []).map((a) => ({ key: `a${a.id}`, to: P(`/anime/title/${a.id}`), img: a.cover, name: a.title }))
        )}
        {!d.stats && !(d.watching ?? []).length && !(d.favorites ?? []).length && !(d.anime ?? []).length && (
          <p className="muted">Nothing shared yet.</p>
        )}
      </div>
    </main>
  );
}
