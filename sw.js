/* 瀹跺涵绠＄悊绯荤粺 - Service Worker
   缂撳瓨搴旂敤澹宠祫婧愶紝鏀寔绂荤嚎浣跨敤 */
const CACHE = 'family-hub-v7';
const CORE = [
  './',
  './index.html?v=13',
  './style.css?v=13',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './app.js?v=13',
  './db.js?v=13',
  './ai.js?v=13',
  './lunar.js?v=13',
  './weather.js?v=13',
  './ui.js?v=13',
  './home.js?v=13',
  './cal.js?v=13',
  './stock.js?v=13',
  './trip.js?v=13',
  './memo.js?v=13',
  './meal.js?v=13',
  './finance.js?v=13',
  './mine.js?v=13'
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
  // 鍙鐞嗗悓婧?GET 璇锋眰
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

