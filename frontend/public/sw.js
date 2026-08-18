const CACHE_NAME = 'harvester-owner-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json'
];

// Install: Cache critical shell assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-First fallback to Cache
self.addEventListener('fetch', (e) => {
  // Only handle GET requests and ignore WebSocket/Hot Reload connections
  if (e.request.method !== 'GET' || e.request.url.includes('ws') || e.request.url.includes('hot-update')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((response) => {
        // Clone and store successful GET responses in cache
        if (response.status === 200) {
          const resClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, resClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed (offline), fetch from cache
        return caches.match(e.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback if index.html is requested but not cached
          if (e.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
