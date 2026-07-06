// Minimal SW: enables PWA install. Network-first so the live app, CDN scripts,
// and Firebase signaling are never served stale; falls back to cache offline.
// App files under apps/ are LAZY-LOADED by the page and runtime-cached by the
// fetch handler below on first use — they are deliberately not pre-cached here.
const CACHE = 'appmegle-v42';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      // cache same-origin shell files only
      if (e.request.url.startsWith(self.location.origin)) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
