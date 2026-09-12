'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useEmpresa } from '../../components/empresa/EmpresaContext';
import { useOrderSocket } from '../../lib/order-socket';
import type { Employee, Product } from '../../components/empresa/types';

type Order = { _id: string; orderNumber?: string; customerName: string; status: string; createdAt: string; total?: number; totalCents?: number; fulfillment: string };
type Metrics = { pendingOrders: number; preparingOrders: number; readyOrders: number; completedOrders: number; grossRevenueCents: number };
const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function EmpresaPage() {
  const { establishment, loadingCompany, request } = useEmpresa();
  const [data, setData] = useState<{ orders: Order[]; products: Product[]; employees: Employee[]; metrics: Metrics } | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!establishment) return Promise.resolve();
    return Promise.all([
      request<Order[]>(`/restaurants/${establishment._id}/orders`),
      request<Product[]>(`/restaurants/${establishment._id}/products`),
      request<Employee[]>('/restaurants/me/users'),
      request<Metrics>('/billing/me/dashboard', { cache: 'no-store' }),
    ]).then(([orders, products, employees, metrics]) => {
      setData({ orders, products, employees, metrics });
      setError('');
    }).catch((e) => setError(e instanceof Error ? e.message : 'Não foi possível carregar o resumo.'));
  }, [establishment, request]);

  useEffect(() => { void load(); }, [load]);
  useOrderSocket(useCallback(() => { void load(); }, [load]));

  if (loadingCompany) return <Skeleton />;

  const accepting = Boolean(establishment?.canAcceptOrdersNow);
  const cards = data ? [
    { label: 'Aguardando', value: data.metrics.pendingOrders, tone: 'warning' as const },
    { label: 'Em preparo', value: data.metrics.preparingOrders, tone: 'primary' as const },
    { label: 'Prontos', value: data.metrics.readyOrders, tone: 'success' as const },
    { label: 'Concluídos hoje', value: data.metrics.completedOrders, tone: 'neutral' as const },
    { label: 'Faturamento hoje', value: money(data.metrics.grossRevenueCents), tone: 'gold' as const },
  ] : [];

  return <section>
    <div className="relative overflow-hidden rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,#6d292b_0%,#823438_55%,#a05442_100%)] px-6 py-7 text-white shadow-[0_24px_70px_rgba(120,47,49,.20)] sm:px-8 sm:py-9 xl:px-10">
      <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] backdrop-blur ${accepting ? 'border-emerald-200/20 bg-emerald-300/10 text-emerald-100' : 'border-orange-200/20 bg-orange-200/10 text-orange-100'}`}>
            <span className={`h-2 w-2 rounded-full ${accepting ? 'bg-emerald-300' : 'bg-orange-300'}`} />
            {accepting ? 'Recebendo pedidos' : 'Pedidos pausados ou fora do horário'}
          </span>
          <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Olá! Acompanhe {establishment?.tradeName || establishment?.name}.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">Pedidos, operação e desempenho da sua loja com uma visão rápida do que precisa de atenção.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/empresa/pedidos" className="inline-flex min-h-11 items-center rounded-[16px] bg-white px-4 text-sm font-black text-primary shadow-sm hover:bg-orange-50">Ver pedidos</Link>
          <Link href="/empresa/cardapio" className="inline-flex min-h-11 items-center rounded-[16px] border border-white/20 bg-white/10 px-4 text-sm font-black text-white backdrop-blur hover:bg-white/15">Editar cardápio</Link>
        </div>
      </div>
    </div>

    {error && <Notice text={error} />}

    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => <StoreMetricCard key={card.label} {...card} />)}
    </div>

    <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
      <article className="overflow-hidden rounded-[28px] border border-border/90 bg-white shadow-[0_14px_40px_rgba(41,37,36,.06)]">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-5 sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-accent">Tempo real</p>
            <h2 className="mt-1 text-xl font-black tracking-tight">Pedidos recentes</h2>
          </div>
          <Link href="/empresa/pedidos" className="text-sm font-black text-primary hover:underline">Ver todos →</Link>
        </div>

        <div className="divide-y divide-border">
          {data?.orders.slice(0, 6).map((order) => <Link key={order._id} href="/empresa/pedidos" className="group flex flex-col gap-3 px-5 py-4 transition hover:bg-background/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-primary/10 text-xs font-black text-primary">#{(order.orderNumber || order._id.slice(-4)).toString().slice(-4)}</span>
              <div className="min-w-0">
                <b className="block truncate text-sm text-stone-900">{order.customerName}</b>
                <span className="mt-1 block text-xs font-medium text-stone-500">{order.fulfillment === 'DELIVERY' ? 'Entrega' : 'Retirada'} · {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <StatusBadge status={order.status} />
              <b className="whitespace-nowrap text-sm text-stone-800">{money(order.totalCents ?? Math.round((order.total ?? 0) * 100))}</b>
              <span className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-primary">→</span>
            </div>
          </Link>)}
          {data && !data.orders.length && <div className="px-6 py-10 text-center"><p className="font-bold text-stone-700">Nenhum pedido recebido.</p><p className="mt-1 text-sm text-stone-500">Os novos pedidos aparecerão aqui automaticamente.</p></div>}
        </div>
      </article>

      <div className="space-y-6">
        <article className="rounded-[28px] border border-border/90 bg-white p-5 shadow-[0_14px_40px_rgba(41,37,36,.06)] sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-accent">Sua operação</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">Resumo da loja</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MiniStat label="Produtos" value={data?.products.length ?? '—'} />
            <MiniStat label="Equipe" value={data?.employees.length ?? '—'} />
          </div>
          <div className="mt-4 rounded-[20px] border border-border bg-background/55 p-4">
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-bold text-stone-600">Status da loja</span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${accepting ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{accepting ? 'Online' : 'Pausada'}</span></div>
            <p className="mt-2 text-xs leading-5 text-stone-500">{accepting ? 'Sua loja está disponível para receber novos pedidos.' : 'Verifique horários e configurações de recebimento.'}</p>
          </div>
        </article>

        <article className="rounded-[28px] border border-border/90 bg-white p-5 shadow-[0_14px_40px_rgba(41,37,36,.06)] sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-accent">Atalhos</p>
          <h2 className="mt-1 text-xl font-black tracking-tight">Ações rápidas</h2>
          <div className="mt-5 space-y-3">
            <QuickAction href="/empresa/cardapio" title="Novo produto" description="Adicione itens e organize categorias." />
            <QuickAction href="/empresa/dados" title="Dados da loja" description="Logo, banners, contato e endereço." />
            <QuickAction href="/empresa/horarios" title="Horários" description="Controle quando sua loja recebe pedidos." />
          </div>
        </article>
      </div>
    </div>
  </section>;
}

function StoreMetricCard({ label, value, tone }: { label: string; value: number | string; tone: 'warning' | 'primary' | 'success' | 'neutral' | 'gold' }) {
  const toneClass = tone === 'warning' ? 'bg-warning/10 text-warning' : tone === 'success' ? 'bg-success/10 text-success' : tone === 'gold' ? 'bg-gold/15 text-amber-700' : tone === 'primary' ? 'bg-primary/10 text-primary' : 'bg-stone-100 text-stone-600';
  return <article className="rounded-[24px] border border-border/90 bg-white p-5 shadow-[0_12px_32px_rgba(41,37,36,.05)]">
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-bold leading-5 text-stone-500">{label}</p><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneClass.split(' ')[0]}`} /></div>
    <strong className="mt-3 block break-words text-[28px] font-black tracking-tight text-stone-900">{value}</strong>
  </article>;
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-[20px] border border-border bg-background/55 p-4"><span className="text-xs font-bold text-stone-500">{label}</span><b className="mt-2 block text-2xl font-black text-stone-900">{value}</b></div>;
}

