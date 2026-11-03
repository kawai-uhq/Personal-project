import { useEffect, useState } from 'react';
import Avatar from '../Avatar';
import Icon from '../Icon';
import { syncDiscord } from '../AccountRuntime';
import { linkDiscord } from '../../lib/auth';
import { discordInfo, hasDiscord } from '../../lib/profile';
import { useApp } from '../../state';

/** Connections → Discord: who you're connected as, refresh your Discord items, or connect Discord. */
export default function DiscordCard() {
  const { getToken } = useApp();
  const [, bump] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    window.addEventListener('comvie:linked', f);
    return () => window.removeEventListener('comvie:linked', f);
  }, []);
  const linked = hasDiscord();
  const info = discordInfo();

  const run = async (job: (t: string) => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const t = await getToken();
      if (!t) throw new Error('Sign in again, then try once more.');
      await job(t);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
    }
    setBusy(false);
  };

  return (
    <div className="acct-panel conn">
      <div className="acct-line">
        <span className="conn-ico discord"><Icon name="message" size={18} /></span>
        <div>
          <strong>Discord</strong>
          <small className="muted">
            {linked ? `Connected${info?.name ? ` as ${info.name}` : ''}. Your Discord picture, decoration, nameplate and banner can be used on your profile.` : 'Connect Discord to use your Discord picture, decoration, nameplate and banner, and join our server.'}
          </small>
        </div>
        {linked ? (
          <button className="btn small ghost" disabled={busy} onClick={() => void run(async (t) => setMsg((await syncDiscord(t)) ? { ok: true, text: 'Updated from Discord.' } : { ok: false, text: "Couldn't reach Discord right now. Try again later." }))}>
            <Icon name="refresh" size={14} />{busy ? 'Updating…' : 'Update from Discord'}
          </button>
        ) : (
          <button className="btn small" disabled={busy} onClick={() => void run(async (t) => { await linkDiscord(t); await new Promise(() => undefined); })}>
            <Icon name="link" size={14} />Connect Discord
          </button>
        )}
      </div>
      {linked && info && (
        <div className="conn-items">
          {info.avatar && <Avatar avatar={{ url: info.avatar }} deco={info.decoration ? { discord: info.decoration } : undefined} letter={info.name} size={40} />}
          {info.banner && <img className="conn-banner" src={info.banner} alt="Discord banner" referrerPolicy="no-referrer" />}
        </div>
      )}
      {msg && <p className={`small ${msg.ok ? 'pe-ok' : 'error'}`}>{msg.text}</p>}
    </div>
  );
}
