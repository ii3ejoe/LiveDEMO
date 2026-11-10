/**
 * Iowa Neighbor LiveDemo service worker
 * - Caches app shell so installed PWA opens with NO network (no browser error page)
 * - When online: prefer network for HTML/JS/JSON (fresh updates)
 * - When offline: serve cached shell + last resources.json if present
 */
const CACHE = 'iowa-neighbor-v4-2-5-31';
const SHELL = [
  './',
  './index.html',
  './about.html',
  './support.html',
  './clear-cache.html',
  './styles.css',
  './app.js',
  './offline.js',
  './pwa.js',
  './version.js',
  './manifest.json',
  './data/resources.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/defaults/other.svg',
  './assets/defaults/food-meals.svg',
  './assets/defaults/shelter.svg',
  './assets/defaults/housing.svg',
  './assets/defaults/healthcare.svg',
  './assets/defaults/family.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        SHELL.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('SW skip cache', url, err);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;
  const isDoc =
    event.request.mode === 'navigate' ||
    path.endsWith('.html') ||
    path.endsWith('/') ||
    path.endsWith('.js') ||
    path.endsWith('.json');

  if (isDoc) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            const idx =
              (await caches.match('./index.html')) ||
              (await caches.match('index.html')) ||
              (await caches.match('/index.html'));
            if (idx) return idx;
          }
          return new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title></head><body style="font-family:system-ui;padding:2rem;max-width:28rem;margin:auto"><h1>You are offline</h1><p>Iowa Neighbor cannot reach the network and has no saved page on this device yet. Connect once, open the site, optional Save for offline, then try again.</p></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((hit) => {
      return (
        hit ||
        fetch(event.request)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => caches.match('./assets/defaults/other.svg'))
      );
    })
  );
});
