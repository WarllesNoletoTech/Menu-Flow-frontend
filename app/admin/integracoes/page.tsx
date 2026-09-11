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
  rappidexEnabled: boolean;
};

export default function AdminIntegracoesPage() {
  const { request } = useDashboard();
  const [stores, setStores] = useState<RappidexStore[]>([]);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState<'all'|'enabled'|'disabled'>('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
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

  const cities = useMemo(() => Array.from(new Set(stores.map((store) => [store.city, store.state].filter(Boolean).join(' / ')).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [stores]);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return stores.filter((store) => {
      const storeCity = [store.city, store.state].filter(Boolean).join(' / ');
      const matchesSearch = !term || [store.name, store.legalName, store.city, store.state].some((value) => value?.toLocaleLowerCase('pt-BR').includes(term));
      const matchesCity = !city || storeCity === city;
      const matchesStatus = status === 'all' || (status === 'enabled' ? store.rappidexEnabled : !store.rappidexEnabled);
      return matchesSearch && matchesCity && matchesStatus;
    });
  }, [city, search, status, stores]);

  const enabledCount = stores.filter((store) => store.rappidexEnabled).length;
  const deliveryCount = stores.filter((store) => store.deliveryEnabled).length;

  async function toggle(store: RappidexStore) {
    if (savingId) return;
    const enabled = !store.rappidexEnabled;
    setSavingId(store.restaurantId);
    setMessage('');
    try {
      await request(`/restaurants/${store.restaurantId}/integrations/rappidex`, { method: 'PATCH', body: JSON.stringify({ enabled }) });
      setStores((current) => current.map((item) => item.restaurantId === store.restaurantId ? { ...item, rappidexEnabled: enabled } : item));
      setMessage(`Integração Rappidex ${enabled ? 'ativada' : 'desativada'} para ${store.name}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar a integração.');
    } finally {
      setSavingId('');
    }
  }

  return <section className="mx-auto max-w-7xl">
    <header>
      <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Administração</p>
      <h1 className="mt-1 text-3xl font-black">Integrações</h1>
      <p className="mt-2 text-stone-500">Controle centralizado das integrações externas de cada estabelecimento.</p>
    </header>

    <section className="mt-7 rounded-2xl border border-stone-200 bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><span className="rounded-xl bg-ink px-3 py-2 text-sm font-black text-white">RAPPIDEX</span><h2 className="text-xl font-black">Integração de entregas</h2></div>
          <p className="mt-3 max-w-3xl text-sm text-stone-500">A ativação por loja é exclusiva do administrador do Menu Flow. O lojista não visualiza nem altera esta configuração.</p>
        </div>
        <div className="rounded-xl bg-background px-4 py-3 text-sm"><b>{enabledCount}</b> de <b>{stores.length}</b> lojas com Rappidex ativa</div>
      </div>
      <p className="mt-4 rounded-xl bg-gold/15 p-3 text-sm text-stone-700"><b>Conexão com a API:</b> esta tela controla quais lojas podem usar a Rappidex. O envio real da entrega para a Rappidex deve ser ligado ao adaptador do backend quando a URL, autenticação e contrato da API da Rappidex forem definidos.</p>
    </section>

    <div className="mt-6 grid gap-4 sm:grid-cols-3">
      <article className="rounded-2xl bg-surface p-5 shadow-sm"><p className="text-sm font-bold text-stone-500">Lojas cadastradas</p><strong className="mt-2 block text-3xl font-black">{stores.length}</strong></article>
      <article className="rounded-2xl bg-surface p-5 shadow-sm"><p className="text-sm font-bold text-stone-500">Rappidex ativa</p><strong className="mt-2 block text-3xl font-black">{enabledCount}</strong></article>
      <article className="rounded-2xl bg-surface p-5 shadow-sm"><p className="text-sm font-bold text-stone-500">Lojas com entrega</p><strong className="mt-2 block text-3xl font-black">{deliveryCount}</strong></article>
    </div>

    <div className="mt-6 grid gap-3 rounded-2xl bg-surface p-4 shadow-sm md:grid-cols-3">
      <input className="field !mt-0" placeholder="Buscar loja ou cidade" value={search} onChange={(event) => setSearch(event.target.value)}/>
      <select className="field !mt-0" value={city} onChange={(event) => setCity(event.target.value)}><option value="">Todas as cidades</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      <select className="field !mt-0" value={status} onChange={(event) => setStatus(event.target.value as 'all'|'enabled'|'disabled')}><option value="all">Todas as integrações</option><option value="enabled">Rappidex ativa</option><option value="disabled">Rappidex desativada</option></select>
    </div>

    {message && <p aria-live="polite" className="mt-5 rounded-xl bg-surface p-4 shadow-sm">{message}</p>}

    <div className="mt-5 overflow-x-auto rounded-2xl bg-surface shadow-sm">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead><tr>{['Estabelecimento','Cidade / UF','Loja','Entrega Menu Flow','Rappidex','Ação'].map((label) => <th key={label} className="p-4">{label}</th>)}</tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={6} className="p-6 text-center text-stone-500">Carregando integrações...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-stone-500">Nenhum estabelecimento encontrado.</td></tr> : filtered.map((store) => <tr key={store.restaurantId} className="border-t">
            <td className="p-4"><b className="block">{store.name}</b>{store.legalName !== store.name && <span className="text-xs text-stone-500">{store.legalName}</span>}</td>
            <td className="p-4">{[store.city, store.state].filter(Boolean).join(' / ') || '—'}</td>
            <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${store.blocked ? 'bg-danger/10 text-danger' : store.open ? 'bg-lime/30 text-ink' : 'bg-stone-100 text-stone-600'}`}>{store.blocked ? 'Bloqueada' : store.open ? 'Aberta' : 'Pausada'}</span></td>
            <td className="p-4"><span className={`font-bold ${store.deliveryEnabled ? 'text-emerald-700' : 'text-stone-500'}`}>{store.deliveryEnabled ? 'Ativa' : 'Desativada'}</span></td>
            <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${store.rappidexEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>{store.rappidexEnabled ? 'ATIVA' : 'DESATIVADA'}</span></td>
            <td className="p-4"><button type="button" disabled={!!savingId} onClick={() => void toggle(store)} className={`rounded-xl px-4 py-2 font-bold disabled:opacity-50 ${store.rappidexEnabled ? 'border border-danger text-danger' : 'bg-ink text-white'}`}>{savingId === store.restaurantId ? 'Salvando...' : store.rappidexEnabled ? 'Desativar Rappidex' : 'Ativar Rappidex'}</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}
