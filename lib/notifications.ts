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

function applicationServerKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
  return bytes.buffer as ArrayBuffer;
}

export async function hasActivePushSubscription() {
  if (notificationPermission() === 'unsupported' || !('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  return Boolean(await registration.pushManager.getSubscription());
}

export async function subscribeCurrentDevice(publicKey: string) {
  if (!publicKey) throw new Error('A chave de notificações do servidor não está disponível.');
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') throw new Error(permission === 'denied' ? 'As notificações foram bloqueadas neste dispositivo.' : 'Não foi possível ativar as notificações.');
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(publicKey),
    });
  }
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('O navegador não retornou uma assinatura de notificação válida.');
  await authenticatedRequest('/notifications/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ endpoint: json.endpoint, expirationTime: subscription.expirationTime ?? null, keys: json.keys }),
  });
  return subscription;
}

export async function unsubscribeCurrentDevice() {
  if (!('serviceWorker' in navigator)) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;
  await authenticatedRequest('/notifications/subscriptions', {
    method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe();
  return true;
}

export async function detachPushSubscriptionOnLogout(accessToken: string) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await fetch(apiUrl('/notifications/subscriptions'), {
      method: 'DELETE',
      keepalive: true,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  } catch { /* best effort on logout */ }
}

export function sendTestPush() {
  return authenticatedRequest<{ok:boolean;sent:number}>('/notifications/test', { method: 'POST' });
}

export async function showSystemNotification(title: string, options: NotificationOptions & { url?: string }) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const { url, ...notificationOptions } = options;
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
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
