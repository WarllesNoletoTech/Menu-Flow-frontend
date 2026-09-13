'use client';
import { apiUrl } from './api';
import { authenticatedRequest } from './authenticated-request';

export type NotificationPreferences = {
  enabled: boolean;
  newOrder: boolean;
  orderCancelled: boolean;
  orderStatus: boolean;
};
export type NotificationSettingsResponse = NotificationPreferences & {
  deviceCount: number;
  publicKey: string | null;
  pushAvailable: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  enabled: true,
  newOrder: true,
  orderCancelled: true,
  orderStatus: false,
};

const DEVICE_ID_KEY = 'menu-flow.push-device-id.v1';
const STALE_ENDPOINTS_KEY = 'menu-flow.push-stale-endpoints.v1';

export function getNotificationPreferences() {
  return authenticatedRequest<NotificationSettingsResponse>('/notifications/preferences');
}
export function updateNotificationPreferences(changes: Partial<NotificationPreferences>) {
  return authenticatedRequest<NotificationSettingsResponse>('/notifications/preferences', {
    method: 'PATCH', body: JSON.stringify(changes),
  });
}
export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  return Notification.permission;
}
export async function requestNotificationPermission() {
  if (notificationPermission() === 'unsupported') return 'unsupported' as const;
  return Notification.requestPermission();
}

function getOrCreateDeviceId() {
  try {
    const current = localStorage.getItem(DEVICE_ID_KEY)?.trim();
    if (current) return current;
    const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `mf-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `mf-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}


async function serviceWorkerRegistrations() {
  if (!('serviceWorker' in navigator)) return [] as ServiceWorkerRegistration[];
  if (typeof navigator.serviceWorker.getRegistrations === 'function') return navigator.serviceWorker.getRegistrations();
  return [await navigator.serviceWorker.ready];
}

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

async function waitForActiveWorker(registration: ServiceWorkerRegistration) {
  if (registration.active) return registration;
  const worker = registration.installing || registration.waiting;
  if (!worker) return registration;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 5_000);
    const onState = () => {
      if (worker.state === 'activated' || worker.state === 'redundant') {
        window.clearTimeout(timeout);
        worker.removeEventListener('statechange', onState);
        resolve();
      }
    };
    worker.addEventListener('statechange', onState);
  });
  return registration;
}

async function primaryPushRegistration() {
  if (!('serviceWorker' in navigator)) throw new Error('Este navegador não oferece Service Worker.');
  const expectedScope = `${window.location.origin}/`;
  const registrations = await serviceWorkerRegistrations();
  let registration = registrations.find((candidate) => {
    const worker = candidate.active || candidate.waiting || candidate.installing;
    if (!worker || candidate.scope !== expectedScope) return false;
    try { return new URL(worker.scriptURL).pathname === '/sw.js'; } catch { return false; }
  });
  if (!registration) registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  return waitForActiveWorker(registration);
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('O navegador não retornou uma assinatura de notificação válida.');
  return {
    endpoint: json.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

async function rememberPushRuntimeConfig(
  registration: ServiceWorkerRegistration,
  publicKey: string,
  deliveryToken?: string | null,
) {
  const worker = registration.active || registration.waiting || registration.installing;
  worker?.postMessage({
    type: 'MF_PUSH_CONFIG',
    publicKey,
    renewUrl: apiUrl('/notifications/push/subscriptions/renew'),
    pullUrl: apiUrl('/notifications/push/messages/pull'),
    deliveryToken: deliveryToken || '',
  });
}

async function cleanupLegacyPushRegistrations(primary: ServiceWorkerRegistration) {
  const registrations = await serviceWorkerRegistrations();
  await Promise.allSettled(registrations.map(async (registration) => {
    if (registration === primary || registration.scope === primary.scope) {
      const worker = registration.active || registration.waiting || registration.installing;
      const primaryWorker = primary.active || primary.waiting || primary.installing;
      if (worker?.scriptURL === primaryWorker?.scriptURL) return;
    }

    const subscription = await registration.pushManager.getSubscription().catch(() => null);
    if (subscription) {
      await authenticatedRequest('/notifications/subscriptions', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => undefined);
      await subscription.unsubscribe().catch(() => undefined);
    }
    await registration.unregister().catch(() => undefined);
  }));
}

async function removeMigratedStaleEndpoints() {
  let endpoints: string[] = [];
  try {
    const raw = localStorage.getItem(STALE_ENDPOINTS_KEY);
    if (raw) endpoints = JSON.parse(raw) as string[];
  } catch { endpoints = []; }
  const unique = [...new Set(endpoints.filter((endpoint) => typeof endpoint === 'string' && endpoint.startsWith('https://')))];
  if (!unique.length) return;
  await Promise.allSettled(unique.map((endpoint) => authenticatedRequest('/notifications/subscriptions', {
    method: 'DELETE', body: JSON.stringify({ endpoint }),
  })));
  try { localStorage.removeItem(STALE_ENDPOINTS_KEY); } catch { /* noop */ }
}

export async function hasActivePushSubscription() {
  if (notificationPermission() === 'unsupported') return false;
  const registration = await primaryPushRegistration();
  return Boolean(await registration.pushManager.getSubscription());
}

export async function ensureCurrentDeviceSubscription(
  publicKey: string,
  options: { requestPermission?: boolean } = {},
) {
  if (!publicKey) throw new Error('A chave de notificações do servidor não está disponível.');
  const support = notificationPermission();
  if (support === 'unsupported') return null;

  let permission = support;
  if (permission === 'default' && options.requestPermission) permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    if (options.requestPermission) {
      throw new Error(permission === 'denied' ? 'As notificações foram bloqueadas neste dispositivo.' : 'Não foi possível ativar as notificações.');
    }
    return null;
  }

  const registration = await primaryPushRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(publicKey),
    });
  }

  const payload = subscriptionPayload(subscription);
  const saved = await authenticatedRequest<{
    ok: boolean;
    deviceCount: number;
    deliveryToken?: string | null;
  }>('/notifications/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ ...payload, deviceId: getOrCreateDeviceId() }),
  });
  await rememberPushRuntimeConfig(registration, publicKey, saved.deliveryToken);
  await removeMigratedStaleEndpoints();
  await cleanupLegacyPushRegistrations(registration);
  return subscription;
}

