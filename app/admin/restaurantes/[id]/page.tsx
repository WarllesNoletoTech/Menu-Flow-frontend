'use client';

import Link from 'next/link';
import { FormEvent, use, useCallback, useEffect, useState } from 'react';
import { PAYMENT_METHOD_LABELS, paymentMethodLabel } from '../../../../lib/payment-methods';
import { BusinessHoursEditor } from '../../../../components/empresa/BusinessHoursEditor';
import { CatalogManager } from '../../../../components/empresa/CatalogManager';
import { useDashboard } from '../../../../components/dashboard/DashboardContext';

type Zone = { _id: string; name: string; coverageType?: 'ALL' | 'SPECIFIC'; fee: number; feeCents?: number; active: boolean };
type Payment = { _id: string; name: string; method: string; active: boolean };
type Detail = {
  establishment: { _id: string; name: string; tradeName?: string; slug: string; city?: string; state?: string; address?: string; mapUrl?: string; pickupInstructions?: string; open?: boolean };
  owner?: { name: string; email: string } | null;
  settings?: { minimumOrder?: number; preparationMinutes?: number; pickupEnabled?: boolean; deliveryEnabled?: boolean };
  deliveryZones: Zone[];
  paymentMethods: Payment[];
};

type Tab = 'overview' | 'settings' | 'hours' | 'catalog';

type ConfigForm = {
  minimumOrder: string;
  preparationMinutes: string;
  pickupEnabled: boolean;
  deliveryEnabled: boolean;
  open: boolean;
};

