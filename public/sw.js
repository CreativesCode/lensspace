// LensSpace service worker (QA-28): only a fallback page for navigations that fail
// without signal. It never caches tenant data, RSC payloads or API responses.
const CACHE = 'lensspace-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_URL])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    // Navigation preload avoids waiting for the worker to boot on every page load.
    if (self.registration.navigationPreload) await self.registration.navigationPreload.enable()
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return
  event.respondWith((async () => {
    try {
      return (await event.preloadResponse) || (await fetch(event.request))
    } catch {
      return (await caches.match(OFFLINE_URL)) || Response.error()
    }
  })())
})
