'use client';

import { authenticatedRequest } from './authenticated-request';
import {
  identifyCurrentStaffInOneSignal,
  logoutOperationalOneSignal,
  oneSignalPushState,
  optInCurrentStaff,
  optOutCurrentDevice,
} from './onesignal';

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
  provider?: 'onesignal';
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
    method: 'PATCH',
    body: JSON.stringify(changes),
  });
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (notificationPermission() === 'unsupported') return 'unsupported' as const;
  return Notification.requestPermission();
}

export async function hasActivePushSubscription() {
  try {
    const state = await oneSignalPushState();
    return state.supported && state.permission && state.optedIn && Boolean(state.subscriptionId);
  } catch {
    return false;
  }
}

/**
 * Mantém o nome da API antiga para não quebrar os componentes existentes.
 * No OneSignal não é necessário VAPID no frontend: apenas identificamos a
 * sessão operacional e reutilizamos a inscrição persistente do navegador.
 */
export async function ensureCurrentDeviceSubscription(_publicKey?: string | null) {
  await identifyCurrentStaffInOneSignal();
  return hasActivePushSubscription();
}

export async function subscribeCurrentDevice(_publicKey?: string | null) {
  const enabled = await optInCurrentStaff();
  if (!enabled) throw new Error('Não foi possível ativar as notificações neste dispositivo.');
  return true;
}

export async function unsubscribeCurrentDevice() {
  return optOutCurrentDevice();
}

/**
 * O logout operacional remove somente o External ID da inscrição OneSignal.
 * A permissão do aparelho permanece intacta para que o mesmo lojista possa
 * entrar novamente sem precisar autorizar notificações outra vez.
 * A sessão do cliente nunca chama esta função.
 */
export async function detachPushSubscriptionOnLogout(_accessToken: string) {
  await logoutOperationalOneSignal();
}

export async function syncStaffPushIfAllowed() {
  try {
    const settings = await getNotificationPreferences();
    if (!settings.pushAvailable) return false;
    // Sempre troca o External ID para a conta operacional atual. Assim um login
    // de lojista/admin nunca herda o vínculo OneSignal de outro usuário do aparelho.
    await identifyCurrentStaffInOneSignal();
    if (!settings.enabled) return false;
    return hasActivePushSubscription();
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
  } catch {
    return false;
  }
}
