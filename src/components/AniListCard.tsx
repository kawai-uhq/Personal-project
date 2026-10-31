import { useState } from 'react';
import Icon from './Icon';
import { askConfirm } from './Confirm';
import { anilistReady, connectUrl, disconnectAniList, importAniList, setAniListSync, useAniLink } from '../lib/anilistAccount';

/** Account page: connect AniList, import its lists, keep its progress up to date. */
export default function AniListCard() {
  const link = useAniLink();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const doImport = async () => {
    setBusy(true);
    setNote('');
    try {
      const r = await importAniList();
      setNote(`Imported ${r.anime} anime and ${r.manga} manga. Watched episodes were marked too.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Couldn't import from AniList.");
    }
    setBusy(false);
  };

  return (
    <section className="set-card al-card">
      <div className="al-head">
        <span className="al-logo" aria-hidden="true">AL</span>
        <div>
          <h3>AniList</h3>
          <small className="muted">Bring your anime & manga lists over, and keep AniList up to date as you watch and read.</small>
        </div>
      </div>
      {!anilistReady ? (
        <p className="muted small">AniList connection isn't switched on for this site yet.</p>
      ) : !link ? (
        <a className="btn primary" href={connectUrl()}><Icon name="link" size={16} />Connect AniList</a>
      ) : (
        <>
          <div className="al-user">
            {link.avatar ? <img src={link.avatar} alt="" /> : <span className="acct-avatar">{link.name.charAt(0)}</span>}
            <div>
              <strong>{link.name}</strong>
              <a className="link small" href={`https://anilist.co/user/${encodeURIComponent(link.name)}`} target="_blank" rel="noopener noreferrer">View profile</a>
            </div>
          </div>
          <div className="set-row">
            <div className="set-label">
              <strong>Update my AniList as I watch & read</strong>
              <small>Finishing an episode or opening a chapter raises your AniList progress (it never goes backwards)</small>
            </div>
            <button type="button" role="switch" aria-checked={link.sync} aria-label="Update my AniList" className={`set-switch ${link.sync ? 'on' : ''}`} onClick={() => setAniListSync(!link.sync)}><i /></button>
          </div>
          <div className="set-grid">
            <button className="btn ghost" disabled={busy} onClick={() => void doImport()}><Icon name="download" size={15} />{busy ? 'Importing…' : 'Import my lists'}</button>
            <button
              className="btn ghost danger"
              onClick={async () => {
                if (await askConfirm({ title: 'Disconnect AniList?', text: 'Comvie stops updating your AniList. Anything already imported stays.', ok: 'Disconnect', danger: true, icon: 'link' })) disconnectAniList();
              }}
            >
              <Icon name="x" size={15} />Disconnect
            </button>
          </div>
          {note && <p className="set-note" role="status">{note}</p>}
          <p className="muted small">Import adds your Watching / Reading and Planning titles to your Comvie lists, on the anime and manga sites.</p>
        </>
      )}
    </section>
  );
}
