import { useEffect, useState } from 'react';
import { DISCORD_URL } from '../lib/links';
import DiscordIcon from './DiscordIcon';
import Icon from './Icon';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

/** "Install App" (when the browser offers it) and a back-to-top button. */
export default function Floating() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [top, setTop] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const onInstalled = () => setInstall(null);
    const onScroll = () => setTop(window.scrollY > 700);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <>
      {install && (
        <button
          className="fab-install"
          onClick={() => {
            void install.prompt().finally(() => setInstall(null));
          }}
        >
          <Icon name="download" size={15} />Install App
        </button>
      )}
      <a className={`fab-discord ${top ? 'up' : ''}`} href={DISCORD_URL} target="_blank" rel="noopener noreferrer" aria-label="Join our Discord server">
        <DiscordIcon size={42} />
      </a>
      {top && (
        <button className="fab-top" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <Icon name="arrowUp" size={20} />
        </button>
      )}
    </>
  );
}
