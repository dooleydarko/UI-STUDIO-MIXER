import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { hydrateFromDisk } from './storage/nativeBridge';
import './index.css';

/** Never let a slow or failed disk read keep the window blank. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

// In the desktop app, load persisted files from disk before first render (max 3s).
withTimeout(hydrateFromDisk(), 3000)
  .catch((e) => console.warn('Disk hydrate failed, continuing with local data:', e))
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  });
