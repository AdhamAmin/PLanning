// DrWEEE Flow Service Worker — Auto-Update + Push Notifications
// Version is auto-stamped at build time. Change this on every deploy:
const CACHE_VERSION = '20260416_1933';
const CACHE_NAME = 'drweee-v' + CACHE_VERSION;

// Install: skip waiting to activate immediately on all devices (including iOS)
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: delete ALL old caches and claim all clients for instant update
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    }).then(() => self.clients.claim()).then(() => {
      // Notify all open tabs/PWA instances to reload with latest version
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((c) => c.postMessage({ type: 'SW_UPDATED' }));
      });
    })
  );
});

// Fetch strategy:
// - Navigation (HTML): Network-first + safe fallback to cached app shell
// - Hashed assets (/assets/): Cache-first (immutable, fast)
// - Other GET: Network-first with cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // HTML navigation — prefer fresh network HTML.
  // If network fails, fall back to cached navigation or cached app shell.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(event.request)
            .then((cached) => cached || caches.match('/index.html'))
            .then((cached) =>
              cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
            )
        )
    );
    return;
  }

  // Hashed assets (Vite adds hash to filenames).
  // Network-first: always try to fetch the latest chunk; fall back to cache
  // only if offline. This prevents stale chunk errors (white screens) after
  // a new deploy while still working offline.
  if (event.request.url.includes('/assets/')) {
    event.respondWith(
      fetch(event.request).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match(event.request).then((cached) =>
        cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
      ))
    );
    return;
  }

  // Everything else — network-first
  event.respondWith(
    fetch(event.request).then((res) => {
      if (res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
      }
      return res;
    }).catch(() =>
      caches.match(event.request).then((cached) =>
        cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
      )
    )
  );
});

// Push notification handler — works even when app is closed
self.addEventListener('push', (event) => {
  let data = { title: 'DrWEEE Flow', body: 'New notification' };
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data.body = event.data.text(); }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'DrWEEE Flow', {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      tag: data.tag || 'drweee-' + Date.now(),
      requireInteraction: true,
      data: { url: data.url || '/' },
      actions: [
        { action: 'open', title: 'Open App' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// Notification click — open or focus the app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes(self.location.origin) && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
