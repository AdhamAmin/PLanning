import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AppProvider } from './context/AppContext.jsx'

// ── PWA Auto-Update (iOS + Android + Desktop) ──────────────────────────────
if ('serviceWorker' in navigator) {
  // Guard against infinite reload loops
  const RELOAD_KEY = 'sw_reload_ts';
  const safeReload = () => {
    const last = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
    const now = Date.now();
    // Only reload if last reload was more than 5 seconds ago
    if (now - last > 5000) {
      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Check for updates often so installed PWA picks up new deploys quickly
      setInterval(() => reg.update(), 30000);

      // When a new service worker is found
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              safeReload();
            }
          });
        }
      });
    }).catch(() => {});

    // Listen for SW_UPDATED message from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'SW_UPDATED') {
        safeReload();
      }
    });

    // iOS: when the controller changes (new SW takes over), reload
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        safeReload();
      }
    });
  });

  // iOS PWA: check for updates when app comes back to foreground
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }
  });

  // Also check on focus (covers iOS switching back to the app)
  window.addEventListener('focus', () => {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }
  });

  // BFCache / iOS: page restored from memory — recheck for new SW
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then((reg) => reg.update());
    }
  });
}

// ── Render App ──────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
)
