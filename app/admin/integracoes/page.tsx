'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../../../components/dashboard/DashboardContext';

type RappidexStore = {
  restaurantId: string;
  name: string;
  legalName: string;
  city: string;
  state: string;
  open: boolean;
  blocked: boolean;
  deliveryEnabled: boolean;
};

export default function AdminIntegracoesPage() {
  const { request } = useDashboard();
  const [stores, setStores] = useState<RappidexStore[]>([]);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      setStores(await request<RappidexStore[]>('/restaurants/integrations/rappidex'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as integrações.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cities = useMemo(
    () => Array.from(new Set(stores.map((store) => [store.city, store.state].filter(Boolean).join(' / ')).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [stores],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return stores.filter((store) => {
      const storeCity = [store.city, store.state].filter(Boolean).join(' / ');
      const matchesSearch = !term || [store.name, store.legalName, store.city, store.state, store.restaurantId].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term));
      return matchesSearch && (!city || storeCity === city);
    });
  }, [city, search, stores]);

  async function copyId(store: RappidexStore) {
    try {
      await navigator.clipboard.writeText(store.restaurantId);
      setMessage(`ID da empresa ${store.name} copiado com sucesso.`);
    } catch {
      setMessage(`Não foi possível copiar automaticamente. ID: ${store.restaurantId}`);
    }
  }

  const deliveryCount = stores.filter((store) => store.deliveryEnabled).length;
  const openCount = stores.filter((store) => store.open && !store.blocked).length;

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="mf-panel rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.18em] text-primary">Conexões externas</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-[2.35rem]">Integrações</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500 sm:text-base">Consulte os identificadores das empresas do Menu Flow usados para vincular serviços externos, como a integração de entregas com a Rappidex.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Metric label="Empresas disponíveis" value={stores.length} />
          <Metric label="Com entrega ativa" value={deliveryCount} tone="success" />
          <Metric label="Abertas agora" value={openCount} tone="gold" />
        </div>
      </header>

      <article className="overflow-hidden rounded-[30px] border border-border/90 bg-white shadow-[0_14px_36px_rgba(41,37,36,.05)]">
        <div className="flex flex-col gap-4 border-b border-border bg-[linear-gradient(135deg,rgba(120,47,49,.055),rgba(212,123,75,.035))] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-4">
            <span className="grid h-12 min-w-12 place-items-center rounded-[16px] bg-ink px-3 text-xs font-black text-white shadow-sm">RAPPIDEX</span>
            <div>
              <h2 className="text-xl font-black tracking-tight text-stone-900">Integração de entregas</h2>
              <p className="mt-1 text-sm text-stone-500">Vinculação por ID de empresa Menu Flow.</p>
            </div>
          </div>
          <span className="inline-flex self-start rounded-full bg-success/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-success sm:self-auto">Integração disponível</span>
        </div>
        <div className="p-5 sm:p-6">
          <p className="max-w-4xl text-sm leading-6 text-stone-600">Copie o ID da empresa no Menu Flow e informe na empresa correspondente em <b>Rappidex → Empresas cadastradas → Integração Menu Flow</b>. A ativação é feita na Rappidex.</p>
          <div className="mt-4 rounded-[22px] border border-gold/25 bg-gold/10 p-4 text-sm leading-6 text-stone-700"><b>Importante:</b> pedidos de retirada não são enviados para a Rappidex. Pedidos de entrega só são criados quando a empresa correspondente estiver vinculada e com a integração Menu Flow ativa.</div>
        </div>
      </article>

      <div className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-accent">Empresas integráveis</span>
            <h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Localizar estabelecimento</h2>
          </div>
          <span className="rounded-2xl border border-border bg-background/55 px-4 py-2.5 text-sm font-semibold text-stone-600">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</span>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <input className="field !mt-0" placeholder="Buscar loja, cidade ou ID" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="field !mt-0" value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">Todas as cidades</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      {message && <p aria-live="polite" className="rounded-[22px] border border-border bg-surface px-4 py-3 text-sm font-semibold text-stone-700">{message}</p>}

      <div className="grid gap-4 lg:hidden">
        {loading ? <div className="h-40 animate-pulse rounded-[28px] bg-stone-200" /> : filtered.map((store) => (
          <article key={store.restaurantId} className="rounded-[28px] border border-border/90 bg-white p-5 shadow-[0_12px_32px_rgba(41,37,36,.05)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><h3 className="font-black text-stone-900">{store.name}</h3>{store.legalName !== store.name && <p className="mt-1 text-xs text-stone-500">{store.legalName}</p>}</div>
              <StoreStatus store={store} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="Cidade / UF" value={[store.city, store.state].filter(Boolean).join(' / ') || '—'} /><Info label="Entrega Menu Flow" value={store.deliveryEnabled ? 'Ativa' : 'Desativada'} /></div>
            <div className="mt-4 rounded-[20px] border border-border bg-background/50 p-4"><span className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">ID da empresa Menu Flow</span><code className="mt-2 block break-all text-xs font-bold text-stone-700">{store.restaurantId}</code></div>
            <button type="button" onClick={() => void copyId(store)} className="mt-4 min-h-11 w-full rounded-2xl bg-ink px-4 text-sm font-black text-white shadow-sm">Copiar ID</button>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-[30px] border border-border/90 bg-white shadow-[0_14px_36px_rgba(41,37,36,.05)] lg:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-background/70"><tr>{['Estabelecimento', 'Cidade / UF', 'Situação da loja', 'Entrega Menu Flow', 'ID da empresa Menu Flow', 'Ação'].map((label) => <th key={label} className="px-5 py-4 text-[11px] font-black uppercase tracking-[.12em] text-stone-500">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-border">
              {loading ? <tr><td colSpan={6} className="p-8 text-center text-stone-500">Carregando integrações...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-stone-500">Nenhum estabelecimento encontrado.</td></tr> : filtered.map((store) => (
                <tr key={store.restaurantId} className="transition hover:bg-background/35">
                  <td className="px-5 py-4"><b className="block text-stone-900">{store.name}</b>{store.legalName !== store.name && <span className="mt-1 block text-xs text-stone-500">{store.legalName}</span>}</td>
                  <td className="px-5 py-4 font-semibold text-stone-600">{[store.city, store.state].filter(Boolean).join(' / ') || '—'}</td>
                  <td className="px-5 py-4"><StoreStatus store={store} /></td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${store.deliveryEnabled ? 'bg-success/10 text-success' : 'bg-stone-100 text-stone-600'}`}>{store.deliveryEnabled ? 'Ativa' : 'Desativada'}</span></td>
                  <td className="px-5 py-4"><code className="break-all rounded-xl bg-background px-2.5 py-1.5 text-xs font-bold text-stone-700">{store.restaurantId}</code></td>
                  <td className="px-5 py-4"><button type="button" onClick={() => void copyId(store)} className="min-h-10 rounded-2xl bg-ink px-4 text-xs font-black text-white shadow-sm">Copiar ID</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, tone = 'primary' }: { label: string; value: number; tone?: 'primary' | 'success' | 'gold' }) {
  const toneClass = tone === 'success' ? 'bg-success/10 text-success' : tone === 'gold' ? 'bg-gold/20 text-amber-700' : 'bg-primary/10 text-primary';
  return <article className="rounded-[24px] border border-border/90 bg-white p-5 shadow-[0_12px_30px_rgba(41,37,36,.05)]"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-stone-500">{label}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] ${toneClass}`}>Resumo</span></div><strong className="mt-3 block text-[30px] font-black tracking-tight text-stone-900">{value}</strong></article>;
}

function StoreStatus({ store }: { store: RappidexStore }) {
  const config = store.blocked ? ['Bloqueada', 'bg-danger/10 text-danger'] : store.open ? ['Aberta', 'bg-success/10 text-success'] : ['Pausada', 'bg-warning/10 text-warning'];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${config[1]}`}>{config[0]}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[18px] border border-border bg-background/45 px-4 py-3"><span className="block text-[10px] font-black uppercase tracking-[.13em] text-stone-400">{label}</span><b className="mt-1 block text-sm text-stone-700">{value}</b></div>;
}
