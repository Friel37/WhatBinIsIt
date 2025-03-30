// Cache name with version
const CACHE_NAME = 'bin-app-cache-v1';

// Files to cache
const CACHE_URLS = [
  './', // Root
  './index.html',
  './script.js',
  './custom.css',
  './manifest.json',
  'https://cdn.jsdelivr.net/npm/@picocss/pico@1/css/pico.min.css',
  './icon-192.png',
  './icon-512.png'
];

// Install event - cache assets
self.addEventListener('install', event => {
  // Skip waiting so the service worker becomes active immediately
  self.skipWaiting();

  // Cache all static assets in CACHE_URLS
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app shell');
        return cache.addAll(CACHE_URLS);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          // Return from cache if found
          return response;
        }
        
        // Otherwise fetch from network
        return fetch(event.request)
          .then(networkResponse => {
            // Don't cache API calls or third-party requests
            if (!event.request.url.startsWith('http') || 
                event.request.method !== 'GET' ||
                event.request.url.includes('chrome-extension')) {
              return networkResponse;
            }
            
            // Clone the response as it's a stream and can only be consumed once
            const responseToCache = networkResponse.clone();
            
            // Cache new requests
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return networkResponse;
          })
          .catch(() => {
            // If both cache and network fail, show a generic offline page
            // For simplicity, we're not implementing this here
            // In a more complete app, you'd return an offline.html page
          });
      })
  );
}); 