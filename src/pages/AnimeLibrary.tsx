import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimeCard } from '../components/AnimeCard';
import Icon from '../components/Icon';
import { Status } from '../components/Rows';
import { useAnimeStore } from '../lib/animeStore';
import type { AnimeWatch } from '../lib/animeStore';

type Tab = 'history' | 'list' | 'loved';

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Row({ w, onRemove }: { w: AnimeWatch; onRemove: () => void }) {
  const to = `/anime/watch/${w.id}?e=${w.episode}&p=${w.server}&l=${w.lang}`;
  return (
    <div className="hrow">
      <Link to={to} className="hthumb" aria-label={`Resume ${w.title}`}>
        {w.cover ? <img src={w.cover} alt="" loading="lazy" /> : <span className="hthumb-none">{w.title.charAt(0)}</span>}
        <span className="hthumb-tag">EP {w.episode}</span>
        <span className="hthumb-play" aria-hidden="true"><Icon name="play" size={18} fill /></span>
      </Link>
      <div className="hinfo">
        <strong>{w.title}<span className="htag">Episode {w.episode}</span></strong>
        <small><Icon name="flame" size={13} />Anime · {when(w.at)}</small>
      </div>
      <Link to={to} className="btn small primary hresume"><Icon name="play" size={14} fill />Resume EP {w.episode}</Link>
      <button className="x" aria-label={`Remove ${w.title} from history`} onClick={onRemove}><Icon name="trash" size={15} /></button>
    </div>
  );
}

/** The anime section's library: history, watchlist and favorites (kept on this device). */
export default function AnimeLibrary() {
  const store = useAnimeStore();
  const [tab, setTab] = useState<Tab>('history');
  const hist = store.history();
  const list = store.list();
  const loved = store.loved();
  return (
    <main className="page pad-top">
      <div className="container mid">
        <div className="page-head">
          <div>
            <h1 className="title">Anime <span className="accent">Library</span></h1>
            <p className="muted">Your anime history, watchlist and favorites (saved locally on your device).</p>
          </div>
        </div>
        <div className="lib-tabs">
          <div className="pills" style={{ margin: 0, justifyContent: 'flex-start' }} role="tablist">
            <button role="tab" aria-selected={tab === 'history'} className={`pill ${tab === 'history' ? 'on' : ''}`} onClick={() => setTab('history')}><Icon name="history" size={15} />History ({hist.length})</button>
            <button role="tab" aria-selected={tab === 'list'} className={`pill ${tab === 'list' ? 'on' : ''}`} onClick={() => setTab('list')}><Icon name="bookmark" size={15} />Watchlist ({list.length})</button>
            <button role="tab" aria-selected={tab === 'loved'} className={`pill ${tab === 'loved' ? 'on' : ''}`} onClick={() => setTab('loved')}><Icon name="heart" size={15} />Favorites ({loved.length})</button>
          </div>
          {tab === 'history' && hist.length > 0 && (
            <button className="btn small ghost" onClick={() => { if (window.confirm('Clear your anime watch history?')) store.clearHistory(); }}>
              <Icon name="trash" size={15} />Clear History
            </button>
          )}
        </div>
        {tab === 'history' ? (
          hist.length === 0 ? <Status kind="empty" text="Nothing watched yet. Episodes you play show up here so you can resume them." /> : (
            <div className="hlist">{hist.map((w) => <Row key={w.id} w={w} onRemove={() => store.removeWatch(w.id)} />)}</div>
          )
        ) : (tab === 'list' ? list : loved).length === 0 ? (
          <Status kind="empty" text={tab === 'list' ? 'Nothing here yet. Tap “Watchlist” on any anime to save it for later.' : 'No favorites yet. Tap the heart on anime you love.'} />
        ) : (
          <div className="grid">{(tab === 'list' ? list : loved).map((a) => <AnimeCard key={a.id} a={a} />)}</div>
        )}
      </div>
    </main>
  );
}
