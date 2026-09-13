const CACHE_NAME = 'menu-flow-pwa-v4';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/manifest-lojista.webmanifest',
  '/assets/branding/menu-flow-icon-192.png',
  '/assets/branding/menu-flow-icon-512.png',
  '/assets/branding/menu-flow-symbol.png',
  '/assets/branding/menu-flow-wordmark.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedOffline = await caches.match(OFFLINE_URL);
        return cachedOffline || Response.error();
      })
    );
    return;
  }

  if (
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/manifest-lojista.webmanifest' ||
    url.pathname.startsWith('/assets/branding/')
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});


self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Menu Flow';
  const tag = payload.tag || `menu-flow-${Date.now()}`;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || 'Você recebeu uma nova notificação.',
      icon: payload.icon || '/assets/branding/menu-flow-icon-192.png',
      badge: payload.badge || '/assets/branding/menu-flow-symbol.png',
      tag,
      renotify: true,
      data: { url: payload.url || '/empresa/pedidos' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || '/empresa/pedidos';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
