import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';
import { askConfirm } from './Confirm';
import { animeStore } from '../lib/animeStore';
import { mangaStore } from '../lib/mangaStore';
import { ACCENTS, DEFAULT_PREFS, exportData, importData, setPrefs, usePrefs } from '../lib/prefs';
import type { Prefs } from '../lib/prefs';
import { store } from '../lib/storage';
import { mediaKey } from '../lib/types';
import { useApp } from '../state';

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg set-seg" role="radiogroup" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`set-switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

function Row({ title, hint, children, stack }: { title: string; hint?: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`set-row ${stack ? 'stack' : ''}`}>
      <div className="set-label">
        <strong>{title}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {children}
    </div>
  );
}

function Slider({ value, min, max, unit, onChange, label }: { value: number; min: number; max: number; unit: string; onChange: (v: number) => void; label: string }) {
  return (
    <div className="set-slider">
      <input type="range" min={min} max={max} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <span>{value}{unit}</span>
    </div>
  );
}

/** Appearance, layout, playback and data settings (saved on this device). */
export default function SettingsPanel() {
  const p = usePrefs();
  const set = (v: Partial<Prefs>) => setPrefs(v);
  const { history, removeWatch, favorites, toggleFavorite } = useApp();
  const [remember, setRemember] = useState(store.getRemember());
  const [autoplay, setAutoplay] = useState(store.getAutoplay());
  const [skip, setSkip] = useState(store.getAutoskip());
  const [shield, setShield] = useState(store.getProtect());
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const flash = (t: string) => {
    setNote(t);
    window.setTimeout(() => setNote(''), 3000);
  };

  const doExport = () => {
    const blob = new Blob([exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `comvie-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    flash('Backup downloaded.');
  };

  const doImport = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = importData(await f.text());
      const yes = await askConfirm({ title: 'Backup restored', text: `${n} items were restored. Reload the page to see everything?`, ok: 'Reload', icon: 'check' });
      if (yes) window.location.reload();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't read that file.");
    }
    if (file.current) file.current.value = '';
  };

  const clearHistory = async () => {
    const yes = await askConfirm({ title: 'Clear all history?', text: 'This removes Continue Watching and Continue Reading for movies, shows, anime and manga.', ok: 'Clear history', danger: true });
    if (!yes) return;
    history.forEach((w) => removeWatch(mediaKey(w.media)));
    animeStore.clearHistory();
    mangaStore.clearHistory();
    flash('History cleared.');
  };

  const clearList = async () => {
    const yes = await askConfirm({ title: 'Clear My List?', text: 'This removes everything from your watchlists and saved manga. Favorites stay.', ok: 'Clear My List', danger: true });
    if (!yes) return;
    favorites.forEach((m) => toggleFavorite(m));
    animeStore.list().forEach((a) => animeStore.toggle('list', a));
    mangaStore.list().forEach((m) => mangaStore.toggleList(m));
    flash('My List cleared.');
  };

  return (
    <div className="settings">
      <section className="set-card">
        <h3>Appearance</h3>
        <Row title="Theme" stack>
          <Seg label="Theme" value={p.theme} onChange={(v) => set({ theme: v })} options={[['dark', 'Dark'], ['light', 'Light (beta)']]} />
        </Row>
        <Row title="Accent colour" stack>
          <div className="set-swatches" role="radiogroup" aria-label="Accent colour">
            {ACCENTS.map((a) => (
              <button key={a.id || 'auto'} type="button" role="radio" aria-checked={p.accent === a.id} aria-label={a.label} title={a.label} className={p.accent === a.id ? 'on' : ''} style={{ background: a.color }} onClick={() => set({ accent: a.id })} />
            ))}
          </div>
        </Row>
        <Row title="Background" hint="Behind the home pages" stack>
          <Seg label="Background" value={p.background} onChange={(v) => set({ background: v })} options={[['artwork', 'Artwork'], ['gradient', 'Gradient'], ['plain', 'Plain']]} />
        </Row>
      </section>

      <section className="set-card">
        <h3>Glass</h3>
        <Row title="Blur" stack><Slider label="Blur" value={p.blur} min={0} max={40} unit="px" onChange={(v) => set({ blur: v })} /></Row>
        <Row title="Frosting" stack><Slider label="Frosting" value={p.frost} min={5} max={100} unit="%" onChange={(v) => set({ frost: v })} /></Row>
        <Row title="Corner radius" stack><Slider label="Corner radius" value={p.radius} min={0} max={28} unit="px" onChange={(v) => set({ radius: v })} /></Row>
      </section>

      <section className="set-card">
        <h3>Layout</h3>
        <Row title="Poster size" stack>
          <Seg label="Poster size" value={p.poster} onChange={(v) => set({ poster: v })} options={[['small', 'Small'], ['medium', 'Medium'], ['large', 'Large']]} />
        </Row>
        <Row title="Heading style" stack>
          <Seg label="Heading style" value={p.heading} onChange={(v) => set({ heading: v })} options={[['rounded', 'Rounded'], ['serif', 'Serif']]} />
        </Row>
        <Row title="Featured banner" hint="Large spotlight at the top of Home"><Switch label="Featured banner" on={p.banner} onChange={(v) => set({ banner: v })} /></Row>
        <Row title="Show ratings"><Switch label="Show ratings" on={p.ratings} onChange={(v) => set({ ratings: v })} /></Row>
        <Row title="Show titles under posters"><Switch label="Show titles under posters" on={p.titles} onChange={(v) => set({ titles: v })} /></Row>
        <Row title="Animations" hint="Background drift and transitions"><Switch label="Animations" on={p.motion} onChange={(v) => set({ motion: v })} /></Row>
      </section>

      <section className="set-card">
        <h3>Playback</h3>
        <Row title="Remember what I watch" hint="Powers Continue Watching and Continue Reading">
          <Switch label="Remember what I watch" on={remember} onChange={(v) => { setRemember(v); store.saveRemember(v); }} />
        </Row>
        <Row title="Autoplay next episode"><Switch label="Autoplay next episode" on={autoplay} onChange={(v) => { setAutoplay(v); store.saveAutoplay(v); }} /></Row>
        <Row title="Skip intros" hint="On servers that know where the intro is"><Switch label="Skip intros" on={skip} onChange={(v) => { setSkip(v); store.saveAutoskip(v); }} /></Row>
        <Row title="Pop-up protection" hint="Blocks pop-ups and redirects from the movie & TV player where the server allows it">
          <Switch label="Pop-up protection" on={shield} onChange={(v) => { setShield(v); store.saveProtect(v); }} />
        </Row>
      </section>

      <section className="set-card">
        <h3>Data</h3>
        <div className="set-grid">
          <button className="btn ghost" onClick={doExport}><Icon name="download" size={15} />Export</button>
          <button className="btn ghost" onClick={() => file.current?.click()}><Icon name="upload" size={15} />Import</button>
          <button className="btn ghost" onClick={() => void clearHistory()}><Icon name="trash" size={15} />Clear history</button>
          <button className="btn ghost" onClick={() => void clearList()}><Icon name="trash" size={15} />Clear My List</button>
        </div>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => void doImport(e.target.files?.[0])} />
        <p className="muted small">Export includes your settings, history and lists from this site. It never includes your sign-in.</p>
        {note && <p className="set-note" role="status">{note}</p>}
        <button
          className="btn ghost wide"
          onClick={async () => {
            if (await askConfirm({ title: 'Reset appearance?', text: 'Theme, colours, glass and layout go back to the defaults.', ok: 'Reset', icon: 'refresh' })) setPrefs(null);
          }}
          disabled={JSON.stringify(p) === JSON.stringify(DEFAULT_PREFS)}
        >
          <Icon name="refresh" size={15} />Reset appearance
        </button>
      </section>
    </div>
  );
}
