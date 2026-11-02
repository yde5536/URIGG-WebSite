// 앱처럼 설치했을 때 쓰는 서비스 워커.
// 페이지와 데이터는 늘 네트워크를 먼저 쓰고(최신 우선), 끊겼을 때만 저장해 둔 것을 보여 준다.
// 이름에 해시가 붙은 파일(캘린더 위젯 assets)과 이미지는 저장본을 먼저 쓴다.
const CACHE = 'urigg-v2';
const SHELL = ['/', '/css/base.css', '/css/scenes.css', '/css/theme-glass.css', '/js/main.js', '/js/scenes.js', '/js/dday.js', '/js/osk.js', '/images/favicon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  const cacheFirst = url.pathname.startsWith('/calendar/assets/') || url.pathname.startsWith('/images/');
  if (cacheFirst) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
      return res;
    })));
    return;
  }
  // 네트워크 먼저, 실패하면 저장본
  e.respondWith(fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then((hit) => hit || caches.match('/'))));
});
