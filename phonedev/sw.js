const CACHE_NAME = 'phonedev-v1';
const STATIC_ASSETS = [
    './',
    './index.html',
    './css/app.css',
    './css/mobile.css',
    './js/storage.js',
    './js/github.js',
    './js/ai.js',
    './js/ui.js',
    './js/app.js',
    './pages/home.js',
    './pages/repos.js',
    './pages/chat.js',
    './pages/settings.js',
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
