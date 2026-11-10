/* Iowa Neighbor SW — minimal installable shell */
const CACHE = 'iowa-neighbor-shell-v1';
const SHELL = [
  './index.html',
  './styles.css',
  './app.js',
  './offline.js',
  './pwa.js',
  './version.js',
  './manifest.json',
  './data/resources.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(SHELL.map((u) => cache.add(u).catch(function () {})))
    ).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request).then(function (res) {
      if (res && res.ok && event.request.url.indexOf(self.location.origin) === 0) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(event.request, copy); }).catch(function () {});
      }
      return res;
    }).catch(function () {
      return caches.match(event.request).then(function (hit) {
        return hit || caches.match('./index.html');
      });
    })
  );
});
