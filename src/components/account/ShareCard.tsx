import { useEffect, useState } from 'react';
import Icon from '../Icon';
import type { Profile } from '../../lib/profile';
import type { WatchStats } from '../../lib/stats';
import { renderProfileCard } from '../../lib/shareCard';

/** "Share my profile card": draws the profile as a picture (animated when the decorations move) to download or send. */
export default function ShareCard({ profile, name, stats, badges }: { profile: Profile | null; name: string; stats: WatchStats; badges: string[] }) {
  const [busy, setBusy] = useState<number | null>(null);
  const [pic, setPic] = useState<{ url: string; blob: Blob; ext: 'gif' | 'png' } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => () => { if (pic) URL.revokeObjectURL(pic.url); }, [pic]);
  if (!profile) return null;

  const fileName = () => `comvie-${profile.username || name}.${pic!.ext}`;
  const file = () => new File([pic!.blob], fileName(), { type: pic!.blob.type });
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && !!pic && navigator.canShare({ files: [file()] });

  const make = async () => {
    setBusy(0);
    setErr(null);
    try {
      const r = await renderProfileCard(profile, stats, badges, (p) => setBusy(p));
      setPic({ url: URL.createObjectURL(r.blob), blob: r.blob, ext: r.animated ? 'gif' : 'png' });
    } catch (e) {
      console.error('[share card]', e);
      setErr("Couldn't make the picture. Try again.");
    }
    setBusy(null);
  };

  return (
    <div className="share-card">
      <button className="btn small ghost" disabled={busy !== null} onClick={() => void make()}>
        <Icon name="share" size={14} />
        {busy !== null ? `Making your card… ${Math.round(busy * 100)}%` : pic ? 'Make it again' : 'Share my profile card'}
      </button>
      {err && <p className="small error">{err}</p>}
      {pic && (
        <div className="sc-out">
          <img src={pic.url} alt="Your profile card" />
          <div className="pe-row">
            <a className="btn small primary" href={pic.url} download={fileName()}>
              <Icon name="download" size={14} />Download {pic.ext.toUpperCase()}
            </a>
            {canShare && (
              <button className="btn small ghost" onClick={() => void navigator.share({ files: [file()], title: 'My Comvie profile' }).catch(() => undefined)}>
                <Icon name="share" size={14} />Share…
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
