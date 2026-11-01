import { useEffect, useState } from 'react';
import { aniCast } from '../lib/anilist';
import type { CastEntry, CastLang, CastPerson } from '../lib/anilist';
import Icon from './Icon';

const ROLE: Record<string, string> = { MAIN: 'Main', SUPPORTING: 'Supporting', BACKGROUND: 'Background' };

interface Pages {
  items: CastEntry[];
  page: number;
  more: boolean;
}

function Face({ p, alt }: { p: CastPerson | null; alt: string }) {
  return p?.image ? (
    <img src={p.image} alt={alt} loading="lazy" referrerPolicy="no-referrer" />
  ) : (
    <span className="cast-ph" aria-hidden="true"><Icon name="user" size={18} /></span>
  );
}

/** "Characters & Voice Actors" for an anime: character on the left, voice actor on the right (AniList style).
 *  Japanese and English casts are loaded separately; English only when asked for. */
export default function AnimeCast({ id, compact }: { id: number; compact?: boolean }) {
  const [lang, setLang] = useState<CastLang>('JAPANESE');
  const [data, setData] = useState<Partial<Record<CastLang, Pages>>>({});
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false); // compact: first 6 only until expanded

  // a new anime starts over in Japanese
  useEffect(() => {
    setData({});
    setLang('JAPANESE');
    setOpen(false);
    setFailed(false);
  }, [id]);

  // load the first page of the chosen language the first time it's shown
  useEffect(() => {
    if (data[lang]) return;
    let live = true;
    setBusy(true);
    aniCast(id, 1, lang)
      .then((r) => live && setData((d) => ({ ...d, [lang]: { items: r.items, page: 1, more: r.more } })))
      .catch(() => live && (lang === 'JAPANESE' ? setFailed(true) : setLang('JAPANESE')))
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, lang]);

  const cur = data[lang] ?? data.JAPANESE;
  if (failed || (!cur && !busy)) return null;
  if (!cur) return null; // first load: nothing on screen yet
  if (cur.items.length === 0) return null; // nothing listed: no empty section

  const shown = compact && !open ? cur.items.slice(0, 6) : cur.items;
  const noEnglish = lang === 'ENGLISH' && !!data.ENGLISH && data.ENGLISH.items.every((e) => e.vas.length === 0);

  const loadMore = () => {
    if (compact && !open) return setOpen(true);
    const l = lang;
    const d = data[l];
    if (!d) return;
    setBusy(true);
    aniCast(id, d.page + 1, l)
      .then((r) => setData((x) => ({ ...x, [l]: { items: [...(x[l]?.items ?? []), ...r.items], page: d.page + 1, more: r.more } })))
      .catch(() => undefined)
      .finally(() => setBusy(false));
  };
  const canMore = (compact && !open && cur.items.length > 6) || ((!compact || open) && cur.more);
  const label = lang === 'JAPANESE' ? 'Japanese' : 'English';

  return (
    <section className={`cast ${compact ? 'compact' : ''}`}>
      <div className="cast-head">
        <h3>Characters &amp; Voice Actors</h3>
        <div className="seg cast-seg" role="radiogroup" aria-label="Voice language">
          <button type="button" role="radio" aria-checked={lang === 'JAPANESE'} className={lang === 'JAPANESE' ? 'on' : ''} onClick={() => setLang('JAPANESE')}>Japanese</button>
          <button type="button" role="radio" aria-checked={lang === 'ENGLISH'} className={lang === 'ENGLISH' ? 'on' : ''} onClick={() => setLang('ENGLISH')}>English</button>
        </div>
      </div>
      {noEnglish && <p className="muted small cast-note">No English dub cast is listed for this anime.</p>}
      <div className={`cast-grid ${busy && !data[lang] ? 'loading' : ''}`}>
        {shown.map((e) => {
          const va = data[lang] ? e.vas[0] ?? null : null;
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
                    <small>{label}{e.vas.length > 1 ? ` +${e.vas.length - 1}` : ''}</small>
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
