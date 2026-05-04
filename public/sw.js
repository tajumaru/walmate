const SW_VERSION = '2026-05-05-cache-bust-sw-refresh';
const CACHE_NAME = `walmate-pwa-${SW_VERSION}`;

function versioned(path){
  const url = new URL(path, self.location.origin + self.location.pathname);
  url.searchParams.set('v', SW_VERSION);
  return `${url.pathname}${url.search}`;
}

const APP_SHELL = [
  './',
  versioned('./index.html'),
  versioned('./manifest.json'),
  versioned('./app-core.js'),
  versioned('./app-gameplay.js'),
  versioned('./app-integrations.js'),
  versioned('./app-walk.js'),
  versioned('./app-init.js'),
  versioned('./og-image.png'),
  versioned('./icons/apple-touch-icon.png')
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const network = await fetch(req, { cache: 'no-store' });
        const copy = network.clone();
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, copy);
        return network;
      } catch (error) {
        return (await caches.match(req)) || (await caches.match(versioned('./index.html'))) || Response.error();
      }
    })());
    return;
  }

  const isVersionedAsset = url.searchParams.has('v');
  if (isVersionedAsset) {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      const network = await fetch(req, { cache: 'no-store' });
      if (network && network.status === 200 && network.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, network.clone());
      }
      return network;
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      const network = await fetch(req);
      if (network && network.status === 200 && network.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(req, network.clone());
      }
      return network;
    } catch (error) {
      return (await caches.match(req)) || Response.error();
    }
  })());
});
