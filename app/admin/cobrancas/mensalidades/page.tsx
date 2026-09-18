'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../../../../components/dashboard/DashboardContext';
import { apiUrl } from '../../../../lib/api';
import { getSession } from '../../../../lib/auth';

type Dashboard = { open: number; overdue: number; openAmountCents: number; completedOrdersThisMonth: number; restaurantsWithoutPlan: number; period: string };
type Invoice = { _id: string; period: string; revenueCents?: number; completedOrderCount: number; amountCents: number; status: 'OPEN'|'PAID'|'OVERDUE'|'WAIVED'|'CANCELLED'; dueDate?: string; restaurantId: { _id: string; name: string; tradeName?: string }; pricingSnapshot?: { tier?: { minRevenueCents?: number; maxRevenueCents?: number|null; amountCents?: number }; billingBasis?: string } };
type List = { items: Invoice[]; pagination: { page: number; pages: number; total: number } };
type PaymentSettings = { pixReceiverName?: string; pixKey?: string };

const money = (cents = 0) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const monthLabel = (period: string) => { const [year, month] = period.split('-').map(Number); return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)); };
const currentPeriod = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`; };
const previousPeriodOf = (period: string) => { const [year,month]=period.split('-').map(Number); const d=new Date(year,month-2,1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const labels: Record<string,string> = { OPEN: 'Pendente', PAID: 'Pago', OVERDUE: 'Vencido', WAIVED: 'Isento', CANCELLED: 'Cancelado' };
const tones: Record<string,string> = { OPEN: 'bg-amber-50 text-amber-800', PAID: 'bg-emerald-50 text-emerald-800', OVERDUE: 'bg-red-50 text-red-700', WAIVED: 'bg-blue-50 text-blue-700', CANCELLED: 'bg-stone-100 text-stone-600' };

export default function Page() {
  const { request } = useDashboard();
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [list, setList] = useState<List>({ items: [], pagination: { page: 1, pages: 1, total: 0 } });
  const [period, setPeriod] = useState(currentPeriod());
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [payment, setPayment] = useState<PaymentSettings>({});

  async function load() {
    try {
      const [summary, invoices, paymentSettings] = await Promise.all([
        request<Dashboard>('/billing/dashboard', { cache: 'no-store' }),
        request<List>(`/billing/invoices?page=1&limit=100${status ? `&status=${status}` : ''}`, { cache: 'no-store' }),
        request<PaymentSettings>('/billing/settings/payment', { cache: 'no-store' }).catch(() => ({})),
      ]);
      setDashboard(summary); setList(invoices); setPayment(paymentSettings);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as cobranças.'); }
  }
  useEffect(() => { void load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    setBusy(true); setMessage('');
    try {
      const referencePeriod = previousPeriodOf(period);
      const result = await request<{ results: Array<{ created?: boolean; alreadyExists?: boolean }> }>('/billing/invoices/generate', { method: 'POST', body: JSON.stringify({ period: referencePeriod }) });
      const created = result.results.filter((item) => item.created).length;
      const existing = result.results.filter((item) => item.alreadyExists).length;
      setMessage(`${created} mensalidade(s) gerada(s). ${existing ? `${existing} já existia(m).` : ''}`.trim());
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível gerar as mensalidades.'); }
    finally { setBusy(false); }
  }

  async function changeStatus(invoice: Invoice, next: 'PAID'|'WAIVED'|'CANCELLED') {
    if (!window.confirm(`${next === 'PAID' ? 'Marcar como paga' : next === 'WAIVED' ? 'Isentar' : 'Cancelar'} a mensalidade de ${invoice.restaurantId.tradeName || invoice.restaurantId.name}?`)) return;
    setBusy(true); setMessage('');
    try { await request(`/billing/invoices/${invoice._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: next }) }); await load(); setMessage('Cobrança atualizada.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a cobrança.'); }
    finally { setBusy(false); }
  }

  async function deleteInvoice(invoice: Invoice) {
    const restaurantName = invoice.restaurantId.tradeName || invoice.restaurantId.name;
    const confirmed = window.confirm(
      `Excluir definitivamente a cobrança de ${restaurantName} referente a ${monthLabel(invoice.period)}?\n\nA exclusão não altera pedidos nem faturamento. Se esse período for reprocessado, uma nova cobrança poderá ser gerada.`,
    );
    if (!confirmed) return;
    setBusy(true); setMessage('');
    try {
      await request(`/billing/invoices/${invoice._id}`, { method: 'DELETE' });
      await load();
      setMessage(`Cobrança de ${restaurantName} excluída com sucesso.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir a cobrança.');
    } finally {
      setBusy(false);
    }
  }

  async function savePaymentSettings() {
    setBusy(true); setMessage('');
    try {
      await request('/billing/settings/payment', { method: 'PUT', body: JSON.stringify({ pixReceiverName: payment.pixReceiverName || '', pixKey: payment.pixKey || '' }) });
      setMessage('Dados PIX atualizados.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar os dados PIX.'); }
    finally { setBusy(false); }
  }

  async function downloadInvoicePdf(invoice: Invoice) {
    setMessage('');
    try {
      const response = await fetch(apiUrl(`/billing/invoices/${invoice._id}/pdf`), { headers: { Authorization: `Bearer ${getSession()?.accessToken}` }, cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível gerar o PDF da cobrança.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `menu-flow-mensalidade-${invoice.period}.pdf`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível gerar o PDF da cobrança.'); }
  }

  const referencePeriod = useMemo(() => previousPeriodOf(period), [period]);
  const filtered = useMemo(() => list.items.filter((item) => !referencePeriod || item.period === referencePeriod), [list.items, referencePeriod]);

  return <section className="mx-auto max-w-7xl space-y-6">
    <header className="overflow-hidden rounded-[32px] bg-gradient-to-r from-ink via-[#6f1c21] to-[#8f242a] p-6 text-white shadow-xl sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-lime">Financeiro da plataforma</p><h1 className="mt-2 text-3xl font-black">Cobranças por faturamento</h1><p className="mt-2 max-w-2xl text-sm text-white/75">No dia 1º de cada mês o sistema gera automaticamente as mensalidades de todos os estabelecimentos com base no mês anterior.</p></div><Link href="/admin/cobrancas/planos" className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black">⚙️ Configurar faixas</Link></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Pendentes" value={String(dashboard?.open ?? 0)} /><Card label="Vencidas" value={String(dashboard?.overdue ?? 0)} /><Card label="A receber" value={money(dashboard?.openAmountCents ?? 0)} /><Card label="Modelo" value="Por faturamento" /></div>
    </header>

    <section className="rounded-[28px] border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Ciclo automático</p><h2 className="mt-1 text-xl font-black">Cobrança mensal</h2><p className="mt-1 text-sm text-stone-500">O mês atual fica selecionado. A cobrança usa automaticamente o faturamento do mês anterior; o botão serve como reprocessamento manual de segurança.</p></div><div className="flex flex-wrap items-end gap-2"><label className="text-sm font-bold">Mês da cobrança<input type="month" className="field min-w-44" value={period} onChange={(e) => setPeriod(e.target.value)} /></label><button disabled={busy || !period} onClick={() => void generate()} className="min-h-12 rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? 'Processando…' : 'Gerar / conferir agora'}</button></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3"><Tier label="Até R$ 1.000" price="R$ 49,90" /><Tier label="R$ 1.000,01 a R$ 3.500" price="R$ 69,90" /><Tier label="Acima de R$ 3.500" price="R$ 129,90" /></div>
      <div className="mt-3 rounded-2xl bg-background p-3 text-xs text-stone-600"><b>Cobrança selecionada:</b> {monthLabel(period)} · <b>Referência faturada:</b> {monthLabel(referencePeriod)}. A geração automática acontece no dia 1º. O vencimento padrão é o dia 5, podendo ser alterado por estabelecimento/plano.</div>
      {message && <p className="mt-4 rounded-2xl border bg-background p-3 text-sm font-bold">{message}</p>}
    </section>

    <section className="rounded-[28px] border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Recebimento</p><h2 className="mt-1 text-xl font-black">Dados PIX do Menu Flow</h2><p className="mt-1 text-sm text-stone-500">Esses dados aparecem para lojas com mensalidade pendente.</p></div><button disabled={busy} onClick={() => void savePaymentSettings()} className="rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white">Salvar PIX</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Favorecido<input className="field" value={payment.pixReceiverName ?? ''} onChange={(e)=>setPayment({...payment,pixReceiverName:e.target.value})} /></label><label className="text-sm font-bold">Chave PIX<input className="field" value={payment.pixKey ?? ''} onChange={(e)=>setPayment({...payment,pixKey:e.target.value})} /></label></div></section>

    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Mensalidades</h2><p className="text-sm text-stone-500">Cobrança de {monthLabel(period)} · referência {monthLabel(referencePeriod)} · {filtered.length} cobrança(s)</p></div><select className="field !mt-0 w-auto min-w-40" value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos os status</option><option value="OPEN">Pendentes</option><option value="OVERDUE">Vencidas</option><option value="PAID">Pagas</option><option value="WAIVED">Isentas</option><option value="CANCELLED">Canceladas</option></select></div>
      <div className="grid gap-3">{filtered.map((invoice) => <article key={invoice._id} className="rounded-[26px] border bg-white p-5 shadow-sm"><div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr_.8fr_.7fr_auto] lg:items-center"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${tones[invoice.status]}`}>{labels[invoice.status]}</span><h3 className="mt-2 text-lg font-black">{invoice.restaurantId.tradeName || invoice.restaurantId.name}</h3><p className="text-xs text-stone-500">Referência: {monthLabel(invoice.period)} · vencimento {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('pt-BR') : '—'}</p></div><Metric label="Faturamento considerado" value={invoice.revenueCents === undefined ? 'Modelo anterior' : money(invoice.revenueCents)} /><Metric label="Vendas consideradas" value={String(invoice.completedOrderCount)} /><Metric label="Mensalidade" value={money(invoice.amountCents)} /><div className="flex flex-wrap gap-2 lg:justify-end"><button type="button" onClick={() => void downloadInvoicePdf(invoice)} className="rounded-xl border px-3 py-2 text-xs font-black">📄 PDF</button>{!['PAID','CANCELLED','WAIVED'].includes(invoice.status) && <><button disabled={busy} onClick={() => void changeStatus(invoice,'PAID')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white">Pago</button><button disabled={busy} onClick={() => void changeStatus(invoice,'WAIVED')} className="rounded-xl border px-3 py-2 text-xs font-black">Isentar</button><button disabled={busy} onClick={() => void changeStatus(invoice,'CANCELLED')} className="rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-700">Cancelar</button></>}<button disabled={busy} onClick={() => void deleteInvoice(invoice)} className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100">🗑️ Excluir</button></div></div></article>)}{!filtered.length && <div className="rounded-[26px] border border-dashed bg-white p-10 text-center text-stone-500"><strong className="block text-stone-800">Nenhuma cobrança neste período</strong><span className="text-sm">A cobrança é criada automaticamente no dia 1º. Use “Gerar / conferir agora” apenas se precisar reprocessar.</span></div>}</div>
    </section>
  </section>;
}

function Card({label,value}:{label:string;value:string}) { return <div className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/70">{label}</p><strong className="mt-1 block text-xl font-black">{value}</strong></div>; }
function Tier({label,price}:{label:string;price:string}) { return <div className="rounded-2xl border bg-background/50 p-4"><p className="text-xs font-bold text-stone-500">{label}</p><strong className="mt-1 block text-xl font-black">{price}</strong></div>; }
function Metric({label,value}:{label:string;value:string}) { return <div><p className="text-[10px] font-black uppercase tracking-[.12em] text-stone-400">{label}</p><strong className="mt-1 block text-base">{value}</strong></div>; }