function QuickAction({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link href={href} className="group flex items-center justify-between gap-4 rounded-[20px] border border-border bg-background/45 p-4 transition hover:border-primary/20 hover:bg-primary/[.045]">
    <span><b className="block text-sm text-stone-800">{title}</b><small className="mt-1 block leading-5 text-stone-500">{description}</small></span><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm transition group-hover:translate-x-0.5">→</span>
  </Link>;
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase();
  const info = normalized.includes('PENDING') || normalized.includes('WAIT') ? ['Aguardando', 'bg-warning/10 text-warning'] : normalized.includes('PREPAR') ? ['Preparando', 'bg-primary/10 text-primary'] : normalized.includes('READY') ? ['Pronto', 'bg-success/10 text-success'] : normalized.includes('CANCEL') ? ['Cancelado', 'bg-danger/10 text-danger'] : normalized.includes('COMPLET') || normalized.includes('FINISH') ? ['Concluído', 'bg-stone-100 text-stone-600'] : [status, 'bg-stone-100 text-stone-600'];
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${info[1]}`}>{info[0]}</span>;
}

function Skeleton() {
  return <div className="space-y-5"><div className="h-48 animate-pulse rounded-[32px] bg-stone-200"/><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-28 animate-pulse rounded-[24px] bg-stone-200" />)}</div></div>;
}
function Notice({ text }: { text: string }) {
  return <p role="alert" className="mt-5 rounded-[18px] border border-danger/20 bg-danger/10 p-4 font-semibold text-danger">{text}</p>;
}
