import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface State { error: Error | null }

/**
 * If a page crashes, show a friendly "something went wrong" card instead of a blank screen.
 * Changing page (resetKey) clears it. A failed download of a page after a new deploy reloads once.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // after a new deploy, old page files are gone: one automatic reload fixes it
    if (/Loading chunk|dynamically imported module|Importing a module script failed/i.test(error.message)) {
      try {
        if (!sessionStorage.getItem('comvie.reloaded')) {
          sessionStorage.setItem('comvie.reloaded', '1');
          window.location.reload();
          return;
        }
      } catch { /* ignore */ }
    }
    console.error('Comvie page error', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page pad-top">
        <div className="container mid nf">
          <div className="nf-code small" aria-hidden="true">:(</div>
          <h1 className="title">Something went <span className="accent">wrong</span></h1>
          <p className="muted">This page ran into a problem. Reloading usually fixes it.</p>
          <div className="nf-btns">
            <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
            <a className="btn ghost" href="/">Go home</a>
          </div>
          <details className="nf-details"><summary>Details</summary><code>{this.state.error.message}</code></details>
        </div>
      </main>
    );
  }
}
