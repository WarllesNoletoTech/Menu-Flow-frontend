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

const DEVICE_ID_KEY = 'menu-flow.onesignal-device-id.v1';

function currentDeviceId() {
  if (typeof window === 'undefined') return '';
  const existing = localStorage.getItem(DEVICE_ID_KEY)?.trim();
  if (existing) return existing;
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `mf-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

async function saveCurrentOneSignalSubscription() {
  const state = await oneSignalPushState();
  if (!state.supported || !state.permission || !state.optedIn || !state.subscriptionId) return false;
  await authenticatedRequest('/notifications/onesignal/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      subscriptionId: state.subscriptionId,
      deviceId: currentDeviceId(),
    }),
  });
  return true;
}

async function removeCurrentOneSignalSubscription(subscriptionId: string | null | undefined) {
  if (!subscriptionId) return;
  await authenticatedRequest('/notifications/onesignal/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({
      subscriptionId,
      deviceId: currentDeviceId(),
    }),
  }).catch(() => undefined);
}

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
 * Revalida a identidade do lojista/admin no OneSignal e registra o Subscription
 * ID real no backend. O backend envia diretamente para esse ID, portanto a
 * entrega não depende de o painel estar aberto nem do socket do navegador.
 */
export async function ensureCurrentDeviceSubscription(_publicKey?: string | null) {
  await identifyCurrentStaffInOneSignal();
  let active = await hasActivePushSubscription();
  if (!active && notificationPermission() === 'granted') {
    active = await optInCurrentStaff();
  }
  if (!active) return false;
  return saveCurrentOneSignalSubscription();
}

export async function subscribeCurrentDevice(_publicKey?: string | null) {
  const enabled = await optInCurrentStaff();
  if (!enabled) throw new Error('Não foi possível ativar as notificações push neste dispositivo.');
  const saved = await saveCurrentOneSignalSubscription();
  if (!saved) throw new Error('O OneSignal não confirmou a inscrição deste dispositivo. Tente novamente.');
  return true;
}

export async function unsubscribeCurrentDevice() {
  const state = await oneSignalPushState().catch(() => null);
  await optOutCurrentDevice();
  await removeCurrentOneSignalSubscription(state?.subscriptionId);
  return true;
}

/**
 * Ao sair da conta operacional, remove o vínculo deste Subscription ID com o
 * usuário no backend e no OneSignal. A sessão de cliente nunca chama esta rotina.
 */
export async function detachPushSubscriptionOnLogout(_accessToken: string) {
  const state = await oneSignalPushState().catch(() => null);
  await removeCurrentOneSignalSubscription(state?.subscriptionId);
  await logoutOperationalOneSignal();
}

export async function syncStaffPushIfAllowed() {
  try {
    // Vincula a sessão operacional ao External ID do OneSignal primeiro. Assim a
    // inscrição continua pertencendo ao lojista/admin mesmo se a leitura das
    // preferências do backend falhar momentaneamente.
    await identifyCurrentStaffInOneSignal();
    const settings = await getNotificationPreferences();
    if (!settings.pushAvailable) return false;
    if (!settings.enabled) return false;
    let active = await hasActivePushSubscription();
    if (!active && notificationPermission() === 'granted') {
      active = await optInCurrentStaff();
    }
    if (!active) return false;
    return saveCurrentOneSignalSubscription();
  } catch {
    return false;
  }
}

export function sendTestPush() {
  return authenticatedRequest<{ok:boolean;sent:number}>('/notifications/test', { method: 'POST' });
}
