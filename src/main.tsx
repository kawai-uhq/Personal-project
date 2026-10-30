import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './state';
import { applySmooth } from './lib/perf';
import { importMigration } from './lib/site';
import { applyPrefs, watchSharedPrefs } from './lib/prefs';
import { seedShared } from './lib/shared';
import './styles.css';

importMigration();
seedShared();
applyPrefs();
watchSharedPrefs();
applySmooth();

// No "save image" / right-click menu or dragging pictures out (typing fields keep their normal menu)
const typing = (t: EventTarget | null) => t instanceof Element && !!t.closest('input, textarea, [contenteditable="true"], .selectable');
document.addEventListener('contextmenu', (e) => !typing(e.target) && e.preventDefault());
document.addEventListener('dragstart', (e) => !typing(e.target) && e.preventDefault());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
