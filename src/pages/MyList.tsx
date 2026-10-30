import { useState } from 'react';
import { serverSlug } from '../lib/providers';
import { Link, useSearchParams } from 'react-router-dom';
import { Grid, Status } from '../components/Rows';
import Icon from '../components/Icon';
import { askConfirm } from '../components/Confirm';
import { signInComingSoon } from '../lib/auth';
import { dropReminder, useReminders } from '../lib/reminders';
import { useNewEpisodes } from '../lib/useNewEpisodes';
import { mediaKey } from '../lib/types';
import { IMG, posterSrc } from '../lib/tmdb';
import type { Media, WatchEntry } from '../lib/types';

type Kind = 'all' | 'movie' | 'tv' | 'anime';
import { useApp } from '../state';

type Tab = 'history' | 'list' | 'loved' | 'reminders';
const TABS: Tab[] = ['history', 'list', 'loved', 'reminders'];

const when = (t: number) =>
  new Date(t).toLocaleString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Landscape cover (backdrop, else poster) with an optional tag in the corner, like the CineHall library. */
function Thumb({ m, to, tag, label }: { m: Media; to: string; tag?: string; label: string }) {
  const src = m.backdrop ? `${IMG.still}${m.backdrop}` : m.poster ? posterSrc(m.poster) : null;
  return (
    <Link to={to} className="hthumb" aria-label={label}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span className="hthumb-none">{m.title.charAt(0)}</span>}
      {tag && <span className="hthumb-tag">{tag}</span>}
      <span className="hthumb-play" aria-hidden="true"><Icon name="play" size={18} fill /></span>
    </Link>
  );
}

function HistoryRow({ w, onRemove }: { w: WatchEntry; onRemove: () => void }) {
  const m = w.media;
  const tv = m.type === 'tv' && w.season && w.episode;
  const to = `/watch/${m.type}/${m.id}?s=${w.season ?? 1}&e=${w.episode ?? 1}&p=${serverSlug(w.providerId)}`;
  return (
    <div className="hrow">
      <Thumb m={m} to={to} label={`Resume ${m.title}`} tag={tv ? `S${w.season}E${w.episode}` : m.type === 'tv' ? undefined : 'MOVIE'} />
      <div className="hinfo">
        <strong>
          {m.title}
          {tv ? <span className="htag">Season {w.season} • Episode {w.episode}</span> : null}
        </strong>
        <small><Icon name={m.type === 'tv' ? 'tv' : 'film'} size={13} />{m.type === 'tv' ? 'TV Series' : 'Movie'} · {when(w.watchedAt)}</small>
      </div>
      <Link to={to} className="btn small primary hresume"><Icon name="play" size={14} fill />{tv ? `Resume S${w.season} E${w.episode}` : 'Resume'}</Link>
      <button className="x" aria-label={`Remove ${m.title} from history`} onClick={onRemove}><Icon name="trash" size={15} /></button>
    </div>
  );
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date + 'T00:00:00').getTime() - Date.now()) / 86_400_000);
}

