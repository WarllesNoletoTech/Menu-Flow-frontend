const CACHE_NAME = 'menu-flow-pwa-v7';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/manifest-lojista.webmanifest',
  '/manifest-garcom.webmanifest',
  '/assets/branding/menu-flow-icon-192.png',
  '/assets/branding/menu-flow-icon-512.png',
  '/assets/branding/menu-flow-symbol.png',
  '/assets/branding/menu-flow-wordmark.png'
];

const PUSH_DB = 'menu-flow-push-v1';
const PUSH_STORE = 'config';
const PUSH_CONFIG_KEY = 'runtime';

function openPushDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PUSH_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PUSH_STORE)) request.result.createObjectStore(PUSH_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writePushConfig(value) {
  const db = await openPushDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(PUSH_STORE, 'readwrite');
    transaction.objectStore(PUSH_STORE).put(value, PUSH_CONFIG_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function readPushConfig() {
  const db = await openPushDb();
  const value = await new Promise((resolve, reject) => {
    const transaction = db.transaction(PUSH_STORE, 'readonly');
    const request = transaction.objectStore(PUSH_STORE).get(PUSH_CONFIG_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return value;
}

function applicationServerKey(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

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

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'MF_PUSH_CONFIG') return;
  const publicKey = typeof event.data.publicKey === 'string' ? event.data.publicKey : '';
  const renewUrl = typeof event.data.renewUrl === 'string' ? event.data.renewUrl : '';
  const pullUrl = typeof event.data.pullUrl === 'string' ? event.data.pullUrl : '';
  const deliveryToken = typeof event.data.deliveryToken === 'string' ? event.data.deliveryToken : '';
  if (!publicKey || !renewUrl) return;
  event.waitUntil((async () => {
    const previous = await readPushConfig().catch(() => null);
    await writePushConfig({
      ...(previous || {}),
      publicKey,
      renewUrl,
      pullUrl: pullUrl || previous?.pullUrl || '',
      deliveryToken: deliveryToken || previous?.deliveryToken || '',
      savedAt: Date.now(),
    });
  })().catch(() => undefined));
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
    url.pathname === '/manifest-garcom.webmanifest' ||
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

async function pullPendingPushMessages() {
  const config = await readPushConfig().catch(() => null);
  if (!config?.pullUrl || !config?.deliveryToken) return [];
  try {
    const response = await fetch(config.pullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ token: config.deliveryToken }),
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const body = await response.json().catch(() => null);
    return Array.isArray(body?.notifications) ? body.notifications : [];
  } catch {
    return [];
  }
}

async function showPushNotification(payload = {}) {
  const title = payload.title || 'Menu Flow';
  const tag = payload.tag || `menu-flow-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await self.registration.showNotification(title, {
    body: payload.body || 'Você recebeu uma nova notificação.',
    icon: payload.icon || '/assets/branding/menu-flow-icon-192.png',
    badge: payload.badge || '/assets/branding/menu-flow-symbol.png',
    tag,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
    data: { url: payload.url || '/empresa/pedidos' },
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let messages = [];
    if (event.data) {
      try {
        messages = [event.data.json()];
      } catch {
        messages = [{ body: event.data.text() }];
      }
    } else {
      messages = await pullPendingPushMessages();
    }

    if (!messages.length) {
      messages = [{
        title: 'Menu Flow',
        body: 'Há uma nova atualização no seu painel de pedidos.',
        url: '/empresa/pedidos',
      }];
    }

    for (const message of messages.slice(-8)) {
      await showPushNotification(message);
    }
  })());
});

// Se o Chrome/Android rotacionar a assinatura enquanto o app estiver fechado,
// renovamos a inscrição e atualizamos o backend sem exigir que o lojista abra
// novamente a tela de configurações.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const config = await readPushConfig();
      const oldSubscription = event.oldSubscription;
      if (!config?.publicKey || !config?.renewUrl || !oldSubscription) return;

      let nextSubscription = event.newSubscription;
      if (!nextSubscription) {
        nextSubscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey(config.publicKey),
        });
      }

      const oldJson = oldSubscription.toJSON();
      const nextJson = nextSubscription.toJSON();
      if (!oldSubscription.endpoint || !oldJson.keys?.auth || !nextJson.endpoint || !nextJson.keys?.p256dh || !nextJson.keys?.auth) return;

      const response = await fetch(config.renewUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          oldEndpoint: oldSubscription.endpoint,
          oldAuth: oldJson.keys.auth,
          subscription: {
            endpoint: nextJson.endpoint,
            expirationTime: nextSubscription.expirationTime ?? null,
            keys: { p256dh: nextJson.keys.p256dh, auth: nextJson.keys.auth },
          },
        }),
      }).catch(() => null);
      if (response?.ok) {
        const renewed = await response.json().catch(() => null);
        if (renewed?.deliveryToken) {
          await writePushConfig({ ...config, deliveryToken: renewed.deliveryToken, savedAt: Date.now() });
        }
      }
    } catch { /* recuperação best effort */ }
  })());
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
