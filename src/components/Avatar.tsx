import type { Avatar as AvatarData, Deco } from '../lib/profile';

/** A round profile picture: an image or a coloured letter, with an optional frame and Discord decoration. */
export default function Avatar({ avatar, deco, letter, size = 36, plain }: { avatar?: AvatarData; deco?: Deco; letter: string; size?: number; plain?: boolean }) {
  const frame = !plain && deco?.frame ? deco.frame : '';
  const discord = !plain && deco?.discord ? deco.discord : '';
  return (
    <span className={`av ${frame ? `av-frame f-${frame}` : ''}`} style={{ width: size, height: size, ['--av' as any]: `${size}px` }}>
      {avatar?.url ? (
        <img className="av-img" src={avatar.url} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="av-img av-letter" style={{ background: avatar?.color || 'var(--accent)', fontSize: size * 0.42 }}>{(letter || '?').charAt(0).toUpperCase()}</span>
      )}
      {discord && <img className="av-deco" src={discord} alt="" />}
    </span>
  );
}
