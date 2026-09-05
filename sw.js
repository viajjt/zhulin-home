/* 家庭管理系统 - Service Worker
   缓存应用壳资源，支持离线使用 */
const CACHE = 'family-hub-v5';
const CORE = [
  './',
  './index.html?v=10',
  './style.css?v=10',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './app.js?v=10',
  './db.js?v=10',
  './lunar.js?v=10',
  './weather.js?v=10',
  './ui.js?v=10',
  './home.js?v=10',
  './cal.js?v=10',
  './stock.js?v=10',
  './trip.js?v=10',
  './memo.js?v=10',
  './meal.js?v=10',
  './mine.js?v=10'
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
  // 只处理同源 GET 请求
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // 导航请求：网络优先，失败回退缓存
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
  // 静态资源：网络优先（确保拿到最新代码），离线回退缓存
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
