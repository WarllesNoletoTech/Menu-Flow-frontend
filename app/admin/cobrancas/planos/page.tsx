'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useDashboard } from '../../../../components/dashboard/DashboardContext';

type Tier = { minOrders: number; maxOrders: number | null; amountCents: number };
type Plan = { _id: string; name: string; active: boolean; isDefault: boolean; dueDay?: number; tiers: Tier[] };
type PlanForm = { name: string; active: boolean; isDefault: boolean; dueDay: string | number; tiers: Array<{ minOrders: number | string; maxOrders: number | string | null; amountCents: number | string }> };

const blank: PlanForm = { name: '', active: true, isDefault: false, dueDay: '', tiers: [{ minOrders: 0, maxOrders: null, amountCents: 0 }] };

export default function Page() {
  const { request } = useDashboard();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<PlanForm>(blank);
  const [editing, setEditing] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try { setPlans(await request<Plan[]>('/billing/plans')); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os planos.'); }
  }
  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await request(editing ? `/billing/plans/${editing}` : '/billing/plans', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...form,
          dueDay: form.dueDay ? +form.dueDay : undefined,
          tiers: form.tiers.map((tier) => ({ ...tier, minOrders: +tier.minOrders, maxOrders: tier.maxOrders === null ? null : +tier.maxOrders, amountCents: +tier.amountCents })),
        }),
      });
      setForm(blank);
      setEditing('');
      await load();
      setMessage(editing ? 'Plano atualizado com sucesso.' : 'Plano criado com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar o plano.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <header className="mf-panel rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.18em] text-primary">Configuração financeira</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-[2.35rem]">Planos de cobrança</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500 sm:text-base">Configure faixas de cobrança por quantidade de pedidos, vencimento e plano padrão. Os valores são informados em centavos.</p>
        </div>
      </header>

      <form onSubmit={save} className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
        <div className="border-b border-border pb-5"><span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-accent">{editing ? 'Edição de plano' : 'Novo plano'}</span><h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">{editing ? 'Editar plano de cobrança' : 'Criar plano de cobrança'}</h2></div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="font-bold text-stone-800">Nome<input required className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="font-bold text-stone-800">Dia de vencimento<input min="1" max="28" type="number" className="field" value={form.dueDay} onChange={(event) => setForm({ ...form, dueDay: event.target.value })} /></label>
          <label className="mt-7 flex min-h-12 items-center gap-3 rounded-2xl border border-border bg-background/55 px-4 font-bold text-stone-700"><input type="checkbox" className="h-5 w-5 accent-primary" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} /> Plano padrão</label>
        </div>

        <div className="mt-6 rounded-[26px] border border-border bg-background/45 p-4 sm:p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-lg font-black tracking-tight text-stone-900">Faixas de cobrança</h3><p className="text-sm text-stone-500">Defina intervalos contínuos de pedidos e seus respectivos valores.</p></div><button type="button" className="min-h-10 rounded-2xl border border-border bg-white px-4 text-xs font-black text-stone-700" onClick={() => setForm({ ...form, tiers: [...form.tiers, { minOrders: 0, maxOrders: null, amountCents: 0 }] })}>+ Adicionar faixa</button></div>
          <div className="mt-4 grid gap-3">
            {form.tiers.map((tier, index) => (
              <div className="grid gap-3 rounded-[22px] border border-border bg-white p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" key={index}>
                <label className="text-sm font-bold text-stone-700">Mínimo de pedidos<input className="field" aria-label="Mínimo" type="number" min="0" value={tier.minOrders} onChange={(event) => setForm({ ...form, tiers: form.tiers.map((item, itemIndex) => itemIndex === index ? { ...item, minOrders: event.target.value } : item) })} /></label>
                <label className="text-sm font-bold text-stone-700">Máximo de pedidos<input className="field" aria-label="Máximo; vazio para ilimitado" type="number" min="0" value={tier.maxOrders ?? ''} onChange={(event) => setForm({ ...form, tiers: form.tiers.map((item, itemIndex) => itemIndex === index ? { ...item, maxOrders: event.target.value === '' ? null : event.target.value } : item) })} /></label>
                <label className="text-sm font-bold text-stone-700">Valor em centavos<input className="field" aria-label="Valor em centavos" type="number" min="0" value={tier.amountCents} onChange={(event) => setForm({ ...form, tiers: form.tiers.map((item, itemIndex) => itemIndex === index ? { ...item, amountCents: event.target.value } : item) })} /></label>
                <button type="button" className="min-h-11 rounded-2xl border border-danger/15 bg-danger/10 px-4 text-xs font-black text-danger" onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, itemIndex) => itemIndex !== index) })}>Remover</button>
              </div>
            ))}
          </div>
        </div>

        {message && <p className="mt-5 rounded-[20px] border border-border bg-background/55 p-3 text-sm font-semibold text-stone-700">{message}</p>}
        <div className="mt-6 flex justify-end border-t border-border pt-5"><button disabled={busy} className="min-h-11 rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">{busy ? 'Salvando…' : editing ? 'Salvar plano' : 'Criar plano'}</button></div>
      </form>

      <div>
        <div className="mb-4 flex items-end justify-between gap-3"><div><span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary">Planos cadastrados</span><h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">Estrutura atual</h2></div><span className="text-sm font-semibold text-stone-500">{plans.length} {plans.length === 1 ? 'plano' : 'planos'}</span></div>
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => <article className="rounded-[28px] border border-border/90 bg-white p-5 shadow-[0_12px_32px_rgba(41,37,36,.05)]" key={plan._id}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${plan.active ? 'bg-success/10 text-success' : 'bg-stone-100 text-stone-600'}`}>{plan.active ? 'Ativo' : 'Arquivado'}</span>{plan.isDefault && <span className="rounded-full bg-gold/20 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-amber-700">Padrão</span>}</div><strong className="mt-3 block text-xl font-black tracking-tight text-stone-900">{plan.name}</strong>{plan.dueDay && <p className="mt-1 text-sm text-stone-500">Vencimento: dia {plan.dueDay}</p>}</div><button className="min-h-10 rounded-2xl border border-border bg-white px-4 text-xs font-black text-stone-700" onClick={() => { setEditing(plan._id); setForm({ ...plan, dueDay: plan.dueDay || '' }); }}>Editar</button></div><div className="mt-4 rounded-[20px] border border-border bg-background/50 p-4"><p className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">Faixas configuradas</p><p className="mt-2 text-sm leading-6 text-stone-700">{plan.tiers.map((tier) => `${tier.minOrders}–${tier.maxOrders ?? 'sem limite'} pedidos: ${(tier.amountCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`).join(' • ')}</p></div></article>)}
        </div>
      </div>
    </section>
  );
}
