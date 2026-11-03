import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/**
 * Keeps one part of the page (the top bar, a pop-up, background account work) from blanking the whole site
 * if it crashes: that part just disappears and the error goes to the console.
 */
export class Quiet extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[comvie] ${this.props.name} crashed`, error, info.componentStack);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Clear what this sub-domain saved in the browser (sign-in and account data come back from the account). */
export function resetLocalData() {
  try {
    const keep = ['comvie.session'];
    for (const k of Object.keys(localStorage)) if (k.startsWith('comvie.') && !keep.includes(k)) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch {
    /* storage blocked */
  }
  window.location.replace('/');
}

/** Last line of defence around the whole app: a readable message instead of a white screen. */
export class RootSafe extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[comvie] app crashed', error, info.componentStack);
  }
  render() {
    const e = this.state.error;
    if (!e) return this.props.children;
    return (
      <main className="page pad-top">
        <div className="container mid nf">
          <div className="nf-code small" aria-hidden="true">:(</div>
          <h1 className="title">Something went <span className="accent">wrong</span></h1>
          <p className="muted">The site couldn't start. Reload first. If it keeps happening, reset this site's saved data on this device: your account, lists and progress come back after signing in.</p>
          <div className="nf-btns">
            <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
            <button className="btn ghost" onClick={resetLocalData}>Reset saved data</button>
          </div>
          <details className="nf-details" open><summary>Details</summary><code>{e.message}</code></details>
        </div>
      </main>
    );
  }
}
