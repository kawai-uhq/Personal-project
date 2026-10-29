import { Children, isValidElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as KeyEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';

/**
 * A drop-down that looks like the rest of the site (the browser's own list can't be styled).
 * Drop-in for <select>: give it <option value="…">label</option> children and an onChange that reads e.target.value.
 */
interface Props {
  value: string | number;
  onChange: (e: { target: { value: string } }) => void;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

const text = (n: ReactNode): string =>
  Children.toArray(n).map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : isValidElement(c) ? text((c.props as { children?: ReactNode }).children) : '')).join('');

interface Opt { value: string; label: string }

function collect(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string | number; children?: ReactNode };
    if (c.type === 'option') out.push({ value: String(p.value ?? text(p.children)), label: text(p.children) });
    else collect(p.children, out);
  });
  return out;
}

export default function Select({ value, onChange, children, className = '', disabled, 'aria-label': aria }: Props) {
  const opts = useMemo(() => collect(children), [children]);
  const cur = opts.find((o) => o.value === String(value));
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; max: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 200 && above > below;
    setPos({ left: r.left, top: up ? r.top - 6 : r.bottom + 6, width: r.width, up, max: Math.max(140, Math.min(320, up ? above : below)) });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (list.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const move = (e: Event) => {
      if (list.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    window.addEventListener('scroll', move, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', move, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  // keep the highlighted row in view
  useEffect(() => {
    if (!open) return;
    (list.current?.children[hi] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' });
  }, [open, hi, pos]);

  const show = () => {
    if (disabled) return;
    setHi(Math.max(0, opts.findIndex((o) => o.value === String(value))));
    setOpen(true);
  };
  const pick = (o: Opt) => {
    setOpen(false);
    btn.current?.focus();
    if (o.value !== String(value)) onChange({ target: { value: o.value } });
  };

  const onKey = (e: KeyEvent) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setHi((i) => Math.min(opts.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Home') { e.preventDefault(); setHi(0); }
    else if (e.key === 'End') { e.preventDefault(); setHi(opts.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (opts[hi]) pick(opts[hi]); }
    else if (e.key === 'Tab') setOpen(false);
    else if (e.key.length === 1) {
      const k = e.key.toLowerCase();
      const n = opts.findIndex((o, i) => i > hi && o.label.toLowerCase().startsWith(k));
      const m = n >= 0 ? n : opts.findIndex((o) => o.label.toLowerCase().startsWith(k));
      if (m >= 0) setHi(m);
    }
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`${className} dd-btn ${open ? 'open' : ''}`}
        disabled={disabled}
        aria-label={aria}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKey}
      >
        <span className="dd-val">{cur?.label ?? ''}</span>
        <Icon name="chevronDown" size={16} className="dd-chev" />
      </button>
      {open && pos &&
        createPortal(
          <ul
            ref={list}
            className={`dd-list ${pos.up ? 'up' : ''}`}
            role="listbox"
            aria-label={aria}
            style={{ left: pos.left, top: pos.top, minWidth: pos.width, maxHeight: pos.max }}
          >
            {opts.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === String(value)}
                className={`${o.value === String(value) ? 'sel' : ''} ${i === hi ? 'hi' : ''}`}
                onMouseEnter={() => setHi(i)}
                onClick={() => pick(o)}
              >
                <span>{o.label}</span>
                {o.value === String(value) && <Icon name="check" size={15} />}
              </li>
            ))}
          </ul>,
          document.body
        )}
    </>
  );
}