function RemindersPanel() {
  const { list } = useReminders();
  if (!list.length) return <Status kind="empty" text="No reminders yet. Open an upcoming title and tap “Remind me” — it shows up here (and as a dot on Library) when it's released." />;
  return (
    <div className="hlist">
      {list.map((r) => {
        const n = daysUntil(r.date);
        const out = n <= 0;
        return (
          <div className="hrow" key={`${r.media.type}:${r.media.id}`}>
            <Thumb m={r.media} to={`/title/${r.media.type}/${r.media.id}`} label={`Open ${r.media.title}`} tag={out ? 'OUT NOW' : 'SOON'} />
            <div className="hinfo">
              <strong>{r.media.title}</strong>
              <small><Icon name="calendar" size={13} />{new Date(r.date + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · {out ? 'Out now' : n === 1 ? 'Tomorrow' : `In ${n} days`}</small>
            </div>
            <Link to={`/title/${r.media.type}/${r.media.id}`} className={`btn small ${out ? 'primary' : 'ghost'} hresume`}>{out ? 'Watch now' : 'Details'}</Link>
            <button className="x" aria-label={`Remove reminder for ${r.media.title}`} onClick={() => dropReminder(r.media)}><Icon name="trash" size={15} /></button>
          </div>
        );
      })}
    </div>
  );
}

export default function MyList({ anime = false }: { anime?: boolean }) {
  const { favorites, loved, history, removeWatch, session, openAuth } = useApp();
  const fresh = useNewEpisodes();
  const [qs] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (TABS.includes(qs.get('tab') as Tab) ? (qs.get('tab') as Tab) : 'history'));
  const { due } = useReminders();
  const [kind, setKind] = useState<Kind>(anime ? 'anime' : 'all');
  const keep = (m: Media) => kind === 'all' || (kind === 'anime' ? !!m.anime : m.type === kind);
  const everything = [...new Map([...history.map((w) => w.media), ...favorites, ...loved].map((m) => [mediaKey(m), m])).values()];
  const count = (k: Kind) => everything.filter((m) => k === 'all' || (k === 'anime' ? !!m.anime : m.type === k)).length;
  const hist = history.filter((w) => keep(w.media));
  const wl = favorites.filter(keep);
  const lv = loved.filter(keep);

  return (
    <main className="page pad-top">
      <div className="container mid">
        <div className="page-head">
          <div>
            <h1 className="title">My <span className="accent">Library</span></h1>
            <p className="muted">Manage your watch history, watchlist and favorites{session ? '.' : ' (saved locally on your device).'}</p>
          </div>
          <div className="seg lib-kind" role="tablist" aria-label="Show">
            {([['all', 'All'], ['movie', 'Movies'], ['tv', 'TV Shows'], ['anime', 'Anime']] as [Kind, string][]).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{label} ({count(k)})</button>
            ))}
          </div>
        </div>

        <div className="lib-tabs">
          <div className="pills" style={{ margin: 0, justifyContent: 'flex-start' }} role="tablist">
            <button role="tab" aria-selected={tab === 'history'} className={`pill ${tab === 'history' ? 'on' : ''}`} onClick={() => setTab('history')}><Icon name="history" size={15} />History ({hist.length})</button>
            <button role="tab" aria-selected={tab === 'list'} className={`pill ${tab === 'list' ? 'on' : ''}`} onClick={() => setTab('list')}><Icon name="bookmark" size={15} />Watchlist ({wl.length})</button>
            <button role="tab" aria-selected={tab === 'loved'} className={`pill ${tab === 'loved' ? 'on' : ''}`} onClick={() => setTab('loved')}><Icon name="heart" size={15} />Favorites ({lv.length})</button>
            <button role="tab" aria-selected={tab === 'reminders'} className={`pill ${tab === 'reminders' ? 'on' : ''}`} onClick={() => setTab('reminders')}><Icon name="bell" size={15} />Reminders{due > 0 && <i className="nav-dot inline" />}</button>
          </div>
          {tab === 'history' && hist.length > 0 && (
            <button
              className="btn small ghost"
              onClick={async () => {
                const yes = await askConfirm({ title: 'Clear watch history?', text: 'This removes every movie and show from your watch history.', ok: 'Clear history', danger: true });
                if (yes) hist.forEach((w) => removeWatch(mediaKey(w.media)));
              }}
            >
              <Icon name="trash" size={15} />Clear History
            </button>
          )}
        </div>

        {tab === 'history' ? (
          hist.length === 0 ? (
            <Status kind="empty" text="Nothing watched yet. Titles you play show up here so you can resume them." />
          ) : (
            <div className="hlist">
              {hist.map((w) => (
                <HistoryRow key={mediaKey(w.media)} w={w} onRemove={() => removeWatch(mediaKey(w.media))} />
              ))}
            </div>
          )
        ) : tab === 'list' ? (
          wl.length === 0 ? (
            <Status kind="empty" text="Nothing here yet. Tap “Watchlist” on any title to save it for later." />
          ) : (
            <Grid items={wl} fresh={fresh} />
          )
        ) : tab === 'reminders' ? (
          <RemindersPanel />
        ) : lv.length === 0 ? (
          <Status kind="empty" text="No favorites yet. Tap the heart on titles you love." />
        ) : (
          <Grid items={lv} fresh={fresh} />
        )}

        {!session && (
          <p className="muted note">
            {signInComingSoon ? (
              'Saved on this device only. Accounts are coming soon.'
            ) : (
              <>Saved on this device only. <button className="link" onClick={openAuth}>Sign in</button> to keep it if you clear your browser or switch devices.</>
            )}
          </p>
        )}
      </div>
    </main>
  );
}
