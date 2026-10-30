import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

interface QA {
  q: string;
  a: ReactNode;
  /** plain text used by the search box */
  text: string;
}
interface Group {
  title: string;
  items: QA[];
}

const qa = (q: string, a: ReactNode, text: string): QA => ({ q, a, text: `${q} ${text}`.toLowerCase() });

const GROUPS: Group[] = [
  {
    title: 'About Comvie',
    items: [
      qa('What is Comvie?', <>Comvie (comfy + movie) is a cosy place to browse trending movies, TV shows and anime, keep lists, and pick up where you left off.</>, 'browse trending movies tv shows anime lists resume'),
      qa('Do you host the movies and shows?', <>No. Comvie doesn't host, upload or store any files. Titles and artwork come from TMDB, and playback comes from third-party players that we label Server 1 to 4.</>, 'host files tmdb third-party players servers')
    ]
  },
  {
    title: 'Playback',
    items: [
      qa('Why isn\'t a title playing?', <>The players belong to other services and some are slow or down at times. Try Reload, pick another server under the player. Very new or obscure titles may not be on every server yet.</>, 'not playing loading stuck error reload server'),
      qa('How do I try another server?', <>Use the <b>Streaming server</b> buttons under the player. If a server takes too long, a bar appears with a one-tap button for the next server.</>, 'switch server change'),
      qa('Why are new releases missing?', <>Streams can take a while to appear on the players after a title is released. Check back later or try a different server.</>, 'new releases missing latest'),
      qa('Does Comvie remember where I stopped?', <>Yes. While you watch, the position is saved on this device, and next time playback starts 5 seconds before where you left off. Finished episodes are marked as watched.</>, 'resume continue where i left timestamp progress'),
      qa('How does skip intro work?', <>Skipping intros works on Server 1 when it knows where the intro is; other servers have their own skip button inside the player.</>, 'skip intro outro')
    ]
  },
  {
    title: 'Library & lists',
    items: [
      qa('Do I need an account?', <>No. Your lists and history are saved on your device. An account is optional and lets your Watchlist, Favorites and history follow you between devices.</>, 'account sign in sync devices'),
      qa('What\'s the difference between Watchlist and Favorites?', <>Watchlist is for things you want to watch. Favorites (the heart) is for titles you love. Both live in My Library.</>, 'watchlist favorites heart library'),
      qa('How do I mark episodes as watched?', <>Tap the tick on an episode row, or use “Mark season watched” above the list. Finished episodes are ticked for you.</>, 'mark watched episodes season'),
      qa('How do reminders work?', <>On a title that hasn't been released yet, tap “Remind me”. It appears under My Library → Reminders, and a dot shows on Library once it's out.</>, 'reminder remind me upcoming release'),
      qa('I forgot my password', <>In the sign-in window choose “Forgot password? Email me a code” and follow the steps.</>, 'forgot password reset code email')
    ]
  },
  {
    title: 'Live TV & app',
    items: [
      qa('Why is a channel not working?', <>Live channels are free public streams. They go offline or get blocked in some regions without notice. Try another channel or press Refresh on the Live TV page.</>, 'live tv channel offline blocked refresh'),
      qa('Can I install Comvie as an app?', <>Yes. Use the Install App button when your browser offers it, or “Add to Home screen” in your browser's menu.</>, 'install app home screen pwa'),
      qa('The site feels slow', <>Try another server, close other tabs, and make sure your browser is up to date. An ad blocker also makes pages lighter.</>, 'slow lag performance')
    ]
  },
  {
    title: 'Privacy & copyright',
    items: [
      qa('This is my copyrighted work', <>Please send a notice as described on the <Link className="link" to="/legal/dmca">DMCA page</Link>.</>, 'copyright dmca takedown remove'),
      qa('What data do you keep?', <>As little as possible: lists and settings stay on your device unless you sign in. Details are in the <Link className="link" to="/legal/privacy">Privacy Policy</Link>.</>, 'data privacy keep store')
    ]
  }
];

export default function Help() {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return GROUPS;
    return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.text.includes(t)) })).filter((g) => g.items.length);
  }, [q]);

  return (
    <main className="page pad-top">
      <div className="container narrow legal help">
        <p className="crumb"><Link to="/" className="link"><Icon name="chevronLeft" size={14} />Home</Link></p>
        <h1 className="title">Help</h1>
        <p className="muted">Most questions are already answered below.</p>
        <label className="help-search">
          <Icon name="search" size={17} />
          <input type="search" placeholder="Search help" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search help" />
        </label>

        {groups.length === 0 && <p className="muted">Nothing matches “{q}”. Try other words, or get in touch below.</p>}
        {groups.map((g) => (
          <section key={g.title} className="help-group">
            <h2>{g.title}</h2>
            {g.items.map((i) => (
              <details key={i.q} className="faq" open={q.trim() ? true : undefined}>
                <summary>
                  <span>{i.q}</span>
                  <Icon name="chevronDown" size={18} />
                </summary>
                <div className="faq-a">{i.a}</div>
              </details>
            ))}
          </section>
        ))}

        <div className="help-contact">
          <b>Can't find what you need?</b>
          <Link to="/contact" className="btn primary small">Get in touch</Link>
        </div>
      </div>
    </main>
  );
}
