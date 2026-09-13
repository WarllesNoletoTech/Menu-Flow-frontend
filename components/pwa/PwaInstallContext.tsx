'use client';

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export type InstallMode = 'lojista' | 'cliente';

type PwaInstallContextValue = {
  canInstall: boolean;
  installed: boolean;
  standalone: boolean;
  runtimeMode: InstallMode | null;
  mode: InstallMode;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
};

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);
const RUNTIME_MODE_KEY = 'menu-flow.pwa-runtime-mode';

function routeMode(pathname: string): InstallMode {
  return pathname === '/empresa'
    || pathname.startsWith('/empresa/')
    || pathname === '/app/empresa'
    || pathname.startsWith('/app/empresa/')
    ? 'lojista'
    : 'cliente';
}

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function detectRuntimeMode(standalone: boolean): InstallMode | null {
  if (!standalone || typeof window === 'undefined') return null;
  const marker = new URLSearchParams(window.location.search).get('pwa');
  if (marker === 'lojista') {
    try { sessionStorage.setItem(RUNTIME_MODE_KEY, 'lojista'); } catch { /* noop */ }
    return 'lojista';
  }
  try {
    const stored = sessionStorage.getItem(RUNTIME_MODE_KEY);
    if (stored === 'lojista' || stored === 'cliente') return stored;
    sessionStorage.setItem(RUNTIME_MODE_KEY, 'cliente');
  } catch { /* noop */ }
  return 'cliente';
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mode = routeMode(pathname);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [eventMode, setEventMode] = useState<InstallMode | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState<InstallMode | null>(null);

  useEffect(() => {
    const currentStandalone = isStandaloneMode();
    setStandalone(currentStandalone);
    setRuntimeMode(detectRuntimeMode(currentStandalone));

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
      setEventMode(mode);
    };

    const onInstalled = () => {
      setInstallEvent(null);
      setEventMode(null);
      const installedStandalone = isStandaloneMode();
      setStandalone(installedStandalone);
      setRuntimeMode(installedStandalone ? mode : null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [mode]);

  useEffect(() => {
    if (eventMode && eventMode !== mode) {
      setInstallEvent(null);
      setEventMode(null);
    }
  }, [eventMode, mode]);

  const value = useMemo<PwaInstallContextValue>(() => ({
    canInstall: Boolean(installEvent && eventMode === mode) && !standalone,
    installed: standalone && runtimeMode === mode,
    standalone,
    runtimeMode,
    mode,
    install: async () => {
      if (!installEvent || eventMode !== mode || standalone) return 'unavailable';
      await installEvent.prompt();
      const choice = await installEvent.userChoice;
      setInstallEvent(null);
      setEventMode(null);
      return choice.outcome;
    },
  }), [eventMode, installEvent, mode, runtimeMode, standalone]);

  return <PwaInstallContext.Provider value={value}>{children}</PwaInstallContext.Provider>;
}

export function usePwaInstall() {
  const value = useContext(PwaInstallContext);
  if (!value) throw new Error('usePwaInstall deve ser usado dentro de PwaInstallProvider');
  return value;
}
