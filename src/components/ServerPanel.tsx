import { useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';

export interface ServerItem {
  /** What the page uses to pick this server */
  key: string;
  name: string;
  note: string;
}

interface Props {
  items: ServerItem[];
  current: string;
  onPick: (key: string) => void;
  onReload: () => void;
  /** Servers that have played something on this device (green dot) */
  worked: Set<string>;
  /** Servers already tried for this episode that didn't work (dimmed) */
  failed: Set<string>;
  /** Servers the viewer hid from the list */
  hidden: string[];
  onHidden: (keys: string[]) => void;
  autoSwitch: boolean;
  onAutoSwitch: (v: boolean) => void;
  /** Extra controls under the header (audio language, …) */
  children?: ReactNode;
}

/** The player's server list: a two-column grid beside the episodes, with a "Customize" mode to hide servers. */
export default function ServerPanel({ items, current, onPick, onReload, worked, failed, hidden, onHidden, autoSwitch, onAutoSwitch, children }: Props) {
  const [edit, setEdit] = useState(false);
  const hide = new Set(hidden);
  const shown = edit ? items : items.filter((s) => !hide.has(s.key) || s.key === current);
  const active = items.filter((s) => !hide.has(s.key)).length;

  const toggle = (key: string) => {
    if (hide.has(key)) onHidden(hidden.filter((k) => k !== key));
    else if (active > 1) onHidden([...hidden, key]); // always keep at least one
  };

  return (
    <section className="sv" aria-label="Streaming servers">
      <div className="sv-head">
        <div>
          <h2>Servers</h2>
          <small>{edit ? 'Tap a server to show or hide it' : `${active} active · green = plays for most viewers`}</small>
        </div>
        <button className="sv-icon" onClick={onReload} aria-label="Reload the player" title="Reload the player">
          <Icon name="refresh" size={16} />
        </button>
      </div>

      {children}

      <div className="sv-grid" role={edit ? 'group' : 'radiogroup'} aria-label="Server">
        {shown.map((s) => {
          const on = s.key === current;
          const off = hide.has(s.key);
          if (edit) {
            return (
              <button key={s.key} type="button" role="switch" aria-checked={!off} className={`sv-item edit ${off ? 'off' : ''}`} onClick={() => toggle(s.key)}>
                <span className="sv-txt"><b>{s.name}</b><small>{s.note}</small></span>
                <span className={`sv-check ${off ? '' : 'on'}`}>{!off && <Icon name="check" size={12} />}</span>
              </button>
            );
          }
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={on}
              className={`sv-item ${on ? 'on' : ''} ${failed.has(s.key) && !on ? 'bad' : ''}`}
              onClick={() => onPick(s.key)}
              title={failed.has(s.key) ? `${s.name} didn't work for this one` : s.note}
            >
              <span className="sv-txt"><b>{s.name}</b><small>{s.note}</small></span>
              {failed.has(s.key) && !on ? <span className="sv-dot bad" aria-label="Didn't work" /> : worked.has(s.key) ? <span className="sv-dot" aria-label="Worked before" /> : null}
            </button>
          );
        })}
      </div>

      <div className="sv-foot">
        <label className="sv-auto">
          <button type="button" role="switch" aria-checked={autoSwitch} aria-label="Switch servers automatically" className={`set-switch ${autoSwitch ? 'on' : ''}`} onClick={() => onAutoSwitch(!autoSwitch)}>
            <i />
          </button>
          <span>Auto-switch</span>
        </label>
        <button className={`pill ${edit ? 'on' : ''}`} onClick={() => setEdit((v) => !v)}>
          <Icon name={edit ? 'check' : 'settings'} size={14} />{edit ? 'Done' : 'Customize'}
        </button>
      </div>
    </section>
  );
}
