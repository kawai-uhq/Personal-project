import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

/** Badges next to a name. Tapping one opens a panel with what it means and every badge there is to earn. */
export function BadgeRow({ ids }: { ids?: string[] }) {
  const [open, setOpen] = useState<{ id: string; x: number; y: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !panel.current?.contains(e.target as Node)) setOpen(null);
    };
    const t = window.setTimeout(() => {
      document.addEventListener('pointerdown', close);
      document.addEventListener('keydown', close);
      window.addEventListener('scroll', close as EventListener, { passive: true });
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
      window.removeEventListener('scroll', close as EventListener);
    };
  }, [open]);
  const list = BADGES.filter((b) => ids?.includes(b.id));
  if (!list.length) return null;
  const sel = BADGES.find((b) => b.id === open?.id);
  return (
    <span className="badges">
      {list.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`badge ${open?.id === b.id ? 'on' : ''}`}
          style={{ ['--b' as any]: b.color }}
          title={b.name}
          aria-label={`${b.name}: ${b.how}`}
          aria-expanded={open?.id === b.id}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setOpen(open?.id === b.id ? null : { id: b.id, x: Math.max(8, Math.min(r.left - 12, window.innerWidth - 300)), y: r.bottom + 8 });
          }}
        >
          <Icon name={b.icon} size={13} />
        </button>
      ))}
      {open && sel &&
        createPortal(
          <div className="badge-pop" ref={panel} role="dialog" aria-label="Badges" style={{ left: open.x, top: open.y }}>
            <div className="bp-head" style={{ ['--b' as any]: sel.color }}>
              <span className="badge big"><Icon name={sel.icon} size={18} /></span>
              <div>
                <strong>{sel.name}</strong>
                <small>{sel.how}</small>
              </div>
            </div>
            <p className="bp-title">All badges</p>
            <ul className="bp-list">
              {BADGES.map((b) => {
                const has = ids?.includes(b.id);
                return (
                  <li key={b.id} className={has ? 'has' : ''} style={{ ['--b' as any]: b.color }}>
                    <span className="badge"><Icon name={b.icon} size={12} /></span>
                    <span>
                      <b>{b.name}</b>
                      <small>{b.how}</small>
                    </span>
                    {has && <Icon name="check" size={13} />}
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )}
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

