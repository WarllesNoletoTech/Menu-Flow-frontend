'use client';

import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { paymentMethodLabel } from '../../../../lib/payment-methods';
import { BusinessHoursEditor } from '../../../../components/empresa/BusinessHoursEditor';
import { CatalogManager } from '../../../../components/empresa/CatalogManager';
import { useDashboard } from '../../../../components/dashboard/DashboardContext';

type Detail = {
  establishment: { _id: string; name: string; tradeName?: string; slug: string; city?: string; state?: string; address?: string; mapUrl?: string; pickupInstructions?: string };
  owner?: { name: string; email: string } | null;
  settings?: { pickupEnabled?: boolean; deliveryEnabled?: boolean };
  deliveryZones: Array<{ _id: string; name: string; coverageType?: 'ALL' | 'SPECIFIC'; fee: number; feeCents?: number; active: boolean }>;
  paymentMethods: Array<{ _id: string; name: string; method: string; active: boolean }>;
};

type Tab = 'overview' | 'hours' | 'catalog';

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { request } = useDashboard();
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState('');

  useEffect(() => {
    void request<Detail>(`/restaurants/${id}/admin-detail`).then(setDetail).catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o estabelecimento.'));
  }, [id, request]);

  const establishment = detail?.establishment;
  const activeZones = detail?.deliveryZones?.filter((zone) => zone.active) ?? [];
  const activePayments = detail?.paymentMethods?.filter((method) => method.active) ?? [];
  const services = [detail?.settings?.pickupEnabled && 'Retirada', detail?.settings?.deliveryEnabled && 'Entrega'].filter(Boolean).join(' e ') || 'Não configurado';

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="mf-panel rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <Link href="/admin/restaurantes" className="inline-flex items-center gap-2 text-sm font-black text-stone-500 transition hover:text-primary">← Voltar para estabelecimentos</Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0"><span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-primary">Gestão do estabelecimento</span><h1 className="mt-3 break-words text-3xl font-black tracking-tight text-stone-900 sm:text-[2.35rem]">{establishment?.tradeName || establishment?.name || 'Estabelecimento'}</h1><p className="mt-2 text-sm font-semibold text-stone-500">/{establishment?.slug || 'carregando'}</p></div>
          {establishment?.slug && <Link href={`/${establishment.slug}`} className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-border bg-white px-5 text-sm font-black text-stone-700 shadow-sm">Abrir loja pública ↗</Link>}
        </div>
      </header>

      {error && <p className="rounded-[22px] border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">{error}</p>}

      <nav className="flex gap-2 overflow-x-auto rounded-[24px] border border-border/90 bg-white p-2 shadow-sm" aria-label="Seções do estabelecimento">
        {([['overview', 'Visão geral'], ['hours', 'Horários de funcionamento'], ['catalog', 'Cardápio']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => setTab(value)} className={`min-h-11 shrink-0 rounded-[16px] px-4 text-sm font-black transition ${tab === value ? 'bg-ink text-white shadow-sm' : 'text-stone-600 hover:bg-background'}`}>{label}</button>)}
      </nav>

      {tab === 'overview' && (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <article className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
            <div className="border-b border-border pb-5"><span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-accent">Dados principais</span><h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Informações da empresa</h2></div>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <Info label="Slug" value={establishment?.slug || '—'} />
              <Info label="Cidade / UF" value={[establishment?.city, establishment?.state].filter(Boolean).join(' / ') || '—'} />
              <Info label="Lojista responsável" value={detail?.owner?.name || 'Não vinculado'} />
              <Info label="Atendimento" value={services} />
              <Info label="Endereço" value={establishment?.address || 'Não informado'} wide />
              <div className="rounded-[20px] border border-border bg-background/45 px-4 py-3 sm:col-span-2"><dt className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">Localização no mapa</dt><dd className="mt-1 text-sm font-semibold">{establishment?.mapUrl ? <a href={establishment.mapUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-primary/30 underline-offset-4">Abrir localização ↗</a> : 'Localização não cadastrada'}</dd></div>
            </dl>
          </article>

          <div className="space-y-6">
            <article className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6"><span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-success">Entrega</span><h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Regiões ativas</h2><div className="mt-4 grid gap-3">{activeZones.length ? activeZones.map((zone) => <div key={zone._id} className="rounded-[20px] border border-border bg-background/45 p-4"><b className="block text-sm text-stone-800">{zone.coverageType === 'ALL' ? 'Todos os bairros' : zone.name}</b><span className="mt-1 block text-xs text-stone-500">Taxa: {((zone.feeCents ?? Math.round(zone.fee * 100)) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>) : <p className="rounded-[20px] border border-dashed border-border bg-background/45 p-4 text-sm text-stone-500">Nenhuma região ativa.</p>}</div></article>
            <article className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6"><span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary">Pagamentos</span><h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Métodos ativos</h2><div className="mt-4 flex flex-wrap gap-2">{activePayments.length ? activePayments.map((method) => <span key={method._id} className="rounded-full border border-border bg-background/55 px-3 py-2 text-xs font-black text-stone-700">{paymentMethodLabel(method.method, method.name)}</span>) : <span className="text-sm text-stone-500">Nenhum método ativo.</span>}</div></article>
          </div>
        </div>
      )}

      {tab === 'hours' && <div className="rounded-[30px] border border-border/90 bg-white p-4 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6"><BusinessHoursEditor request={request} endpoint={`/restaurants/${id}/business-hours`} /></div>}
      {tab === 'catalog' && <div className="rounded-[30px] border border-border/90 bg-white p-4 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6"><CatalogManager request={request} base={`/restaurants/${id}/manage-catalog`} establishment={establishment} /></div>}
    </section>
  );
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`rounded-[20px] border border-border bg-background/45 px-4 py-3 ${wide ? 'sm:col-span-2' : ''}`}><dt className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-stone-700">{value}</dd></div>;
}
