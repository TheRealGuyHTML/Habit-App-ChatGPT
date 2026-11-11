/* Bloom service worker. Only application assets enter the cache; private Firebase data never does. */
const CACHE = 'bloom-shell-v1';
const safeNotificationPath = value => value === '/?action=review' ? '/?action=review' : '/';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let assets = ['/', '/index.html', '/icon.svg', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/manifest.webmanifest'];
    try {
      const manifest = await fetch('/precache-manifest.json', { cache: 'no-store' });
      if (manifest.ok && manifest.headers.get('content-type')?.includes('json')) {
        const data = await manifest.json();
        if (Array.isArray(data.assets)) assets = [...new Set([...assets, ...data.assets])];
      }
    } catch { /* Development has no build manifest. */ }
    await Promise.all(assets.map(async path => {
      const response = await fetch(path, { cache: 'reload' });
      if (response.ok) await cache.put(path, response);
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).filter(key => key.startsWith('bloom-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async response => {
      if (response.ok) await (await caches.open(CACHE)).put('/index.html', response.clone());
      return response;
    }).catch(async () => (await caches.match('/index.html')) || (await caches.match('/')) || Response.error()));
  } else if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith((async () => {
      // Same-origin build assets are public and identical for every Origin header.
      // Preview/CDN responses can carry Vary: Origin; module requests use a
      // different Origin header from install-time fetches, so ignore that variance.
      const cached = await caches.match(request, { ignoreVary: true });
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await (await caches.open(CACHE)).put(request, response.clone());
      return response;
    })());
  }
});
self.addEventListener('push', event => {
  let payload = { title: 'Bloom', body: 'Zeit für deine Gewohnheiten. / Time for your habits.', url: '/', tag: 'bloom-reminder' };
  try { payload = { ...payload, ...event.data.json() }; } catch { /* Safe generic notification for malformed payloads. */ }
  event.waitUntil(self.registration.showNotification(String(payload.title).slice(0, 100), {
    body: String(payload.body).slice(0, 300), icon: '/icon-192.png', badge: '/icon-192.png',
    tag: String(payload.tag).slice(0, 100), data: { url: safeNotificationPath(payload.url) },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = safeNotificationPath(event.notification.data?.url);
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) if (new URL(client.url).origin === self.location.origin) { await client.focus(); client.postMessage({ type: path === '/?action=review' ? 'OPEN_REVIEW' : 'OPEN_HOME' }); return; }
    await self.clients.openWindow(path);
  })());
});
