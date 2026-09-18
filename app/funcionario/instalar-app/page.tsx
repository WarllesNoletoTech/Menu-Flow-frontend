'use client';

import { useState } from 'react';
import { usePwaInstall } from '../../../components/pwa/PwaInstallContext';

export default function InstallWaiterAppPage() {
  const { canInstall, installed, standalone, runtimeMode, install } = usePwaInstall();
  const [message, setMessage] = useState('');

  async function startInstall() {
    setMessage('');
    const result = await install();
    if (result === 'accepted') setMessage('Instalação iniciada. O Menu Flow Garçom ficará disponível como aplicativo.');
    if (result === 'dismissed') setMessage('A instalação foi cancelada. Você pode tentar novamente.');
    if (result === 'unavailable') setMessage('Use a opção de instalar aplicativo ou adicionar à tela inicial do navegador.');
  }

  return <section className="mx-auto max-w-4xl space-y-5">
    <div className="overflow-hidden rounded-[30px] border bg-white shadow-sm">
      <div className="bg-[linear-gradient(135deg,#211a18_0%,#352824_58%,#782f31_100%)] p-7 text-white sm:p-9">
        <p className="text-xs font-black uppercase tracking-[.2em] text-orange-200">Aplicativo do salão</p>
        <h2 className="mt-2 text-3xl font-black">Menu Flow Garçom</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-200">Instale no celular do garçom. O ícone abre diretamente no controle de mesas, mantendo comandas e pedidos a poucos toques.</p>
      </div>
      <div className="grid gap-5 p-6 sm:p-8 md:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-2xl bg-background p-5">
          <h3 className="font-black">Instalação</h3>
          <div className="mt-4">
            {installed ? <div className="rounded-xl bg-success/10 p-4 font-black text-success">✓ Menu Flow Garçom instalado neste dispositivo</div>
              : standalone && runtimeMode !== 'garcom' ? <div className="rounded-xl bg-gold/15 p-4 font-bold">Abra esta página no navegador para instalar o app do garçom separadamente.</div>
              : <button type="button" onClick={()=>void startInstall()} className="rounded-xl bg-primary px-5 py-3 font-black text-white">{canInstall?'Instalar Menu Flow Garçom':'Preparar instalação'}</button>}
          </div>
          {message&&<p className="mt-4 rounded-xl border bg-white p-3 text-sm font-semibold">{message}</p>}
        </div>
        <aside className="rounded-2xl border p-5 text-sm text-stone-600"><b className="text-stone-900">No Android/Chrome</b><p className="mt-2 leading-6">Se o botão automático não aparecer, abra o menu do Chrome e escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p><p className="mt-4 leading-6">O app usa a sessão do funcionário e respeita as permissões configuradas pelo lojista.</p></aside>
      </div>
    </div>
  </section>;
}
