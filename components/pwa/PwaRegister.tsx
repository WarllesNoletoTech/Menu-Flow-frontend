'use client';

import { useEffect } from 'react';

const STALE_ENDPOINTS_KEY = 'menu-flow.push-stale-endpoints.v1';

function rememberStaleEndpoint(endpoint: string) {
  try {
    const current = JSON.parse(localStorage.getItem(STALE_ENDPOINTS_KEY) || '[]') as string[];
    localStorage.setItem(STALE_ENDPOINTS_KEY, JSON.stringify([...new Set([...current, endpoint])]));
  } catch { /* migração best effort */ }
}

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        // Versões antigas do PWA chegaram a usar registros/escopos diferentes.
        // No Android isso pode fazer o app reabrir controlado por outro SW e
        // aparentar que a assinatura push "sumiu". Mantemos um único SW raiz.
        const expectedScope = `${window.location.origin}/`;
        const registrations = typeof navigator.serviceWorker.getRegistrations === 'function'
          ? await navigator.serviceWorker.getRegistrations()
          : [await navigator.serviceWorker.ready];
        for (const oldRegistration of registrations) {
          const worker = oldRegistration.active || oldRegistration.waiting || oldRegistration.installing;
          let isCurrent = oldRegistration.scope === expectedScope;
          if (worker) {
            try { isCurrent = isCurrent && new URL(worker.scriptURL).pathname === '/sw.js'; } catch { isCurrent = false; }
          } else isCurrent = false;
          if (isCurrent) continue;

          const subscription = await oldRegistration.pushManager.getSubscription().catch(() => null);
          if (subscription) {
            rememberStaleEndpoint(subscription.endpoint);
            await subscription.unsubscribe().catch(() => undefined);
          }
          await oldRegistration.unregister().catch(() => undefined);
        }

        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await registration.update().catch(() => undefined);
      } catch (error) {
        console.error('Não foi possível registrar o service worker do Menu Flow.', error);
      }
    };

    if (document.readyState === 'complete') {
      void register();
      return;
    }

    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
