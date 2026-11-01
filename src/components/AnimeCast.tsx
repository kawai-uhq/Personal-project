import { useEffect, useState } from 'react';
import { aniCast } from '../lib/anilist';
import type { CastEntry, CastPerson } from '../lib/anilist';
import Icon from './Icon';

const ROLE: Record<string, string> = { MAIN: 'Main', SUPPORTING: 'Supporting', BACKGROUND: 'Background' };
type Lang = 'jp' | 'en';

function Face({ p, alt }: { p: CastPerson | null; alt: string }) {
  return p?.image ? (
    <img src={p.image} alt={alt} loading="lazy" referrerPolicy="no-referrer" />
  ) : (
    <span className="cast-ph" aria-hidden="true"><Icon name="user" size={18} /></span>
  );
}

/** "Characters & Voice Actors" for an anime: character on the left, voice actor on the right (AniList style). */
export default function AnimeCast({ id, compact }: { id: number; compact?: boolean }) {
  const [items, setItems] = useState<CastEntry[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<Lang>('jp');
  const [open, setOpen] = useState(false); // compact: first 6 only until expanded

  useEffect(() => {
    let live = true;
    setItems(null);
    setPage(1);
    setOpen(false);
    aniCast(id, 1)
      .then((r) => {
        if (!live) return;
        setItems(r.items);
        setMore(r.more);
      })
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [id]);

  if (!items || items.length === 0) return null; // nothing listed: no empty section
  const hasEn = items.some((e) => e.en.length > 0);
  const lng: Lang = lang === 'en' && hasEn ? 'en' : 'jp';
  const shown = compact && !open ? items.slice(0, 6) : items;

  const loadMore = () => {
    if (compact && !open) return setOpen(true);
    setBusy(true);
    aniCast(id, page + 1)
      .then((r) => {
        setItems((cur) => [...(cur ?? []), ...r.items]);
        setMore(r.more);
        setPage((n) => n + 1);
      })
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  const canMore = (compact && !open && items.length > 6) || ((!compact || open) && more);

  return (
    <section className={`cast ${compact ? 'compact' : ''}`}>
      <div className="cast-head">
        <h3>Characters &amp; Voice Actors</h3>
        {hasEn && (
          <div className="seg cast-seg" role="radiogroup" aria-label="Voice language">
            <button type="button" role="radio" aria-checked={lng === 'jp'} className={lng === 'jp' ? 'on' : ''} onClick={() => setLang('jp')}>Japanese</button>
            <button type="button" role="radio" aria-checked={lng === 'en'} className={lng === 'en' ? 'on' : ''} onClick={() => setLang('en')}>English</button>
          </div>
        )}
      </div>
      <div className="cast-grid">
        {shown.map((e) => {
          const va = e[lng][0] ?? null;
          return (
            <div key={e.character.id} className="cast-row">
              <div className="cast-side">
                <Face p={e.character} alt={e.character.name} />
                <span className="cast-txt">
                  <b>{e.character.name}</b>
                  <small>{ROLE[e.role] ?? e.role}</small>
                </span>
              </div>
              {va && (
                <div className="cast-side va">
                  <span className="cast-txt">
                    <b>{va.name}</b>
                    <small>{lng === 'jp' ? 'Japanese' : 'English'}{e[lng].length > 1 ? ` +${e[lng].length - 1}` : ''}</small>
                  </span>
                  <Face p={va} alt={va.name} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {canMore && (
        <div className="center-row">
          <button className="btn small ghost" onClick={loadMore} disabled={busy}>
            {busy ? 'Loading…' : <><Icon name="chevronDown" size={15} />Show more</>}
          </button>
        </div>
      )}
    </section>
  );
}