const initialConfig: ConfigForm = {
  minimumOrder: '0',
  preparationMinutes: '',
  pickupEnabled: true,
  deliveryEnabled: false,
  open: true,
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { request } = useDashboard();
  const [tab, setTab] = useState<Tab>('overview');
  const [detail, setDetail] = useState<Detail>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<ConfigForm>(initialConfig);
  const [zone, setZone] = useState<{ id?: string; name: string; fee: string }>({ name: '', fee: '' });
  const [coverageType, setCoverageType] = useState<'ALL' | 'SPECIFIC'>('SPECIFIC');
  const [allFee, setAllFee] = useState('');

  const applyDetail = useCallback((data: Detail) => {
    setDetail(data);
    setConfig({
      minimumOrder: String(data.settings?.minimumOrder ?? 0),
      preparationMinutes: data.settings?.preparationMinutes === undefined ? '' : String(data.settings.preparationMinutes),
      pickupEnabled: data.settings?.pickupEnabled ?? true,
      deliveryEnabled: data.settings?.deliveryEnabled ?? false,
      open: data.establishment?.open ?? true,
    });
    const universal = data.deliveryZones?.find((item) => item.coverageType === 'ALL');
    const activeUniversal = data.deliveryZones?.some((item) => item.coverageType === 'ALL' && item.active);
    setCoverageType(activeUniversal ? 'ALL' : 'SPECIFIC');
    setAllFee(universal ? String((universal.feeCents ?? Math.round(universal.fee * 100)) / 100) : '');
  }, []);

  const loadDetail = useCallback(async () => {
    setError('');
    try {
      const data = await request<Detail>(`/restaurants/${id}/admin-detail`, { cache: 'no-store' });
      applyDetail(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o estabelecimento.');
    }
  }, [applyDetail, id, request]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (busy || (!config.pickupEnabled && !config.deliveryEnabled)) return;
    setBusy(true);
    setMessage('');
    try {
      await Promise.all([
        request(`/restaurants/${id}/settings`, {
          method: 'PATCH',
          body: JSON.stringify({
            minimumOrder: Number(config.minimumOrder),
            preparationMinutes: config.preparationMinutes ? Number(config.preparationMinutes) : undefined,
            pickupEnabled: config.pickupEnabled,
            deliveryEnabled: config.deliveryEnabled,
          }),
        }),
        request(`/restaurants/${id}`, { method: 'PATCH', body: JSON.stringify({ open: config.open }) }),
      ]);
      await loadDetail();
      setMessage('Configurações do estabelecimento salvas com sucesso.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível salvar as configurações.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSpecificZone(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await request(`/restaurants/${id}/delivery-zones`, {
        method: 'POST',
        body: JSON.stringify({ id: zone.id, coverageType: 'SPECIFIC', name: zone.name, fee: Number(zone.fee), active: true }),
      });
      await loadDetail();
      setZone({ name: '', fee: '' });
      setCoverageType('SPECIFIC');
      setMessage(zone.id ? 'Região de entrega editada com sucesso.' : 'Região de entrega adicionada com sucesso.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível salvar a região de entrega.');
    } finally {
      setBusy(false);
    }
  }

  async function saveUniversalZone(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const current = detail?.deliveryZones.find((item) => item.coverageType === 'ALL');
      await request(`/restaurants/${id}/delivery-zones`, {
        method: 'POST',
        body: JSON.stringify({ id: current?._id, coverageType: 'ALL', fee: Number(allFee), active: true }),
      });
      await loadDetail();
      setCoverageType('ALL');
      setMessage('Taxa única de entrega salva com sucesso.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível salvar a taxa de entrega.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleZone(item: Zone) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await request(`/restaurants/${id}/delivery-zones`, {
        method: 'POST',
        body: JSON.stringify({
          id: item._id,
          coverageType: item.coverageType ?? 'SPECIFIC',
          name: item.name,
          fee: item.feeCents !== undefined ? item.feeCents / 100 : item.fee,
          active: !item.active,
        }),
      });
      await loadDetail();
      setMessage('Região de entrega atualizada com sucesso.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível atualizar a região de entrega.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePayment(method: string, active: boolean) {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await request(`/restaurants/${id}/payment-methods`, {
        method: 'PATCH',
        body: JSON.stringify({ method, name: PAYMENT_METHOD_LABELS[method], active }),
      });
      await loadDetail();
      setMessage('Forma de pagamento atualizada com sucesso.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Não foi possível atualizar a forma de pagamento.');
    } finally {
      setBusy(false);
    }
  }

  const establishment = detail?.establishment;
  const activeZones = detail?.deliveryZones?.filter((item) => item.active) ?? [];
  const activePayments = detail?.paymentMethods?.filter((method) => method.active) ?? [];
  const services = [detail?.settings?.pickupEnabled && 'Retirada', detail?.settings?.deliveryEnabled && 'Entrega'].filter(Boolean).join(' e ') || 'Não configurado';
  const deliveryZones = detail?.deliveryZones ?? [];
  const paymentMethods = detail?.paymentMethods ?? [];

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
        {([['overview', 'Visão geral'], ['settings', 'Configurações'], ['hours', 'Horários de funcionamento'], ['catalog', 'Cardápio']] as const).map(([value, label]) => <button type="button" key={value} onClick={() => { setTab(value); setMessage(''); }} className={`min-h-11 shrink-0 rounded-[16px] px-4 text-sm font-black transition ${tab === value ? 'bg-ink text-white shadow-sm' : 'text-stone-600 hover:bg-background'}`}>{label}</button>)}
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
            <article className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6"><span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-success">Entrega</span><h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Regiões ativas</h2><div className="mt-4 grid gap-3">{activeZones.length ? activeZones.map((item) => <div key={item._id} className="rounded-[20px] border border-border bg-background/45 p-4"><b className="block text-sm text-stone-800">{item.coverageType === 'ALL' ? 'Todos os bairros' : item.name}</b><span className="mt-1 block text-xs text-stone-500">Taxa: {((item.feeCents ?? Math.round(item.fee * 100)) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>) : <p className="rounded-[20px] border border-dashed border-border bg-background/45 p-4 text-sm text-stone-500">Nenhuma região ativa.</p>}</div></article>
            <article className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6"><span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary">Pagamentos</span><h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Métodos ativos</h2><div className="mt-4 flex flex-wrap gap-2">{activePayments.length ? activePayments.map((method) => <span key={method._id} className="rounded-full border border-border bg-background/55 px-3 py-2 text-xs font-black text-stone-700">{paymentMethodLabel(method.method, method.name)}</span>) : <span className="text-sm text-stone-500">Nenhum método ativo.</span>}</div></article>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="mx-auto max-w-4xl space-y-6">
          <header className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary">Controle administrativo</span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">Configurações do estabelecimento</h2>
            <p className="mt-1 text-sm font-semibold text-stone-500">O administrador pode alterar as mesmas opções operacionais disponíveis para o lojista.</p>
          </header>

          <form onSubmit={saveSettings} className="space-y-5 rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
            <label className="flex items-center justify-between gap-4 rounded-[20px] border border-border bg-background/45 p-4"><span><strong className="block text-stone-900">Receber pedidos</strong><small className="text-stone-500">Pause temporariamente a loja sem alterar os horários cadastrados.</small></span><input type="checkbox" className="h-6 w-6 accent-ink" checked={config.open} onChange={(event) => setConfig({ ...config, open: event.target.checked })} /></label>

            <div><h3 className="font-black text-stone-900">Formas de atendimento</h3><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className="flex items-center gap-3 rounded-[18px] border border-border p-4 font-bold"><input type="checkbox" checked={config.pickupEnabled} onChange={(event) => setConfig({ ...config, pickupEnabled: event.target.checked })} /> Retirada no local</label><label className="flex items-center gap-3 rounded-[18px] border border-border p-4 font-bold"><input type="checkbox" checked={config.deliveryEnabled} onChange={(event) => setConfig({ ...config, deliveryEnabled: event.target.checked })} /> Entrega</label></div>{!config.pickupEnabled && !config.deliveryEnabled && <p className="mt-2 text-sm font-bold text-danger">Ative pelo menos uma forma para receber pedidos.</p>}</div>

            <div className="grid gap-4 sm:grid-cols-2"><label className="font-bold">Pedido mínimo (R$)<input min="0" step="0.01" type="number" className="field" value={config.minimumOrder} onChange={(event) => setConfig({ ...config, minimumOrder: event.target.value })} /></label><label className="font-bold">Tempo de preparo (minutos)<input min="0" type="number" className="field" value={config.preparationMinutes} onChange={(event) => setConfig({ ...config, preparationMinutes: event.target.value })} /></label></div>

            <div className="flex flex-wrap gap-3"><button disabled={busy || (!config.pickupEnabled && !config.deliveryEnabled)} className="min-h-11 rounded-2xl bg-ink px-6 font-black text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar configurações'}</button><button type="button" onClick={() => setTab('hours')} className="min-h-11 rounded-2xl border border-border bg-white px-5 font-black text-stone-700">Editar horários</button></div>
          </form>

          <section className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
            <h3 className="text-lg font-black text-stone-900">Entrega</h3>
            <p className="mt-1 text-sm text-stone-500">Defina a taxa única ou os bairros atendidos por este estabelecimento.</p>
            {config.deliveryEnabled && !deliveryZones.some((item) => item.active) && <p role="alert" className="mt-3 rounded-xl bg-gold/15 p-3 font-bold text-ink">Entrega está ativada, mas nenhuma regra de entrega ativa foi cadastrada.</p>}

            <fieldset className="mt-4"><legend className="font-black">Tipo de cobertura</legend><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className={`rounded-[18px] border p-4 font-bold ${coverageType === 'ALL' ? 'border-ink bg-lime/20' : 'border-border'}`}><input className="mr-2" type="radio" checked={coverageType === 'ALL'} onChange={() => setCoverageType('ALL')} />Todos os bairros</label><label className={`rounded-[18px] border p-4 font-bold ${coverageType === 'SPECIFIC' ? 'border-ink bg-lime/20' : 'border-border'}`}><input className="mr-2" type="radio" checked={coverageType === 'SPECIFIC'} onChange={() => setCoverageType('SPECIFIC')} />Bairros específicos</label></div></fieldset>

            {coverageType === 'ALL' ? <form onSubmit={saveUniversalZone} className="mt-4 flex flex-wrap items-end gap-3"><label className="font-bold">Taxa única de entrega (R$)<input required min="0" step="0.01" type="number" className="field w-48" value={allFee} onChange={(event) => setAllFee(event.target.value)} /></label><button disabled={busy} className="min-h-11 rounded-2xl bg-ink px-5 font-black text-white disabled:opacity-50">Salvar taxa</button></form> : <><form onSubmit={saveSpecificZone} className="mt-4 grid gap-3 sm:grid-cols-[1fr_160px_auto]"><input required className="field !mt-0" placeholder="Bairro" value={zone.name} onChange={(event) => setZone({ ...zone, name: event.target.value })} /><input required min="0" step="0.01" type="number" className="field !mt-0" placeholder="Taxa (R$)" value={zone.fee} onChange={(event) => setZone({ ...zone, fee: event.target.value })} /><div className="flex gap-2"><button disabled={busy} className="rounded-2xl bg-ink px-4 font-black text-white disabled:opacity-50">{zone.id ? 'Salvar' : 'Adicionar'}</button>{zone.id && <button type="button" onClick={() => setZone({ name: '', fee: '' })} className="rounded-2xl border border-border px-3 font-black">Cancelar</button>}</div></form><div className="mt-4 space-y-2">{deliveryZones.filter((item) => item.coverageType !== 'ALL').map((item) => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-border bg-background/35 p-3"><span><b>{item.name}</b> · {(item.feeCents !== undefined ? item.feeCents / 100 : item.fee).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><span className="flex gap-3"><button disabled={busy} type="button" onClick={() => { setCoverageType('SPECIFIC'); setZone({ id: item._id, name: item.name, fee: String(item.feeCents !== undefined ? item.feeCents / 100 : item.fee) }); }} className="font-bold underline">Editar</button><button disabled={busy} type="button" onClick={() => void toggleZone(item)} className="font-bold underline">{item.active ? 'Desativar' : 'Ativar'}</button></span></div>)}</div></>}
          </section>

          <section className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
            <h3 className="text-lg font-black text-stone-900">Formas de pagamento</h3>
            <p className="mt-1 text-sm text-stone-500">Ative ou desative os meios de pagamento disponíveis ao cliente.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(PAYMENT_METHOD_LABELS).map(([method, label]) => { const configured = paymentMethods.find((item) => item.method === method); return <label key={method} className="flex items-center justify-between rounded-[18px] border border-border p-4 font-bold"><span>{label}</span><input type="checkbox" checked={configured?.active ?? false} disabled={busy} onChange={(event) => void togglePayment(method, event.target.checked)} /></label>; })}</div>
          </section>

          {message && <p aria-live="polite" className="rounded-[20px] border border-border bg-white p-4 font-semibold shadow-sm">{message}</p>}
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
