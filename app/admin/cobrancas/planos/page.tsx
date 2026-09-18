'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../../../../components/dashboard/DashboardContext';

type Tier = { minRevenueCents: number; maxRevenueCents: number | null; amountCents: number; minOrders?: number; maxOrders?: number | null };
type Plan = { _id: string; name: string; active: boolean; isDefault: boolean; tiers: Tier[] };
type TierForm = { min: string; max: string; amount: string };
type PlanForm = { name: string; active: boolean; isDefault: boolean; tiers: TierForm[] };

const money = (cents = 0) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const cents = (value: string) => Math.round((Number(value.replace(',', '.')) || 0) * 100);
const reais = (value?: number | null) => value === null || value === undefined ? '' : (value / 100).toFixed(2).replace('.', ',');
const defaultTiers: TierForm[] = [
  { min: '0,00', max: '1000,00', amount: '49,90' },
  { min: '1000,01', max: '3500,00', amount: '69,90' },
  { min: '3500,01', max: '', amount: '129,90' },
];
const blank: PlanForm = { name: 'Menu Flow por faturamento', active: true, isDefault: true, tiers: defaultTiers };

export default function Page() {
  const { request } = useDashboard();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<PlanForm>(blank);
  const [editing, setEditing] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setPlans(await request<Plan[]>('/billing/plans', { cache: 'no-store' })); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as faixas.'); }
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activePlan = useMemo(() => plans.find((plan) => plan.isDefault && plan.tiers?.some((tier) => tier.minRevenueCents !== undefined)), [plans]);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const payload = {
        name: form.name.trim(), active: form.active, isDefault: form.isDefault,
        tiers: form.tiers.map((tier) => ({
          minRevenueCents: cents(tier.min),
          maxRevenueCents: tier.max.trim() ? cents(tier.max) : null,
          amountCents: cents(tier.amount),
        })),
      };
      await request(editing ? `/billing/plans/${editing}` : '/billing/plans', { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setEditing(''); setForm(blank); await load();
      setMessage('Faixas de cobrança salvas com sucesso. As cobranças antigas não são alteradas.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar as faixas.'); }
    finally { setBusy(false); }
  }

  function edit(plan: Plan) {
    if (!plan.tiers?.some((tier) => tier.minRevenueCents !== undefined)) { setMessage('Este é um plano legado por quantidade de pedidos. Ele não é usado nas novas cobranças.'); return; }
    setEditing(plan._id);
    setForm({
      name: plan.name, active: plan.active, isDefault: plan.isDefault,
      tiers: plan.tiers.map((tier) => ({ min: reais(tier.minRevenueCents), max: reais(tier.maxRevenueCents), amount: reais(tier.amountCents) })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <section className="mx-auto max-w-6xl space-y-6">
    <header className="overflow-hidden rounded-[32px] bg-gradient-to-r from-ink via-[#6f1c21] to-[#8f242a] px-5 py-6 text-white shadow-xl sm:px-7">
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-lime">Cobrança Menu Flow</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight">Faixas por faturamento</h1><p className="mt-2 max-w-2xl text-sm text-white/75">A mensalidade é definida pelo faturamento elegível do mês anterior. Não há cobrança por pedido.</p></div><span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black">Vencimento: 1ª terça-feira</span></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">{(activePlan?.tiers ?? []).map((tier, index) => <div key={index} className="rounded-2xl bg-white/10 p-4"><p className="text-xs text-white/70">{tier.maxRevenueCents === null ? `Acima de ${money(tier.minRevenueCents - 1)}` : index === 0 ? `Até ${money(tier.maxRevenueCents)}` : `${money(tier.minRevenueCents)} a ${money(tier.maxRevenueCents)}`}</p><strong className="mt-1 block text-2xl font-black">{money(tier.amountCents)}</strong></div>)}</div>
    </header>

    <form onSubmit={save} className="rounded-[30px] border border-border bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Configuração</p><h2 className="mt-1 text-xl font-black">{editing ? 'Editar cobrança' : 'Modelo de cobrança'}</h2></div>{editing && <button type="button" onClick={() => { setEditing(''); setForm(blank); }} className="rounded-xl border px-4 py-2 text-xs font-black">Cancelar edição</button>}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]"><label className="font-bold">Nome<input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className="mt-7 flex min-h-12 items-center gap-2 rounded-2xl border px-4 font-bold"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Modelo padrão</label></div>
      <div className="mt-5 space-y-3">{form.tiers.map((tier, index) => <div key={index} className="grid gap-3 rounded-2xl border bg-background/40 p-4 sm:grid-cols-3"><label className="text-sm font-bold">Faturamento mínimo (R$)<input className="field" inputMode="decimal" value={tier.min} onChange={(e) => setForm({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, min: e.target.value } : item) })} /></label><label className="text-sm font-bold">Faturamento máximo (R$)<input className="field" inputMode="decimal" placeholder="Sem limite" value={tier.max} onChange={(e) => setForm({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, max: e.target.value } : item) })} /></label><label className="text-sm font-bold">Mensalidade (R$)<input className="field" inputMode="decimal" value={tier.amount} onChange={(e) => setForm({ ...form, tiers: form.tiers.map((item, i) => i === index ? { ...item, amount: e.target.value } : item) })} /></label></div>)}</div>
      <p className="mt-4 rounded-2xl bg-background p-4 text-sm text-stone-600"><b>Base de cobrança:</b> produtos vendidos − descontos. Taxa de entrega, taxa de serviço do garçom e pedidos cancelados não entram no cálculo.</p>
      {message && <p className="mt-4 rounded-2xl border bg-white p-3 text-sm font-bold">{message}</p>}
      <div className="mt-5 flex justify-end"><button disabled={busy} className="rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar faixas'}</button></div>
    </form>

    <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-black">Histórico de modelos</h2><span className="text-sm text-stone-500">{plans.length} cadastrado(s)</span></div><div className="grid gap-3 md:grid-cols-2">{plans.map((plan) => { const revenue = plan.tiers?.some((tier) => tier.minRevenueCents !== undefined); return <article key={plan._id} className={`rounded-[26px] border bg-white p-5 shadow-sm ${!revenue ? 'opacity-60' : ''}`}><div className="flex items-start justify-between gap-3"><div><div className="flex gap-2">{plan.isDefault && <span className="rounded-full bg-gold/20 px-2 py-1 text-[10px] font-black">PADRÃO</span>}{!revenue && <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-black">LEGADO</span>}</div><h3 className="mt-2 font-black">{plan.name}</h3></div><button type="button" onClick={() => edit(plan)} className="rounded-xl border px-3 py-2 text-xs font-black">Editar</button></div><div className="mt-3 text-sm text-stone-600">{revenue ? plan.tiers.map((tier) => `${tier.maxRevenueCents === null ? 'Acima de ' + money(tier.minRevenueCents - 1) : money(tier.minRevenueCents) + '–' + money(tier.maxRevenueCents)}: ${money(tier.amountCents)}`).join(' • ') : 'Plano antigo por quantidade de pedidos. Mantido somente para histórico.'}</div></article>; })}</div></section>
  </section>;
}