export async function subscribeCurrentDevice(publicKey: string) {
  const subscription = await ensureCurrentDeviceSubscription(publicKey, { requestPermission: true });
  if (!subscription) throw new Error('Não foi possível ativar as notificações neste dispositivo.');
  return subscription;
}

async function allPushSubscriptions() {
  if (!('serviceWorker' in navigator)) return [] as PushSubscription[];
  const registrations = await serviceWorkerRegistrations();
  const subscriptions = await Promise.all(registrations.map((registration) => registration.pushManager.getSubscription().catch(() => null)));
  const unique = new Map<string, PushSubscription>();
  subscriptions.forEach((subscription) => { if (subscription) unique.set(subscription.endpoint, subscription); });
  return [...unique.values()];
}

export async function unsubscribeCurrentDevice() {
  const subscriptions = await allPushSubscriptions();
  if (!subscriptions.length) return false;
  await Promise.allSettled(subscriptions.map(async (subscription) => {
    await authenticatedRequest('/notifications/subscriptions', {
      method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  }));
  return true;
}

export async function detachPushSubscriptionOnLogout(accessToken: string) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const subscriptions = await allPushSubscriptions();
    await Promise.allSettled(subscriptions.map(async (subscription) => {
      await fetch(apiUrl('/notifications/subscriptions'), {
        method: 'DELETE',
        keepalive: true,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      }).catch(() => undefined);
    }));
  } catch { /* best effort on logout */ }
}

export async function syncStaffPushIfAllowed() {
  try {
    if (notificationPermission() !== 'granted') return false;
    const settings = await getNotificationPreferences();
    if (!settings.enabled || !settings.pushAvailable || !settings.publicKey) return false;
    return Boolean(await ensureCurrentDeviceSubscription(settings.publicKey));
  } catch {
    return false;
  }
}

export function sendTestPush() {
  return authenticatedRequest<{ok:boolean;sent:number}>('/notifications/test', { method: 'POST' });
}

export async function showSystemNotification(title: string, options: NotificationOptions & { url?: string }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const { url, ...notificationOptions } = options;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await primaryPushRegistration();
      await registration.showNotification(title, {
        ...notificationOptions,
        data: { ...(notificationOptions.data as Record<string, unknown> | undefined), url: url || '/' },
      });
      return true;
    }
    const notification = new Notification(title, notificationOptions);
    if (url) notification.onclick = () => { window.focus(); window.location.href = url; };
    return true;
  } catch { return false; }
}
