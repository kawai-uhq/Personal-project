import { useEffect, useState } from 'react';
import Icon from '../Icon';
import type { Profile } from '../../lib/profile';
import type { WatchStats } from '../../lib/stats';
import { renderProfileCard } from '../../lib/shareCard';

/** "Share my profile card": draws the profile as a picture to download or send. */
export default function ShareCard({ profile, name, stats, badges }: { profile: Profile | null; name: string; stats: WatchStats; badges: string[] }) {
  const [busy, setBusy] = useState(false);
  const [pic, setPic] = useState<{ url: string; blob: Blob } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => () => { if (pic) URL.revokeObjectURL(pic.url); }, [pic]);
  if (!profile) return null;

  const file = () => new File([pic!.blob], `comvie-${profile.username || name}.png`, { type: 'image/png' });
  const canShare = typeof navigator !== 'undefined' && !!navigator.canShare && !!pic && navigator.canShare({ files: [file()] });

  const make = async () => {
    setBusy(true);
    setErr(null);
    try {
      const blob = await renderProfileCard(profile, stats, badges);
      setPic({ url: URL.createObjectURL(blob), blob });
    } catch (e) {
      console.error('[share card]', e);
      setErr("Couldn't make the picture. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="share-card">
      <button className="btn small ghost" disabled={busy} onClick={() => void make()}>
        <Icon name="share" size={14} />{busy ? 'Making your card…' : pic ? 'Make it again' : 'Share my profile card'}
      </button>
      {err && <p className="small error">{err}</p>}
      {pic && (
        <div className="sc-out">
          <img src={pic.url} alt="Your profile card" />
          <div className="pe-row">
            <a className="btn small primary" href={pic.url} download={`comvie-${profile.username || name}.png`}><Icon name="download" size={14} />Download</a>
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
