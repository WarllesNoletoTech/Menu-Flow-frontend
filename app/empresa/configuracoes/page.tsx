'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useEmpresa } from '../../../components/empresa/EmpresaContext';

const paymentLabels: Record<string, string> = {
  PIX: 'PIX',
  CASH: 'Dinheiro',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
};
type Zone = { _id: string; name: string; fee: number; active: boolean };
type Payment = { _id: string; name: string; method: string; active: boolean };

export default function Page() {
  const { establishment, settings, request, refreshCompany } = useEmpresa();
  const [form, setForm] = useState({ minimumOrder: '', preparationMinutes: '', rappidexEnabled: false, pickupEnabled: true, deliveryEnabled: false, open: true });
  const [operations, setOperations] = useState<{ deliveryZones: Zone[]; paymentMethods: Payment[] }>({ deliveryZones: [], paymentMethods: [] });
  const [zone, setZone] = useState({ name: '', fee: '' });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadOperations() {
    setOperations(await request('/restaurants/me/operations'));
  }

  useEffect(() => {
    if (settings && establishment) setForm({ minimumOrder: String(settings.minimumOrder ?? 0), preparationMinutes: String(settings.preparationMinutes ?? ''), rappidexEnabled: settings.rappidexEnabled, pickupEnabled: settings.pickupEnabled ?? true, deliveryEnabled: settings.deliveryEnabled ?? false, open: establishment.open });
  }, [settings, establishment]);
  useEffect(() => { void loadOperations().catch((error) => setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as opções.')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      await Promise.all([
        request('/restaurants/me/settings', { method: 'PATCH', body: JSON.stringify({ minimumOrder: Number(form.minimumOrder), preparationMinutes: form.preparationMinutes ? Number(form.preparationMinutes) : undefined, rappidexEnabled: form.rappidexEnabled, pickupEnabled: form.pickupEnabled, deliveryEnabled: form.deliveryEnabled }) }),
        request('/restaurants/me', { method: 'PATCH', body: JSON.stringify({ open: form.open }) }),
      ]);
      await refreshCompany();
      setMessage('Configurações salvas com sucesso.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }

  async function addZone(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    try {
      await request('/restaurants/me/delivery-zones', { method: 'POST', body: JSON.stringify({ name: zone.name, fee: Number(zone.fee), active: true }) });
      await loadOperations(); setZone({ name: '', fee: '' }); setMessage('Região de entrega salva.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a região.'); }
    finally { setBusy(false); }
  }

  async function togglePayment(method: string, active: boolean) {
    if (busy) return; setBusy(true); setMessage('');
    try {
      await request('/restaurants/me/payment-methods', { method: 'PATCH', body: JSON.stringify({ method, name: paymentLabels[method], active }) });
      await loadOperations(); setMessage('Forma de pagamento atualizada.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar.'); }
    finally { setBusy(false); }
  }

  async function toggleZone(item: Zone) {
    if (busy) return; setBusy(true); setMessage('');
    try {
      await request('/restaurants/me/delivery-zones', { method: 'POST', body: JSON.stringify({ id: item._id, name: item.name, fee: item.fee, active: !item.active }) });
      await loadOperations(); setMessage('Região de entrega atualizada.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar.'); }
    finally { setBusy(false); }
  }

  return <section className="mx-auto max-w-3xl">
    <h2 className="text-2xl font-black">Configurações</h2><p className="mt-1 text-stone-500">Defina quando e como sua loja recebe pedidos.</p>
    <article className="mt-6 flex flex-col items-start justify-between gap-4 rounded-2xl border bg-surface p-5 shadow-sm sm:flex-row sm:items-center"><div><h3 className="text-lg font-black">Horários de funcionamento</h3><p className="mt-1 text-sm text-stone-500">Configure os dias e horários em que sua loja recebe pedidos.</p></div><Link href="/empresa/horarios" className="shrink-0 rounded-xl bg-ink px-5 py-3 font-bold text-white">Configurar horários</Link></article>
    <form onSubmit={save} className="mt-6 space-y-5 rounded-2xl bg-surface p-5 shadow-sm">
      <label className="flex items-center justify-between gap-4 rounded-xl border p-4"><span><strong className="block">Receber pedidos</strong><small className="text-stone-500">Pause temporariamente sem alterar seus horários.</small></span><input type="checkbox" className="h-6 w-6 accent-ink" checked={form.open} onChange={(event) => setForm({ ...form, open: event.target.checked })}/></label>
      <div><h3 className="font-black">Formas de atendimento</h3><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-xl border p-4 font-bold"><input type="checkbox" checked={form.pickupEnabled} onChange={e=>setForm({...form,pickupEnabled:e.target.checked})}/> Retirada no local</label><label className="flex items-center gap-3 rounded-xl border p-4 font-bold"><input type="checkbox" checked={form.deliveryEnabled} onChange={e=>setForm({...form,deliveryEnabled:e.target.checked})}/> Entrega</label></div>{!form.pickupEnabled&&!form.deliveryEnabled&&<p className="mt-2 text-sm font-bold text-danger">Ative pelo menos uma forma para receber pedidos.</p>}</div><div className="grid gap-4 sm:grid-cols-2"><label className="font-bold">Pedido mínimo (R$)<input min="0" step="0.01" type="number" className="field" value={form.minimumOrder} onChange={(event) => setForm({ ...form, minimumOrder: event.target.value })}/></label><label className="font-bold">Tempo de preparo (minutos)<input min="0" type="number" className="field" value={form.preparationMinutes} onChange={(event) => setForm({ ...form, preparationMinutes: event.target.value })}/></label></div>
      <label className="flex items-center gap-3 font-bold"><input type="checkbox" className="h-5 w-5 accent-ink" checked={form.rappidexEnabled} onChange={(event) => setForm({ ...form, rappidexEnabled: event.target.checked })}/>Integração Rappidex ativa</label>
      <button disabled={busy || (!form.pickupEnabled && !form.deliveryEnabled)} className="rounded-xl bg-ink px-6 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar configurações'}</button>
    </form>
    <section className="mt-6 rounded-2xl bg-surface p-5 shadow-sm"><h3 className="text-lg font-black">Entrega</h3><p className="text-sm text-stone-500">A entrega só será oferecida onde houver uma região ativa.</p>{form.deliveryEnabled&&!operations.deliveryZones.some(item=>item.active)&&<p role="alert" className="mt-3 rounded-xl bg-gold/15 p-3 font-bold text-ink">Entrega está ativada, mas nenhuma região de entrega ativa foi cadastrada.</p>}<form onSubmit={addZone} className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]"><input required className="field !mt-0" placeholder="Bairro ou região" value={zone.name} onChange={(event) => setZone({ ...zone, name: event.target.value })}/><input required min="0" step="0.01" type="number" className="field !mt-0" placeholder="Taxa (R$)" value={zone.fee} onChange={(event) => setZone({ ...zone, fee: event.target.value })}/><button disabled={busy} className="rounded-xl bg-ink px-4 font-bold text-white disabled:opacity-50">Adicionar</button></form><div className="mt-4 space-y-2">{operations.deliveryZones.map((item) => <div key={item._id} className="flex items-center justify-between rounded-xl border p-3"><span><b>{item.name}</b> · {item.fee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><button disabled={busy} onClick={() => void toggleZone(item)} className="font-bold underline">{item.active ? 'Desativar' : 'Ativar'}</button></div>)}</div></section>
    <section className="mt-6 rounded-2xl bg-surface p-5 shadow-sm"><h3 className="text-lg font-black">Formas de pagamento</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(paymentLabels).map(([method, label]) => { const configured = operations.paymentMethods.find((item) => item.method === method); return <label key={method} className="flex items-center justify-between rounded-xl border p-4 font-bold"><span>{label}</span><input type="checkbox" checked={configured?.active ?? false} disabled={busy} onChange={(event) => void togglePayment(method, event.target.checked)}/></label>; })}</div></section>
    {message && <p aria-live="polite" className="mt-5 rounded-xl bg-surface p-3">{message}</p>}
  </section>;
}
