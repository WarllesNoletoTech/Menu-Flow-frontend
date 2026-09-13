'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = async () => {
      try {
        // Registra/atualiza primeiro o SW raiz. Não removemos inscrições antigas
        // nesta etapa: apagar uma inscrição antes de a nova estar confirmada pode
        // fazer o Android perder o Push ao reabrir o PWA. A limpeza segura ocorre
        // somente depois que a inscrição principal foi salva no backend.
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
