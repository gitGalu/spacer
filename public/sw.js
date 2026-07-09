const CACHE_NAME = 'spacer-v3';
const STATIC_CACHE = 'spacer-static-v3';
const RUNTIME_CACHE = 'spacer-runtime-v3';

const STATIC_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/spacer-logo.png',
  '/scenarios/gdy1.json'
];

const LEAFLET_TILE_PATTERN = /^https:\/\/.*\.tile\.openstreetmap\.org\/.*/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.all(
        STATIC_ASSETS.map((asset) =>
          cache.add(asset).catch((error) => {
            console.warn('SW: failed to cache', asset, error);
          })
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      const currentCaches = [CACHE_NAME, STATIC_CACHE, RUNTIME_CACHE];
      return Promise.all(
        cacheNames
          .filter((cacheName) => !currentCaches.includes(cacheName))
          .map((cacheName) => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (LEAFLET_TILE_PATTERN.test(request.url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(request).then((response) => {
            if (response.status === 200) {
              cache.put(request, response.clone());
            }
            return response;
          }).catch(() => {
            return new Response('Offline - Map tiles unavailable', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
        });
      })
    );
    return;
  }

  if (request.method === 'GET') {
    // Navigations (the HTML shell) must be network-first, otherwise an
    // installed PWA keeps serving a stale index.html that points at old
    // hashed bundles - so app updates never reach the device. Hashed assets
    // stay cache-first below: a new build changes their URL, so it is safe.
    if (request.mode === 'navigate' || request.destination === 'document') {
      event.respondWith(
        fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          return caches.match(request).then((cached) => cached || caches.match('/'));
        })
      );
      return;
    }

    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        }).catch(() => {
          if (request.destination === 'document') {
            return caches.match('/');
          }
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});