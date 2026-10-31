import { useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import { askConfirm } from '../components/Confirm';
import { MangaCard } from '../components/MangaCard';
import { Status } from '../components/Rows';
import { kindOf } from '../lib/manga';
import { useMangaStore } from '../lib/mangaStore';
import type { MangaRead } from '../lib/mangaStore';

type Tab = 'history' | 'list';
const when = (t: number) => new Date(t).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Row({ w, onRemove }: { w: MangaRead; onRemove: () => void }) {
  const to = w.chapterId ? `/manga/read/${w.id}?c=${w.chapterId}&l=${w.lang ?? 'en'}` : `/manga/title/${w.id}`;
  return (
    <div className="hrow">
      <Link to={to} className="hthumb" aria-label={`Continue ${w.title}`}>
        {w.cover ? <img src={w.cover} alt="" loading="lazy" /> : <span className="hthumb-none">{w.title.charAt(0)}</span>}
        <span className="hthumb-tag">{w.label.replace('Chapter', 'Ch.')}</span>
      </Link>
      <div className="hinfo">
        <strong>{w.title}<span className="htag">{w.label}</span></strong>
        <small><Icon name="book" size={13} />{kindOf(w)} · {when(w.at)}</small>
      </div>
      <Link to={to} className="btn small primary hresume"><Icon name="book" size={14} />Continue</Link>
      <button className="x" aria-label={`Remove ${w.title} from history`} onClick={onRemove}><Icon name="trash" size={15} /></button>
    </div>
  );
}

/** The manga section's library: reading history and saved titles (kept on this device). */
export default function MangaLibrary() {
  const store = useMangaStore();
  const [tab, setTab] = useState<Tab>('history');
  const hist = store.history();
  const list = store.list();
  return (
    <main className="page pad-top">
      <div className="container mid">
        <div className="page-head">
          <div>
            <h1 className="title">Manga <span className="accent">Library</span></h1>
            <p className="muted">Your reading history and saved titles (kept on your device).</p>
          </div>
        </div>
        <div className="lib-tabs">
          <div className="pills" style={{ margin: 0, justifyContent: 'flex-start' }} role="tablist">
            <button role="tab" aria-selected={tab === 'history'} className={`pill ${tab === 'history' ? 'on' : ''}`} onClick={() => setTab('history')}><Icon name="history" size={15} />History ({hist.length})</button>
            <button role="tab" aria-selected={tab === 'list'} className={`pill ${tab === 'list' ? 'on' : ''}`} onClick={() => setTab('list')}><Icon name="bookmark" size={15} />Saved ({list.length})</button>
          </div>
          {tab === 'history' && hist.length > 0 && (
            <button className="btn small ghost" onClick={async () => { if (await askConfirm({ title: 'Clear reading history?', text: 'This removes every title from your manga history on this device.', ok: 'Clear history', danger: true })) store.clearHistory(); }}><Icon name="trash" size={15} />Clear History</button>
          )}
        </div>
        {tab === 'history' ? (
          hist.length === 0 ? <Status kind="empty" text="Nothing read yet. Chapters you open show up here so you can continue." /> : (
            <div className="hlist">{hist.map((w) => <Row key={w.id} w={w} onRemove={() => store.removeRead(w.id)} />)}</div>
          )
        ) : list.length === 0 ? (
          <Status kind="empty" text="Nothing saved yet. Tap “Add to Library” on any title." />
        ) : (
          <div className="grid">{list.map((m) => <MangaCard key={m.id} m={m} />)}</div>
        )}
      </div>
    </main>
  );
}
