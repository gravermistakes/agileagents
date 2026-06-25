const CACHE_NAME = 'phonedev-v1';
const STATIC_ASSETS = [
    '/phonedev/',
    '/phonedev/index.html',
    '/phonedev/css/app.css',
    '/phonedev/js/storage.js',
    '/phonedev/js/github.js',
    '/phonedev/js/ai.js',
    '/phonedev/js/ui.js',
    '/phonedev/js/app.js',
    '/phonedev/pages/home.js',
    '/phonedev/pages/repos.js',
    '/phonedev/pages/chat.js',
    '/phonedev/pages/settings.js',
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    // Network-first for API calls, cache-first for static assets
    if (e.request.url.includes('api.')) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
    } else {
        e.respondWith(
            caches.match(e.request).then(cached => cached || fetch(e.request))
        );
    }
});
