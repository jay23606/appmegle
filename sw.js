// Minimal SW: enables PWA install. Network-first so the live app, CDN scripts,
// and Firebase signaling are never served stale; falls back to cache offline.
const CACHE = 'appmegle-v16';
const ASSETS = [
  './', './index.html', './manifest.json',
  './apps/chess.js', './apps/chess.css',
  './apps/checkers.js', './apps/checkers.css',
  './apps/connectfour.js', './apps/connectfour.css',
  './apps/reversi.js', './apps/reversi.css',
  './apps/tictactoe.js', './apps/tictactoe.css',
  './apps/dotsboxes.js', './apps/dotsboxes.css',
  './apps/battleship.js', './apps/battleship.css',
  './apps/hangman.js', './apps/hangman.css',
  './apps/rps.js', './apps/rps.css',
  './apps/icebreakers.js', './apps/icebreakers.css',
  './apps/whiteboard.js', './apps/whiteboard.css',
  './apps/pong.js', './apps/pong.css',
  './apps/airhockey.js', './apps/airhockey.css',
  './apps/tron.js', './apps/tron.css',
  './apps/snake.js', './apps/snake.css',
  './apps/asteroids.js', './apps/asteroids.css',
  './apps/platformracer.js', './apps/platformracer.css',
  './apps/pool.js', './apps/pool.css',
  './apps/uno.js', './apps/uno.css',
  './apps/monopoly.js', './apps/monopoly.css',
  './apps/duckhunt.js', './apps/duckhunt.css',
  './apps/boxing.js', './apps/boxing.css',
  './apps/scrabble.js', './apps/scrabble.css',
  './apps/kart.js', './apps/kart.css',
  './apps/tetris.js', './apps/tetris.css',
  './apps/dirtbike.js', './apps/dirtbike.css',
  './apps/ballroller.js', './apps/ballroller.css',
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
