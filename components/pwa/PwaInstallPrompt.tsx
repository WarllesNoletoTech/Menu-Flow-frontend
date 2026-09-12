'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    if (standalone || navigatorWithStandalone.standalone === true) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setHidden(false);
    };

    const onInstalled = () => {
      setInstallEvent(null);
      setHidden(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!installEvent || hidden) return null;

  const install = async () => {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallEvent(null);
    } else {
      setHidden(true);
    }
  };

  return (
    <aside
      role="dialog"
      aria-label="Instalar Menu Flow"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[100] mx-auto flex w-auto max-w-[460px] items-center gap-3 rounded-[22px] border border-stone-200 bg-white/95 p-3 shadow-[0_18px_60px_rgba(41,28,22,.20)] backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:mx-0"
    >
      <img src="/assets/branding/menu-flow-icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl object-contain" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-stone-900">Instalar Menu Flow</p>
        <p className="mt-0.5 text-xs font-medium text-stone-500">Use como aplicativo no seu celular.</p>
      </div>
      <button
        type="button"
        onClick={() => void install()}
        className="min-h-10 shrink-0 rounded-xl bg-primary px-4 text-xs font-black text-white shadow-sm transition hover:brightness-95"
      >
        Instalar
      </button>
      <button
        type="button"
        aria-label="Fechar aviso de instalação"
        onClick={() => setHidden(true)}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg font-bold text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
      >
        ×
      </button>
    </aside>
  );
}
