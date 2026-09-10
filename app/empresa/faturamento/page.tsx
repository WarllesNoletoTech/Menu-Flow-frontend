'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEmpresa } from '../../../components/empresa/EmpresaContext';
import { useOrderSocket } from '../../../lib/order-socket';

type Billing = { salesMetrics: { completedOrders: number; grossRevenueCents: number; averageTicketCents: number; cancelledOrders: number }; estimate: { completedOrderCount: number; plan: { name: string } | null; tier: { minOrders: number; maxOrders: number | null } | null; amountCents: number | null }; invoices: Array<{ _id: string; period: string; completedOrderCount: number; amountCents: number; status: string; dueDate?: string }> };
const money = (value: number | null) => value === null ? 'Plano não definido' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
const labels: Record<string, string> = { OPEN: 'Em aberto', PAID: 'Pago', OVERDUE: 'Vencido', WAIVED: 'Isento', CANCELLED: 'Cancelado' };

export default function Page() {
  const { request } = useEmpresa();
  const [data, setData] = useState<Billing>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const period = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).format(new Date()).replace('/', '-');
    try { setData(await request<Billing>(`/billing/me?period=${period}`, { cache: 'no-store' })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o faturamento.'); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { void load(); }, [load]);
  useOrderSocket(useCallback((event, value) => { if (event === 'updated' && (value as { status?: string })?.status === 'COMPLETED') void load(); }, [load]));

  return <section className="mx-auto max-w-5xl"><h1 className="text-3xl font-black">Faturamento</h1><p className="mt-2 text-stone-500">Vendas da loja e cobrança do Menu Flow são informações independentes.</p>{loading&&<p className="mt-5">Carregando dados atuais…</p>}{error&&<p role="alert" className="mt-4 bg-danger/10 p-4 text-danger">{error}</p>}{data&&<><h2 className="mt-8 text-xl font-black">Resumo de vendas</h2><div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card label="Pedidos concluídos" value={data.salesMetrics.completedOrders}/><Card label="Faturamento bruto" value={money(data.salesMetrics.grossRevenueCents)}/><Card label="Ticket médio" value={money(data.salesMetrics.averageTicketCents)}/><Card label="Pedidos cancelados" value={data.salesMetrics.cancelledOrders}/></div><section className="mt-8 rounded-2xl border bg-surface p-6"><h2 className="text-xl font-black">Seu plano Menu Flow</h2>{data.estimate.plan?<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Card label="Plano atual" value={data.estimate.plan.name}/><Card label="Pedidos contabilizados" value={data.estimate.completedOrderCount}/><Card label="Faixa atual" value={data.estimate.tier?`${data.estimate.tier.minOrders}–${data.estimate.tier.maxOrders??'∞'}`:'—'}/><Card label="Mensalidade estimada" value={money(data.estimate.amountCents)}/></div>:<p className="mt-3 font-bold text-stone-500">Plano ainda não definido. Suas vendas continuam contabilizadas normalmente.</p>}</section><h2 className="mt-8 text-xl font-black">Histórico de cobranças</h2><div className="mt-3 overflow-hidden rounded-2xl bg-surface">{data.invoices.map(invoice=><div className="grid gap-2 border-b p-4 sm:grid-cols-5" key={invoice._id}><span>{invoice.period.split('-').reverse().join('/')}</span><span>{invoice.completedOrderCount} pedidos</span><strong>{money(invoice.amountCents)}</strong><span>{invoice.dueDate?new Date(invoice.dueDate).toLocaleDateString('pt-BR'):'Sem vencimento'}</span><span>{labels[invoice.status]??invoice.status}</span></div>)}{!data.invoices.length&&<p className="p-4 text-stone-500">Nenhuma cobrança emitida.</p>}</div></>}</section>;
}

function Card({ label, value }: { label: string; value: React.ReactNode }) { return <article className="rounded-2xl bg-surface p-5"><p className="text-sm font-bold text-stone-500">{label}</p><strong className="mt-3 block text-2xl">{value}</strong></article>; }
