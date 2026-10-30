import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useSection } from '../lib/section';
import type { Section } from '../lib/section';
import { onProd, sectionHome } from '../lib/site';

const ITEMS: { id: Section; label: string }[] = [
  { id: 'cinema', label: 'cinema' },
  { id: 'anime', label: 'anime' }
];

/** Drop-down next to the logo: pick Comvie Cinema or Comvie Anime (each lives on its own sub-domain). */
export default function SiteSwitch() {
  const section = useSection();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  const go = (s: Section) => {
    setOpen(false);
    if (s === section) return;
    const to = sectionHome(s);
    if (onProd()) window.location.assign(to);
    else nav(to);
  };

  return (
    <div className="sw" ref={box}>
      <button className={`sw-btn ${open ? 'open' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label="Switch between Comvie Cinema and Comvie Anime" onClick={() => setOpen((o) => !o)}>
        <span>{section}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {open && (
        <ul className="sw-menu" role="menu">
          {ITEMS.map((it) => (
            <li key={it.id} role="none">
              <button role="menuitem" className={it.id === section ? 'cur' : ''} onClick={() => go(it.id)}>
                <span className="sw-name">com<span>vie</span></span>
                <small>{it.label}</small>
                {it.id === section && <Icon name="check" size={15} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
