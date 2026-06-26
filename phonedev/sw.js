const CACHE_NAME = 'phonedev-v11';
const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './css/app.css',
    './css/mobile.css',
    './js/storage.js',
    './js/github.js',
    './js/ai.js',
    './js/ui.js',
    './js/termux.js',
    './js/app.js',
    './css/fonts.css',
    './assets/fonts/JuliaMono-Regular.woff2',
    './assets/fonts/JuliaMono-Medium.woff2',
    './assets/fonts/JuliaMono-Bold.woff2',
    './assets/fonts/VT323-Regular.ttf',
    './assets/fonts/Terminus.ttf',
    './icons/logo.svg',
    './pages/home.js',
    './pages/repos.js',
    './pages/chat.js',
    './pages/projects.js',
    './pages/apps.js',
    './pages/settings.js',
    './icons/icon.svg',
    './icons/icon-192.png',
    './icons/icon-512.png',
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
