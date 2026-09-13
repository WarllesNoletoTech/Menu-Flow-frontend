'use client';

import { getSession } from './auth';

const DEFAULT_ONESIGNAL_APP_ID = '2a519701-a888-4d97-90e3-e345d2dd3bea';
const DEFAULT_SAFARI_WEB_ID = 'web.onesignal.auto.37a647a2-1bdc-46a8-a505-4f4cc6400a46';
const ONESIGNAL_SCRIPT_ID = 'menu-flow-onesignal-sdk';
const ONESIGNAL_SCRIPT_URL = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';

export type OneSignalSdk = {
  init: (options: Record<string, unknown>) => Promise<void>;
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
  Notifications: {
    isPushSupported: () => boolean;
    requestPermission: () => Promise<boolean>;
    permission: boolean;
  };
  User: {
    externalId?: string | null;
    PushSubscription: {
      id?: string | null;
      token?: string | null;
      optedIn: boolean;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalSdk) => void | Promise<void>>;
    __menuFlowOneSignalInitialized?: boolean;
  }
}

let scriptPromise: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;

export function oneSignalAppId() {
  return process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() || DEFAULT_ONESIGNAL_APP_ID;
}

function safariWebId() {
  return process.env.NEXT_PUBLIC_ONESIGNAL_SAFARI_WEB_ID?.trim() || DEFAULT_SAFARI_WEB_ID;
}

function ensureScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  if (document.getElementById(ONESIGNAL_SCRIPT_ID)) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.id = ONESIGNAL_SCRIPT_ID;
    script.src = ONESIGNAL_SCRIPT_URL;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Não foi possível carregar o serviço de notificações OneSignal.'));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

function initialize(oneSignal: OneSignalSdk) {
  if (window.__menuFlowOneSignalInitialized) return Promise.resolve();
  if (initPromise) return initPromise;
  initPromise = oneSignal.init({
    appId: oneSignalAppId(),
    safari_web_id: safariWebId(),
    serviceWorkerPath: '/push/onesignal/OneSignalSDKWorker.js',
    serviceWorkerParam: { scope: '/push/onesignal/' },
    autoResubscribe: true,
    notifyButton: { enable: false },
    persistNotification: true,
    notificationClickHandlerMatch: 'origin',
    notificationClickHandlerAction: 'navigate',
    welcomeNotification: {
      title: '🎉 Bem-vindo às notificações do Menu Flow!',
      message: 'Pronto! Você receberá avisos de novos pedidos e atualizações importantes da sua operação.',
    },
  }).then(() => {
    window.__menuFlowOneSignalInitialized = true;
  }).catch((error) => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

export async function withOneSignal<T>(callback: (oneSignal: OneSignalSdk) => Promise<T> | T): Promise<T> {
  if (typeof window === 'undefined') throw new Error('OneSignal só está disponível no navegador.');
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  const result = new Promise<T>((resolve, reject) => {
    window.OneSignalDeferred!.push(async (oneSignal) => {
      try {
        await initialize(oneSignal);
        resolve(await callback(oneSignal));
      } catch (error) {
        reject(error);
      }
    });
  });
  await ensureScript();
  return result;
}

export function operationalExternalId(userId: string) {
  return `mf-staff:${userId}`;
}

export async function identifyCurrentStaffInOneSignal() {
  const session = getSession();
  if (!session || session.user.role === 'CUSTOMER') return false;
  await withOneSignal(async (oneSignal) => {
    const externalId = operationalExternalId(session.user.id);
    if (oneSignal.User.externalId !== externalId) await oneSignal.login(externalId);
  });
  return true;
}

export async function oneSignalPushState() {
  return withOneSignal(async (oneSignal) => ({
    supported: oneSignal.Notifications.isPushSupported(),
    permission: oneSignal.Notifications.permission,
    optedIn: Boolean(oneSignal.User.PushSubscription.optedIn),
    subscriptionId: oneSignal.User.PushSubscription.id || null,
  }));
}

export async function optInCurrentStaff() {
  const session = getSession();
  if (!session || session.user.role === 'CUSTOMER') throw new Error('Entre como administrador ou lojista para ativar notificações.');
  return withOneSignal(async (oneSignal) => {
    if (!oneSignal.Notifications.isPushSupported()) throw new Error('Este navegador não oferece notificações push.');
    const externalId = operationalExternalId(session.user.id);
    if (oneSignal.User.externalId !== externalId) await oneSignal.login(externalId);
    await oneSignal.User.PushSubscription.optIn();
    // O SDK pode levar alguns instantes para receber o Subscription ID após o
    // usuário aceitar a permissão. Aguarda a confirmação antes de dizer que
    // este aparelho está realmente inscrito.
    for (let attempt = 0; attempt < 24; attempt += 1) {
      if (oneSignal.User.PushSubscription.optedIn && oneSignal.User.PushSubscription.id) return true;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return Boolean(oneSignal.User.PushSubscription.optedIn && oneSignal.User.PushSubscription.id);
  });
}

export async function optOutCurrentDevice() {
  return withOneSignal(async (oneSignal) => {
    await oneSignal.User.PushSubscription.optOut();
    return true;
  });
}

export async function logoutOperationalOneSignal() {
  try {
    await withOneSignal(async (oneSignal) => {
      await oneSignal.logout();
    });
  } catch {
    // Logout da aplicação não deve falhar caso o SDK esteja indisponível.
  }
}
