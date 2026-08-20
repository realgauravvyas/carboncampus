/**
 * CarbonCampus service worker.
 *
 * Written by hand rather than generated, because the caching story here is
 * simple and worth being able to read: the shell is cached on install, static
 * assets are served cache-first with a background refresh, and navigations fall
 * back to the cached shell when the network is gone. Logging works on a train,
 * in a lab basement, or on hostel Wi-Fi that drops every ten minutes.
 */

const VERSION = 'v1';
const SHELL = `carboncampus-shell-${VERSION}`;
const ASSETS = `carboncampus-assets-${VERSION}`;

// Resolved against the service worker's own scope, so this works whether the
// app is served from a domain root or from /carboncampus/ on GitHub Pages.
const SHELL_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())     // a missing optional asset must not block install
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('carboncampus-') && k !== SHELL && k !== ASSETS)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;      // never cache the campus API

  // Navigations: try the network so a deploy is picked up, fall back to the shell.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(SHELL);
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Everything else: cache-first, refreshed in the background.
  event.respondWith((async () => {
    const cache = await caches.open(ASSETS);
    const hit = await cache.match(request);
    const network = fetch(request)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') cache.put(request, res.clone());
        return res;
      })
      .catch(() => null);
    return hit || (await network) || Response.error();
  })());
});

// Lets the page trigger an immediate update after a new deploy.
self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
