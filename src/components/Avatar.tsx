import type { Avatar as AvatarData, Deco } from '../lib/profile';
import { FRAMES } from '../lib/decorations';

const FRAME_IDS = new Set(FRAMES.map((f) => f.id));

/**
 * A round profile picture (an image or a coloured letter) with an optional avatar decoration on top:
 * one of Comvie's illustrated decorations (public/deco/frames) or the person's own Discord decoration.
 * Like Discord's, a decoration is drawn at 120% of the picture's size, centred on it.
 */
export default function Avatar({ avatar, deco, letter, size = 36, plain, still }: { avatar?: AvatarData; deco?: Deco; letter: string; size?: number; plain?: boolean; still?: boolean }) {
  const discord = !plain && deco?.discord ? deco.discord : '';
  const frame = !plain && !discord && deco?.frame && FRAME_IDS.has(deco.frame) ? deco.frame : '';
  return (
    <span className="av" style={{ width: size, height: size }}>
      {avatar?.url ? (
        <img className="av-img" src={avatar.url} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className="av-img av-letter" style={{ background: avatar?.color || 'var(--accent)', fontSize: size * 0.42 }}>{(letter || '?').charAt(0).toUpperCase()}</span>
      )}
      {frame && <img className="av-deco" src={`/deco/frames/${frame}${still ? '-still' : ''}.svg`} alt="" decoding="async" draggable={false} />}
      {discord && <img className="av-deco" src={discord} alt="" referrerPolicy="no-referrer" draggable={false} />}
    </span>
  );
}
