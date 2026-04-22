const cacheName = "Sicredi-Conectado-1.4.5";
const contentToCache = [
    "Build/5cdbb3f587dd0672e67451014782113a.loader.js",
    "Build/d811a3da2a44a315bbe32ed1d133ce4a.framework.js",
    "Build/fbbb43c845c9c9fa727ef1aa949f53b6.data",
    "Build/e6e687b7618b6da1c6112b1dfe80581f.wasm",
    "TemplateData/style.css"
];

self.addEventListener('install', function (e) {
    console.log('[Service Worker] Install');
    self.skipWaiting();

    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      console.log('[Service Worker] Caching all: app shell and content');
      await cache.addAll(contentToCache);
    })());
});

self.addEventListener('activate', function (e) {
    console.log('[Service Worker] Activate');
    e.waitUntil((async function () {
        const keys = await caches.keys();
        await Promise.all(
            keys.filter(function (key) { return key !== cacheName; })
                .map(function (key) {
                    console.log('[Service Worker] Removing old cache: ' + key);
                    return caches.delete(key);
                })
        );
        await self.clients.claim();
        console.log('[Service Worker] Now controlling all clients');
    })());
});

self.addEventListener('fetch', function (e) {
    var url = new URL(e.request.url);

    // Never intercept cross-origin requests (API calls, external resources)
    if (url.origin !== self.location.origin) {
        return;
    }

    // Never intercept requests with cache-bust query params (API calls from the game)
    if (url.searchParams.has('_t') || url.searchParams.has('cacheBust')) {
        return;
    }

    // Network-first for navigation requests (index.html)
    // This ensures users always get the latest HTML on page load/refresh
    if (e.request.mode === 'navigate') {
        e.respondWith((async function () {
            try {
                var networkResponse = await fetch(e.request);
                var cache = await caches.open(cacheName);
                cache.put(e.request, networkResponse.clone());
                return networkResponse;
            } catch (err) {
                console.log('[Service Worker] Network failed for navigation, falling back to cache');
                var cachedResponse = await caches.match(e.request);
                return cachedResponse || new Response('Offline - please check your connection', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain' }
                });
            }
        })());
        return;
    }

    // Cache-first for build assets (they have hashes in filenames, so safe to cache)
    e.respondWith((async function () {
        var cachedResponse = await caches.match(e.request);
        if (cachedResponse) {
            return cachedResponse;
        }

        var networkResponse = await fetch(e.request);
        var cache = await caches.open(cacheName);
        cache.put(e.request, networkResponse.clone());
        return networkResponse;
    })());
});
