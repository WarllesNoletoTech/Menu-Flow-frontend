'use client';

import { useState } from 'react';
import { usePwaInstall } from '../../../components/pwa/PwaInstallContext';

export default function InstallMerchantAppPage() {
  const { canInstall, installed, standalone, runtimeMode, install } = usePwaInstall();
  const [message, setMessage] = useState('');

  const startInstall = async () => {
    setMessage('');
    const result = await install();
    if (result === 'accepted') setMessage('Instalação iniciada. O Menu Flow Lojista ficará disponível como aplicativo.');
    if (result === 'dismissed') setMessage('A instalação foi cancelada. Você pode tentar novamente quando quiser.');
    if (result === 'unavailable') setMessage('O navegador não liberou o botão automático. Use a opção de instalar do próprio navegador.');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="overflow-hidden rounded-[30px] border border-border bg-white shadow-sm">
        <div className="bg-[linear-gradient(135deg,#211a18_0%,#352824_58%,#782f31_100%)] px-6 py-8 text-white sm:px-8 sm:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[.2em] text-orange-200">Aplicativo do lojista</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Menu Flow Lojista no celular ou PC</h2>
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-stone-200 sm:text-base">
                Instale uma versão própria para a operação da loja. Ao abrir pelo ícone instalado, o Menu Flow inicia diretamente na área do lojista.
              </p>
            </div>
            <img src="/assets/branding/menu-flow-icon-192.png" alt="Menu Flow" className="h-24 w-24 rounded-[24px] bg-white/95 object-contain p-2 shadow-xl sm:h-28 sm:w-28" />
          </div>
        </div>

        <div className="grid gap-5 p-6 sm:p-8 lg:grid-cols-[1.25fr_.75fr]">
          <div className="rounded-[24px] border border-border bg-background/55 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-2xl" aria-hidden>▣</span>
              <div>
                <h3 className="text-lg font-black text-stone-900">Acesso direto à operação</h3>
                <p className="mt-1 text-sm leading-6 text-stone-600">O atalho instalado abre em <b>Painel da empresa</b>, sem começar pelo portal geral de clientes.</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {installed ? (
                <div className="inline-flex min-h-12 items-center rounded-2xl bg-emerald-50 px-5 text-sm font-black text-emerald-700 ring-1 ring-emerald-200">
                  ✓ Aplicativo em execução neste dispositivo
                </div>
              ) : standalone && runtimeMode !== 'lojista' ? (
                <div className="inline-flex min-h-12 items-center rounded-2xl bg-amber-50 px-5 text-sm font-black text-amber-800 ring-1 ring-amber-200">
                  Abra esta página no navegador para instalar o app do lojista
                </div>
              ) : canInstall ? (
                <button type="button" onClick={() => void startInstall()} className="min-h-12 rounded-2xl bg-primary px-6 text-sm font-black text-white shadow-sm transition hover:brightness-95">
                  Instalar Menu Flow Lojista
                </button>
              ) : (
                <button type="button" onClick={() => window.location.reload()} className="min-h-12 rounded-2xl bg-primary px-6 text-sm font-black text-white shadow-sm transition hover:brightness-95">
                  Preparar instalação
                </button>
              )}
            </div>

            {message && <p role="status" className="mt-4 rounded-2xl border border-border bg-white p-4 text-sm font-semibold text-stone-700">{message}</p>}
          </div>

          <aside className="rounded-[24px] border border-border bg-white p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.18em] text-accent">O que muda</p>
            <div className="mt-4 space-y-4 text-sm text-stone-600">
              <p><b className="text-stone-900">Nome separado:</b> aparece como <b>MF Lojista</b> para não confundir com o app usado pelos clientes.</p>
              <p><b className="text-stone-900">Tela inicial:</b> abre diretamente no <b>Painel da empresa</b>, mantendo pedidos, cardápio e configurações a poucos toques.</p>
              <p><b className="text-stone-900">Cliente preservado:</b> o Menu Flow público continua instalável normalmente e continua abrindo no portal geral.</p>
            </div>
          </aside>
        </div>
      </section>

      {!installed && !canInstall && !standalone && (
        <section className="rounded-[28px] border border-border bg-white p-6 shadow-sm sm:p-8">
          <h3 className="text-xl font-black text-stone-900">Se o botão de instalação não aparecer</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-background p-5"><b className="text-stone-900">Android / Chrome</b><p className="mt-2 text-sm leading-6 text-stone-600">Abra o menu do Chrome e escolha <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.</p></div>
            <div className="rounded-2xl bg-background p-5"><b className="text-stone-900">Windows / PC</b><p className="mt-2 text-sm leading-6 text-stone-600">No Chrome ou Edge, use o ícone de instalação na barra de endereço ou a opção <b>Instalar Menu Flow Lojista</b> no menu.</p></div>
            <div className="rounded-2xl bg-background p-5"><b className="text-stone-900">iPhone / iPad</b><p className="mt-2 text-sm leading-6 text-stone-600">No Safari, toque em <b>Compartilhar</b> e depois em <b>Adicionar à Tela de Início</b>.</p></div>
          </div>
        </section>
      )}
    </div>
  );
}
