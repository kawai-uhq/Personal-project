import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../components/Icon';
import type { IconName } from '../components/Icon';

const EMAIL = (import.meta.env.VITE_CONTACT_EMAIL as string | undefined)?.trim() ?? '';
const UPDATED = 'October 31, 2026';
const UPDATED_SHORT = 'October 2026';

function Reach() {
  return (
    <>
      <Link className="link" to="/contact">our Contact page</Link>
      {EMAIL && (
        <>
          {' '}or <a className="link" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </>
      )}
    </>
  );
}

function Page({ title, updated = true, children }: { title: string; updated?: boolean; children: ReactNode }) {
  return (
    <main className="page pad-top">
      <div className="container narrow legal">
        <p className="crumb"><Link to="/" className="link"><Icon name="chevronLeft" size={14} />Home</Link></p>
        <h1 className="title">{title}</h1>
        {updated && <p className="muted small lupdated">Last updated: {UPDATED}</p>}
        {children}
      </div>
    </main>
  );
}

type Tone = 'ok' | 'warn' | 'info' | 'accent';

/** Page shell used by the Terms, Privacy and DMCA pages: back link, icon tile, title, subtitle, then cards. */
function DocPage({ icon, title, sub, children }: { icon: IconName; title: string; sub: string; children: ReactNode }) {
  return (
    <main className="page pad-top">
      <div className="container doc">
        <p className="doc-back"><Link to="/"><Icon name="arrowLeft" size={14} />Back to Home</Link></p>
        <header className="doc-head">
          <span className="doc-tile" aria-hidden="true"><Icon name={icon} size={22} /></span>
          <div>
            <h1>{title}</h1>
            <p>{sub} <i>•</i> Last updated: {UPDATED_SHORT}</p>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function Card({ n, title, icon, tone = 'accent', children }: { n: number; title: string; icon?: IconName; tone?: Tone; children: ReactNode }) {
  return (
    <section className="doc-card">
      <h2>{icon && <span className={`doc-ico ${tone}`}><Icon name={icon} size={18} /></span>}{n}. {title}</h2>
      {children}
    </section>
  );
}

export function About() {
  return (
    <Page title="About Comvie" updated={false}>
      <p>Comvie (comfy + movie) is a cosy place to browse trending movies, TV shows and anime, keep a list of what you want to watch, and pick up where you left off.</p>
      <h2>What Comvie is, and isn't</h2>
      <ul>
        <li>Titles, posters, descriptions, cast and trailers come from <strong>TMDB</strong> and YouTube. This product uses the TMDB API but is not endorsed or certified by TMDB.</li>
        <li><strong>Comvie does not host, store or upload any video files.</strong> When you press Play, the site opens a player provided by a third party. What that player shows is controlled by its owner.</li>
        <li>Live TV lists free, publicly available channels gathered from an open public directory. Channels can go offline or be blocked in your region at any time.</li>
      </ul>
      <h2>Contact</h2>
      <p>Questions or feedback: <Reach />.</p>
    </Page>
  );
}

export function Terms() {
  return (
    <DocPage icon="fileText" title="Terms of Service" sub="User guidelines, platform rules & service conditions">
      <Card n={1} title="Acceptance of Terms" icon="checkCircle" tone="ok">
        <p>By accessing, browsing, or using <b>Comvie (comvie.lol)</b>, you acknowledge that you have read, understood, and agreed to be bound by these Terms of Service. If you do not agree to these terms, please stop using the service immediately.</p>
      </Card>
      <Card n={2} title="Nature of the Platform" icon="shield" tone="info">
        <p>Comvie works strictly as a media index, directory, and navigation interface for publicly accessible third-party streams and metadata.</p>
        <ul>
          <li>Comvie does not upload, host, maintain, or broadcast any video or audio files.</li>
          <li>All streaming content is delivered directly from independent third-party servers.</li>
          <li>We make no warranties regarding the availability, uninterrupted uptime, or legality of third-party video hosts in your specific jurisdiction.</li>
        </ul>
      </Card>
      <Card n={3} title="Permitted Use & Prohibited Conduct" icon="alert" tone="warn">
        <p>When using Comvie, you explicitly agree not to:</p>
        <ul>
          <li>Attempt to disrupt, overload, or attack our servers, API endpoints, or rate-limiting systems.</li>
          <li>Use malicious automated bots, scrapers, or exploits to compromise user accounts or platform stability.</li>
          <li>Circumvent or tamper with security measures, headers, or client integrity checks.</li>
          <li>Violate any local, national, or international laws concerning intellectual property or computer security.</li>
        </ul>
      </Card>
      <Card n={4} title="Your Responsibility">
        <p>You use third-party content <b>at your own risk</b>, for personal, non-commercial entertainment. You are responsible for following the laws where you live, including copyright law. Comvie is not liable for infringement, malware, popups, or other harm that comes from third-party players or sites.</p>
      </Card>
      <Card n={5} title="Accounts">
        <p>Accounts are optional. If you create one, keep your sign-in details safe and do not share them. We may suspend accounts that abuse the service or try to break, overload, or reverse-engineer it.</p>
      </Card>
      <Card n={6} title="Disclaimer of Warranties & Limitation of Liability">
        <p>Comvie is provided on an “AS IS” and “AS AVAILABLE” basis without warranties of any kind, whether express or implied. Under no circumstances shall Comvie or its contributors be held liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use this platform.</p>
      </Card>
      <Card n={7} title="Changes to These Terms">
        <p>We may update these terms at any time. If you keep using Comvie after a change, you accept the new terms.</p>
      </Card>
      <Card n={8} title="Questions or Inquiries" icon="help" tone="accent">
        <p>For any questions regarding these Terms of Service, please reach out through <Reach />.</p>
      </Card>
    </DocPage>
  );
}

export function Privacy() {
  return (
    <DocPage icon="lock" title="Privacy Policy" sub="Data protection, cookie practices & privacy standards">
      <Card n={1} title="Our Privacy Philosophy" icon="shield" tone="accent">
        <p>At <b>Comvie (comvie.lol)</b>, we believe in user privacy and data minimization. You do not need to register, sign up with identity documents, or provide your real name, physical address, or phone number to use our public catalog and free media browsing.</p>
      </Card>
      <Card n={2} title="Information We Collect" icon="database" tone="ok">
        <p><b>A. Technical & Operational Logs:</b> Like virtually all web services, our hosting and security providers automatically record standard, non-identifying technical data when you connect. This includes your IP address, browser user-agent, operating system, requested page URL, and timestamp. These logs are used for DDoS mitigation, traffic management, rate-limiting, and error diagnostics.</p>
        <p><b>B. Browser Local Storage:</b> To give you a seamless personalized experience, Comvie uses your browser's local storage to save your watch progress, watchlist, favorites, reminders, recent searches, and settings. This data stays on your device and is not sold or shared with third parties. Clearing your browser data removes it.</p>
        <p><b>C. Optional Accounts:</b> If you choose to create an account, we store your email address and your watchlist, favorites, and watch history so they follow you between devices. Sign-in is handled by our authentication provider, Supabase. If you connect AniList, Comvie stores a sign-in token for it in your browser so it can read your lists and, if you allow it, update your progress; disconnecting removes it. To delete your account and its data, reach us through <Reach />.</p>
      </Card>
      <Card n={3} title="Cookies and Advertising" icon="cookie" tone="warn">
        <p>Comvie shows no ads and runs no analytics or tracking. The few cookies we set are needed for the site to work, and are shared by cinema.comvie.lol, anime.comvie.lol and manga.comvie.lol:</p>
        <p><b>cv_session</b>: keeps you signed in (only if you have an account). <b>cv_prefs</b>: your appearance and playback settings. <b>cv_anilist</b>: your AniList connection (only if you connect it). <b>cv_consent</b>: your cookie choice. Your lists, history and progress are kept in your browser's local storage, and in your account if you're signed in.</p>
        <p><b>Third-party media:</b> video players come from other streaming sites and trailers from YouTube; those sites may set their own cookies under their own policies. If you choose <b>Essential only</b> in the cookie notice, players and trailers wait until you tap to load them. You can change this any time with <b>Cookie settings</b> at the bottom of every page.</p>
      </Card>
      <Card n={4} title="External Links & Third-Party Providers" icon="globe" tone="info">
        <p>Our site contains embedded players and links to third-party streaming resources. Titles, posters, and descriptions come from TMDB and AniList, trailers from YouTube, and live channels from an open public directory, so your browser contacts those services directly. Comvie is not responsible for the privacy practices, content, or policies of external sites. Once you navigate away or interact with external video players, you are subject to the terms of those platforms.</p>
      </Card>
      <Card n={5} title="Contact Us Regarding Privacy" icon="mail" tone="accent">
        <p>If you have any questions or concerns regarding our privacy practices, please contact us through <Reach />.</p>
      </Card>
    </DocPage>
  );
}

export function Dmca() {
  return (
    <DocPage icon="shield" title="DMCA Disclaimer & Copyright Policy" sub="Digital Millennium Copyright Act Compliance">
      <Card n={1} title="Non-Hosting & Aggregator Disclosure" icon="checkCircle" tone="ok">
        <p><b>Comvie (comvie.lol)</b> operates strictly as an informational media index, catalog, and search navigation directory. We do <b>not host, store, stream, or upload</b> any media files, video streams, or copyrighted content onto our own servers.</p>
        <p>All video players, streams, and media embeds accessible on this website are aggregated from and hosted by independent, third-party media hosting services and video sharing websites that are completely unaffiliated with Comvie.</p>
      </Card>
      <Card n={2} title="Intellectual Property Rights & DMCA Compliance" icon="alert" tone="warn">
        <p>Comvie respects the intellectual property rights of creators and copyright holders and complies with the provisions of Title 17, United States Code, Section 512, commonly known as the <i>Digital Millennium Copyright Act (DMCA)</i>.</p>
        <p>It is our policy to respond promptly to clear, formal notices of alleged copyright infringement. Because we do not control or host external files, the most effective resolution is often contacting the host directly. However, we will disable links and remove indexed references to infringing material upon receipt of a valid DMCA takedown notice.</p>
      </Card>
      <Card n={3} title="Filing a Takedown Notice">
        <p>To request the removal of indexed links or content references, please submit a written communication that includes the following information:</p>
        <ul>
          <li>Identification of the copyrighted work claimed to have been infringed, or a representative list of such works.</li>
          <li>Identification of the material that is claimed to be infringing, including the specific URL(s) on Comvie where it is referenced.</li>
          <li>Sufficient contact information allowing us to contact the complaining party (name, physical address, telephone number, and electronic mail address).</li>
          <li>A statement that the complaining party has a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law.</li>
          <li>A statement that the information in the notification is accurate, and under penalty of perjury, that the complaining party is authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.</li>
          <li>A physical or electronic signature of a person authorized to act on behalf of the owner of the copyright interest.</li>
        </ul>
      </Card>
      <Card n={4} title="Designated DMCA Agent Contact" icon="mail" tone="accent">
        <p>Please direct all copyright complaints and formal DMCA notices to our designated contact point:</p>
        <div className="doc-agent">
          <div>
            <strong>DMCA & Legal Compliance Team</strong>
            <small>We review valid notices promptly</small>
          </div>
          <Link to="/contact" className="doc-btn">Contact us</Link>
        </div>
        {EMAIL && <p className="doc-mail">Or email <a className="link" href={`mailto:${EMAIL}`}>{EMAIL}</a></p>}
      </Card>
    </DocPage>
  );
}
