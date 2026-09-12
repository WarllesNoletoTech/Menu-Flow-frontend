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
      setMessage(`ID da empresa ${store.name} copiado.`);
    } catch {
      setMessage(`Não foi possível copiar automaticamente. ID: ${store.restaurantId}`);
    }
  }

  const deliveryCount = stores.filter((store) => store.deliveryEnabled).length;

  return <section className="mx-auto max-w-7xl">
    <header>
      <p className="text-sm font-bold uppercase tracking-wide text-stone-500">Administração</p>
      <h1 className="mt-1 text-3xl font-black">Integrações</h1>
      <p className="mt-2 text-stone-500">IDs das empresas do Menu Flow para vinculação com integrações externas.</p>
    </header>

    <section className="mt-7 rounded-2xl border border-stone-200 bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><span className="rounded-xl bg-ink px-3 py-2 text-sm font-black text-white">RAPPIDEX</span><h2 className="text-xl font-black">Integração de entregas</h2></div>
          <p className="mt-3 max-w-3xl text-sm text-stone-500">Copie o ID da empresa Menu Flow e informe na empresa correspondente em <b>Rappidex → Empresas Cadastradas → Integração Menu Flow</b>. A ativação da integração é feita somente na Rappidex.</p>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-gold/15 p-3 text-sm text-stone-700"><b>Importante:</b> pedidos de retirada nunca são enviados para a Rappidex. Pedidos de entrega só são criados quando a empresa correspondente estiver vinculada e com a integração Menu Flow ativada na Rappidex.</p>
    </section>

    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <article className="rounded-2xl bg-surface p-5 shadow-sm"><p className="text-sm font-bold text-stone-500">Lojas cadastradas</p><strong className="mt-2 block text-3xl font-black">{stores.length}</strong></article>
      <article className="rounded-2xl bg-surface p-5 shadow-sm"><p className="text-sm font-bold text-stone-500">Lojas com entrega</p><strong className="mt-2 block text-3xl font-black">{deliveryCount}</strong></article>
    </div>

    <div className="mt-6 grid gap-3 rounded-2xl bg-surface p-4 shadow-sm md:grid-cols-2">
      <input className="field !mt-0" placeholder="Buscar loja, cidade ou ID" value={search} onChange={(event) => setSearch(event.target.value)}/>
      <select className="field !mt-0" value={city} onChange={(event) => setCity(event.target.value)}><option value="">Todas as cidades</option>{cities.map((item) => <option key={item} value={item}>{item}</option>)}</select>
    </div>

    {message && <p aria-live="polite" className="mt-5 rounded-xl bg-surface p-4 shadow-sm">{message}</p>}

    <div className="mt-5 overflow-x-auto rounded-2xl bg-surface shadow-sm">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead><tr>{['Estabelecimento','Cidade / UF','Loja','Entrega Menu Flow','ID da empresa Menu Flow','Ação'].map((label) => <th key={label} className="p-4">{label}</th>)}</tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={6} className="p-6 text-center text-stone-500">Carregando integrações...</td></tr> : filtered.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-stone-500">Nenhum estabelecimento encontrado.</td></tr> : filtered.map((store) => <tr key={store.restaurantId} className="border-t">
            <td className="p-4"><b className="block">{store.name}</b>{store.legalName !== store.name && <span className="text-xs text-stone-500">{store.legalName}</span>}</td>
            <td className="p-4">{[store.city, store.state].filter(Boolean).join(' / ') || '—'}</td>
            <td className="p-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${store.blocked ? 'bg-danger/10 text-danger' : store.open ? 'bg-lime/30 text-ink' : 'bg-stone-100 text-stone-600'}`}>{store.blocked ? 'Bloqueada' : store.open ? 'Aberta' : 'Pausada'}</span></td>
            <td className="p-4"><span className={`font-bold ${store.deliveryEnabled ? 'text-emerald-700' : 'text-stone-500'}`}>{store.deliveryEnabled ? 'Ativa' : 'Desativada'}</span></td>
            <td className="p-4"><code className="break-all rounded-lg bg-background px-2 py-1 text-xs font-bold">{store.restaurantId}</code></td>
            <td className="p-4"><button type="button" onClick={() => void copyId(store)} className="rounded-xl bg-ink px-4 py-2 font-bold text-white">Copiar ID</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}
