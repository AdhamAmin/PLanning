import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AppProvider } from './context/AppContext.jsx'

// ── PWA Auto-Update (iOS + Android + Desktop) ──────────────────────────────
if ('serviceWorker' in navigator) {
  const RELOAD_KEY = 'sw_reload_ts';
  const UPDATE_CHECK_KEY = 'sw_last_update_check';
  const MIN_UPDATE_CHECK_MS = 5 * 60 * 1000;
  const safeReload = () => {
    const last = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);
    const now = Date.now();
    if (now - last > 15000) {
      sessionStorage.setItem(RELOAD_KEY, String(now));
      window.location.reload();
    }
  };

  const requestServiceWorkerUpdate = () => {
    const now = Date.now();
    const lastCheck = parseInt(sessionStorage.getItem(UPDATE_CHECK_KEY) || '0', 10);
    if (now - lastCheck < MIN_UPDATE_CHECK_MS) return;
    sessionStorage.setItem(UPDATE_CHECK_KEY, String(now));
    navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
  };

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // When a new service worker is found
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
              safeReload();
            }
          });
        }
      });

      requestServiceWorkerUpdate();
    }).catch(() => {});

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
      requestServiceWorkerUpdate();
    }
  });

  // Also check on focus (covers iOS switching back to the app)
  window.addEventListener('focus', () => {
    if (navigator.serviceWorker.controller) {
      requestServiceWorkerUpdate();
    }
  });

  // BFCache / iOS: page restored from memory — recheck for new SW
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && navigator.serviceWorker?.controller) {
      requestServiceWorkerUpdate();
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
