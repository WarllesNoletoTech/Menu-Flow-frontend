'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { usePwaInstall } from './PwaInstallContext';
import { useAuth } from '../AuthProvider';

export function PwaInstallPrompt() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { canInstall, installed, standalone, install, mode } = usePwaInstall();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (canInstall) setHidden(false);
  }, [canInstall, mode]);

  if (!canInstall || installed || standalone || hidden || (mode === 'garcom' && !user?.permissions?.includes('TABLES_VIEW') && !['KITCHEN','BAR','CASHIER'].includes(user?.employeePosition??'')) || pathname.endsWith('/empresa/instalar-app') || pathname.endsWith('/funcionario/instalar-app')) return null;

  const merchant = mode === 'lojista';
  const waiter = mode === 'garcom';

  const startInstall = async () => {
    const choice = await install();
    if (choice !== 'accepted') setHidden(true);
  };

  return (
    <aside
      role="dialog"
      aria-label={merchant ? 'Instalar Menu Flow Lojista' : waiter ? 'Instalar Menu Flow Garçom' : 'Instalar Menu Flow'}
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[100] mx-auto flex w-auto max-w-[470px] items-center gap-3 rounded-[22px] border border-stone-200 bg-white/95 p-3 shadow-[0_18px_60px_rgba(41,28,22,.20)] backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:mx-0"
    >
      <img src="/assets/branding/menu-flow-icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl object-contain" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-stone-900">{merchant ? 'Instalar Menu Flow Lojista' : waiter ? 'Instalar Menu Flow Garçom' : 'Instalar Menu Flow'}</p>
        <p className="mt-0.5 text-xs font-medium text-stone-500">
          {merchant ? 'Abra direto no painel da sua loja no celular ou PC.' : waiter ? 'Abra direto no controle de mesas no celular do garçom.' : 'Use como aplicativo no seu celular ou PC.'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void startInstall()}
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
