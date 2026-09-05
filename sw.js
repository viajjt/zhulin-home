/* 鏈辨灄涔嬪 - Service Worker v17
   缂撳瓨搴旂敤澹宠祫婧愶紝鏀寔绂荤嚎浣跨敤 */
const CACHE = 'family-hub-v13';
const CORE = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './app.js',
  './db.js',
  './ai.js',
  './lunar.js',
  './weather.js',
  './ui.js',
  './voice.js',
  './home.js',
  './calendar.js',
  './stock.js',
  './trip.js',
  './meal.js',
  './finance.js',
  './mine.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(CORE);
    }).then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // 瀵艰埅璇锋眰锛氱綉缁滀紭鍏堬紝澶辫触鍥為€€缂撳瓨
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function(res) {
        const copy = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
        return res;
      }).catch(function() {
        return caches.match('./index.html');
      })
    );
    return;
  }
  // 闈欐€佽祫婧愶細缃戠粶浼樺厛锛堢‘淇濇嬁鍒版渶鏂颁唬鐮侊級锛岀绾垮洖閫€缂撳瓨
  e.respondWith(
    fetch(e.request).then(function(res) {
      if (res && res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});


