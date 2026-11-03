import { useEffect } from 'react';
import type { ReactNode } from 'react';
import Avatar from './Avatar';
import Icon from './Icon';
import ProfileFrame from './ProfileFrame';
import { NameplateMedia, nameplateClass } from './Nameplate';
import { BADGES } from '../lib/badges';
import { NAME_COLORS, NAME_FONTS } from '../lib/decorations';
import { BANNER_RE } from '../lib/profile';
import type { Avatar as AvatarData, Deco } from '../lib/profile';

/** Load a username font from Google Fonts the first time it's needed. */
const loaded = new Set<string>();
export function loadNameFont(id?: string) {
  const f = NAME_FONTS.find((x) => x.id === id);
  if (!f?.google || loaded.has(f.id) || typeof document === 'undefined') return;
  loaded.add(f.id);
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
  document.head.appendChild(l);
}

/** A username with its colour and font */
export function StyledName({ text, deco, as: Tag = 'span', className = '' }: { text: string; deco?: Deco; as?: 'span' | 'h1'; className?: string }) {
  const color = NAME_COLORS.find((x) => x.id === deco?.nameColor);
  const font = NAME_FONTS.find((x) => x.id === deco?.nameFont);
  useEffect(() => loadNameFont(font?.id), [font?.id]);
  return (
    <Tag
      className={`${className} sname ${color ? `sname-c sname-${color.id}` : ''}`}
      style={{ ...(color ? { backgroundImage: color.css } : {}), ...(font ? { fontFamily: font.family } : {}) }}
    >
      {text}
    </Tag>
  );
}

export function BadgeRow({ ids }: { ids?: string[] }) {
  const list = BADGES.filter((b) => ids?.includes(b.id));
  if (!list.length) return null;
  return (
    <span className="badges">
      {list.map((b) => (
        <span key={b.id} className="badge" style={{ ['--b' as any]: b.color }} title={`${b.name}: ${b.how}`} aria-label={b.name}>
          <Icon name={b.icon} size={13} />
        </span>
      ))}
    </span>
  );
}

/** The profile card: banner, nameplate, profile decoration, avatar (with decoration), styled name, badges and frame.
 *  Used on the account page, public profiles and the editor's live preview. */
export default function ProfileCard({
  avatar,
  deco = {},
  name,
  badges,
  size = 76,
  children,
  className = ''
}: {
  avatar?: AvatarData;
  deco?: Deco;
  name: string;
  badges?: string[];
  size?: number;
  children?: ReactNode;
  className?: string;
}) {
  const banner = deco.banner && BANNER_RE.test(deco.banner) ? deco.banner : '';
  return (
    <div className={`pf-wrap ${deco.pframe ? 'has-pf' : ''} ${className}`}>
      <div className={`pcard ${banner ? 'has-banner' : ''}`}>
        {banner && <div className="pc-banner" style={{ backgroundImage: `url("${banner}")` }} />}
        <div className={`acct-card acct-hero ${nameplateClass(deco)}`}>
          <NameplateMedia deco={deco} />
          {deco.effect && <span className={`fx fx-${deco.effect}`} />}
          <div className="acct-top">
            <Avatar avatar={avatar} deco={deco} letter={name.replace(/^@/, '')} size={size} />
            <div className="pc-text">
              <div className="pc-name">
                <StyledName as="h1" className="acct-name" text={name} deco={deco} />
                <BadgeRow ids={badges} />
              </div>
              {children}
            </div>
          </div>
        </div>
      </div>
      <ProfileFrame id={deco.pframe} />
    </div>
  );
}

