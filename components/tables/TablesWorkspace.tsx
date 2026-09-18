'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { authenticatedRequest } from '../../lib/authenticated-request';

type TableItem = { _id: string; number: number; name: string; capacity: number; active: boolean; sortOrder: number; qrToken?: string };
type Addon = { _id?: string; name: string; price: number; priceCents?: number };
type AddonGroup = { _id?: string; name: string; required?: boolean; min?: number; max?: number; pricingMode?: 'SUM'|'MAX'; addons: Addon[] };
type Product = { _id: string; categoryId: string | { _id: string }; name: string; price: number; priceCents?: number; promotionalPrice?: number; promotionalPriceCents?: number; addonGroups?: AddonGroup[] };
type Category = { _id: string; name: string; order: number };
type Order = { _id: string; orderNumber?: string; status: string; totalCents: number; createdAt: string; items: Array<{ productName: string; quantity: number; observation?: string; addons?: Array<{ name: string }> }> };
type Waiter = { id: string; name: string; employeePosition?: string; permissions?: string[] };
type TableEvent = { _id: string; action: string; createdAt: string; actorId?: string | { name?: string }; metadata?: Record<string, unknown> };
type Session = {
  _id: string; status: 'OPEN'|'AWAITING_PAYMENT'|'CLOSED'; primaryTableId: string; tableIds: Array<string | TableItem>;
  waiterId?: string | { _id?: string; name?: string }; customerName?: string; peopleCount: number; openedAt: string;
  subtotalCents: number; serviceFeePercent: number; serviceFeeCents: number; discountCents: number; totalCents: number; paidCents: number; balanceCents: number;
  payments?: Array<{ amountCents: number; method: string; recordedAt: string; note?: string }>;
  orders: Order[];
};
type Context = { settings: { tableServiceEnabled: boolean; waiterAppEnabled: boolean; serviceFeePercent: number; qrOrderingEnabled: boolean }; tables: TableItem[]; sessions: Session[] };
type Workspace = 'TABLES'|'KITCHEN'|'CASHIER';
type PrinterSettings = { printerEnabled: boolean; printerAutoKitchen: boolean; printerAutoBill: boolean; printerPaperWidth: 58|80; printerTokenLast4?: string|null; printerLastSeenAt?: string|null; printerDeviceName?: string|null; connected: boolean };
type CartItem = { key: string; product: Product; quantity: number; observation: string; addons: Array<{ groupId: string; addonId: string; label: string }> };

const money = (cents = 0) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const statusLabel: Record<string, string> = { PENDING: 'Para aceitar', ACCEPTED: 'Aceito', PREPARING: 'Em preparo', READY: 'Pronto', DELIVERED_TO_TABLE: 'Entregue na mesa', COMPLETED: 'Concluído', REJECTED: 'Recusado', CANCELLED: 'Cancelado' };
const paymentLabel: Record<string, string> = { PIX: 'Pix', CASH: 'Dinheiro', CREDIT_CARD: 'Cartão de crédito', DEBIT_CARD: 'Cartão de débito' };
const eventLabel: Record<string, string> = { TABLE_OPENED: 'Mesa aberta', ORDER_ADDED: 'Pedido adicionado', ORDER_READY: 'Pedido pronto', ORDER_DELIVERED: 'Pedido entregue na mesa', ORDER_CANCELLED: 'Pedido cancelado', BILL_REQUESTED: 'Conta solicitada', PAYMENT_ADDED: 'Pagamento registrado', DISCOUNT_CHANGED: 'Desconto alterado', WAITER_CHANGED: 'Garçom alterado', TABLE_TRANSFERRED: 'Mesa transferida', TABLES_MERGED: 'Mesas agrupadas', TABLE_CLOSED: 'Mesa fechada' };

export function TablesWorkspace({ ownerMode = false }: { ownerMode?: boolean }) {
  const { user } = useAuth();
  const [data, setData] = useState<Context>();
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedTableId, setSelectedTableId] = useState<string>();
  const [detail, setDetail] = useState<Session>();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<'ALL'|'FREE'|'OCCUPIED'|'READY'|'PAYMENT'>('ALL');
  const [bulk, setBulk] = useState({ from: '1', to: '20', prefix: 'Mesa', capacity: '4' });
  const [openTable, setOpenTable] = useState<TableItem>();
  const [openForm, setOpenForm] = useState({ customerName: '', peopleCount: '2', waiterId: '' });
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [catalog, setCatalog] = useState<{ categories: Category[]; products: Product[] }>({ categories: [], products: [] });
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addingProduct, setAddingProduct] = useState<Product>();
  const [productQty, setProductQty] = useState(1);
  const [productNote, setProductNote] = useState('');
  const [addonSelections, setAddonSelections] = useState<Record<string, string[]>>({});
  const [payment, setPayment] = useState({ amount: '', method: 'PIX', note: '' });
  const [discount, setDiscount] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [waiterTo, setWaiterTo] = useState('');
  const [events, setEvents] = useState<TableEvent[]>([]);
  const [manageTable, setManageTable] = useState({ id: '', name: '', capacity: '4', active: true });
  const [workspace, setWorkspace] = useState<Workspace>('TABLES');
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>();
  const [printerToken, setPrinterToken] = useState('');
  const [printerSetupOpen, setPrinterSetupOpen] = useState(false);

  const can = useCallback((permission: string) => {
    if (ownerMode || user?.role === 'RESTAURANT_ADMIN' || user?.permissions?.includes(permission)) return true;
    if (user?.employeePosition === 'KITCHEN' && ['TABLES_VIEW','TABLES_KITCHEN','TABLES_PRINT'].includes(permission)) return true;
    if (user?.employeePosition === 'CASHIER' && ['TABLES_VIEW','TABLES_PAYMENT','TABLES_PRINT','TABLES_CLOSE'].includes(permission)) return true;
    return false;
  }, [ownerMode, user?.employeePosition, user?.permissions, user?.role]);
  const setPaymentCents = (cents: number) => setPayment((current) => ({ ...current, amount: (Math.max(0, cents) / 100).toFixed(2) }));

  const load = useCallback(async () => {
    try {
      const result = await authenticatedRequest<Context>('/table-service/context');
      setData(result);
      if (selectedId) {
        const [current, history] = await Promise.all([
          authenticatedRequest<Session>(`/table-service/sessions/${selectedId}`),
          authenticatedRequest<TableEvent[]>(`/table-service/sessions/${selectedId}/events`).catch(() => []),
        ]);
        setDetail(current);
        setEvents(history);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as mesas.');
    }
  }, [selectedId]);

  const loadSupport = useCallback(async () => {
    if (!user?.restaurantId) return;
    const [menu, staff] = await Promise.all([
      authenticatedRequest<{ categories: Category[]; products: Product[] }>(`/restaurants/${user.restaurantId}/menu`).catch(() => ({ categories: [], products: [] })),
      authenticatedRequest<Waiter[]>('/table-service/waiters').catch(() => []),
    ]);
    setCatalog(menu);
    setWaiters(staff);
  }, [user?.restaurantId]);
  const refreshPrinter = useCallback(async () => {
    const printer = await authenticatedRequest<PrinterSettings>('/printer/settings').catch(() => undefined);
    if (printer) setPrinterSettings(printer);
  }, []);

  useEffect(() => { void load(); void loadSupport(); void refreshPrinter(); }, [load, loadSupport, refreshPrinter]);
  useEffect(() => {
    if (ownerMode) return;
    if (user?.employeePosition === 'KITCHEN') setWorkspace('KITCHEN');
    else if (user?.employeePosition === 'CASHIER') setWorkspace('CASHIER');
    else setWorkspace('TABLES');
  }, [ownerMode, user?.employeePosition, user?.permissions]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void refreshPrinter(), 5000);
    return () => window.clearInterval(timer);
  }, [refreshPrinter]);

  const sessionByTable = useMemo(() => {
    const map = new Map<string, Session>();
    for (const session of data?.sessions ?? []) for (const table of session.tableIds ?? []) map.set(typeof table === 'string' ? table : table._id, session);
    return map;
  }, [data?.sessions]);

  const filteredTables = useMemo(() => (data?.tables ?? []).filter((table) => {
    const session = sessionByTable.get(table._id);
    if (filter === 'FREE') return table.active && !session;
    if (filter === 'OCCUPIED') return Boolean(session && session.status === 'OPEN');
    if (filter === 'PAYMENT') return session?.status === 'AWAITING_PAYMENT';
    if (filter === 'READY') return session?.orders?.some((order) => order.status === 'READY');
    return table.active || ownerMode;
  }), [data?.tables, filter, ownerMode, sessionByTable]);

  const freeTables = useMemo(() => (data?.tables ?? []).filter((table) => table.active && !sessionByTable.has(table._id)), [data?.tables, sessionByTable]);
  const kitchenQueue = useMemo(() => (data?.sessions ?? []).flatMap((session) => (session.orders ?? []).filter((order) => ['PREPARING','READY'].includes(order.status)).map((order) => ({ session, order }))).sort((a,b)=>new Date(a.order.createdAt).getTime()-new Date(b.order.createdAt).getTime()), [data?.sessions]);
  const cashierQueue = useMemo(() => (data?.sessions ?? []).filter((session) => session.status === 'AWAITING_PAYMENT').sort((a,b)=>new Date(a.openedAt).getTime()-new Date(b.openedAt).getTime()), [data?.sessions]);

  async function run(action: () => Promise<unknown>, success?: string) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); if (success) setMessage(success); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a ação.'); }
    finally { setBusy(false); }
  }

  async function createTables(event: FormEvent) {
    event.preventDefault();
    await run(() => authenticatedRequest('/table-service/tables/bulk', { method: 'POST', body: JSON.stringify({ from: Number(bulk.from), to: Number(bulk.to), prefix: bulk.prefix, capacity: Number(bulk.capacity) }) }), 'Mesas cadastradas com sucesso.');
  }

  async function updateTable(event: FormEvent) {
    event.preventDefault();
    if (!manageTable.id) return;
    await run(() => authenticatedRequest(`/table-service/tables/${manageTable.id}`, { method: 'PATCH', body: JSON.stringify({ name: manageTable.name.trim(), capacity: Number(manageTable.capacity), active: manageTable.active }) }), 'Mesa atualizada com sucesso.');
  }

  async function openSession(event: FormEvent) {
    event.preventDefault(); if (!openTable) return;
    await run(async () => {
      const session = await authenticatedRequest<Session>(`/table-service/tables/${openTable._id}/open`, { method: 'POST', body: JSON.stringify({ customerName: openForm.customerName || undefined, peopleCount: Number(openForm.peopleCount), waiterId: openForm.waiterId || undefined }) });
      setSelectedTableId(openTable._id); setOpenTable(undefined); setSelectedId(session._id); setDetail(session); setOpenForm({ customerName: '', peopleCount: '2', waiterId: '' });
    }, 'Mesa aberta.');
  }

  async function selectTable(table: TableItem) {
    setSelectedTableId(table._id);
    const session = sessionByTable.get(table._id);
    if (!session) {
      if (!can('TABLES_OPEN')) { setMessage('Seu usuário não possui permissão para abrir mesas.'); return; }
      setOpenTable(table); return;
    }
    setSelectedId(session._id);
    try {
      const [current, history] = await Promise.all([
        authenticatedRequest<Session>(`/table-service/sessions/${session._id}`),
        authenticatedRequest<TableEvent[]>(`/table-service/sessions/${session._id}/events`).catch(() => []),
      ]);
      setDetail(current);
      setEvents(history);
    }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível abrir a comanda.'); }
  }

  function beginProduct(product: Product) { setAddingProduct(product); setProductQty(1); setProductNote(''); setAddonSelections({}); }
  function toggleAddon(group: AddonGroup, addon: Addon) {
    if (!group._id || !addon._id) return;
    const current = addonSelections[group._id] ?? [];
    const max = group.max ?? 1;
    const next = current.includes(addon._id) ? current.filter((id) => id !== addon._id) : (max === 1 ? [addon._id] : [...current, addon._id].slice(-max));
    setAddonSelections({ ...addonSelections, [group._id]: next });
  }
  function addProductToCart() {
    if (!addingProduct) return;
    for (const group of addingProduct.addonGroups ?? []) {
      if (!group._id) continue;
      const count = (addonSelections[group._id] ?? []).length;
      const min = group.required ? Math.max(1, group.min ?? 1) : (group.min ?? 0);
      if (count < min) { setMessage(`Selecione pelo menos ${min} opção(ões) em ${group.name}.`); return; }
    }
    const addons = (addingProduct.addonGroups ?? []).flatMap((group) => (addonSelections[group._id ?? ''] ?? []).map((addonId) => ({ groupId: group._id!, addonId, label: `${group.name}: ${group.addons.find((addon) => addon._id === addonId)?.name ?? ''}` })));
    setCart([...cart, { key: `${addingProduct._id}-${Date.now()}`, product: addingProduct, quantity: productQty, observation: productNote.trim(), addons }]);
    setAddingProduct(undefined); setMessage('');
  }
  async function sendOrder() {
    if (!detail || !cart.length) return;
    await run(async () => {
      const updated = await authenticatedRequest<Session>(`/table-service/sessions/${detail._id}/orders`, { method: 'POST', body: JSON.stringify({ items: cart.map((item) => ({ productId: item.product._id, quantity: item.quantity, observation: item.observation || undefined, addons: item.addons.map(({ groupId, addonId }) => ({ groupId, addonId })) })) }) });
      setDetail(updated); setCart([]);
    }, 'Pedido enviado para a produção.');
  }
  async function markDelivered(order: Order) {
    if (!detail) return;
    await run(async () => {
      const updated = await authenticatedRequest<Session>(`/table-service/sessions/${detail._id}/orders/${order._id}/delivered`, { method: 'PATCH' });
      setDetail(updated);
    }, 'Pedido marcado como entregue na mesa.');
  }
  async function cancelTableOrder(order: Order) {
    if (!detail || !window.confirm(`Cancelar o pedido ${order.orderNumber ?? ''}?`)) return;
    await run(async () => {
      const updated = await authenticatedRequest<Session>(`/table-service/sessions/${detail._id}/orders/${order._id}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason: 'Cancelado pelo salão.' }) });
      setDetail(updated);
    }, 'Pedido cancelado.');
  }
  async function openSessionDetail(session: Session) {
    try {
      const [current, history] = await Promise.all([
        authenticatedRequest<Session>(`/table-service/sessions/${session._id}`),
        authenticatedRequest<TableEvent[]>(`/table-service/sessions/${session._id}/events`).catch(()=>[]),
      ]);
      setSelectedId(session._id); setSelectedTableId(session.primaryTableId); setDetail(current); setEvents(history);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível abrir a comanda.'); }
  }
  async function markReady(session: Session, order: Order) {
    await run(() => authenticatedRequest(`/table-service/sessions/${session._id}/orders/${order._id}/ready`, { method: 'PATCH' }), 'Pedido pronto. O garçom foi avisado.');
  }
  async function printOrder(session: Session, order: Order) {
    if (printerSettings?.printerEnabled && printerSettings.connected) {
      await run(() => authenticatedRequest(`/printer/jobs/order/${order._id}`, { method: 'POST' }), 'Pedido enviado para a impressora da cozinha.');
      return;
    }
    browserPrint('Pedido da cozinha', orderPrintLines(session, order, data?.tables ?? []));
    setMessage('Menu Flow Printer offline: aberta a impressão do navegador.');
  }
  async function printBill(session: Session) {
    if (printerSettings?.printerEnabled && printerSettings.connected) {
      await run(() => authenticatedRequest(`/printer/jobs/bill/${session._id}`, { method: 'POST' }), 'Pré-conta enviada para a impressora do caixa.');
      return;
    }
    browserPrint('Pré-conta', billPrintLines(session, data?.tables ?? []));
    setMessage('Menu Flow Printer offline: aberta a impressão do navegador.');
  }
  async function savePrinterSettings(next: Partial<PrinterSettings>) {
    try {
      const updated = await authenticatedRequest<PrinterSettings>('/printer/settings', { method: 'PATCH', body: JSON.stringify(next) });
      setPrinterSettings(updated); setMessage('Configuração de impressão salva.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a impressão.'); }
  }
  async function generatePrinterToken() {
    try {
      const result = await authenticatedRequest<{token:string;last4:string}>('/printer/token', { method: 'POST' });
      setPrinterToken(result.token); await refreshPrinter();
      setMessage('Nova chave do Menu Flow Printer gerada. Copie agora para o computador do restaurante.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível gerar a chave.'); }
  }

  const stateFor = (session?: Session) => {
    if (!session) return { label: 'Livre', className: 'bg-success/10 text-success' };
    if (session.status === 'AWAITING_PAYMENT') return { label: 'Aguardando pagamento', className: 'bg-gold/15 text-ink' };
    if (session.orders?.some((order) => order.status === 'READY')) return { label: 'Pedido pronto', className: 'bg-primary/10 text-primary' };
    if (session.orders?.some((order) => ['PENDING','ACCEPTED','PREPARING'].includes(order.status))) return { label: 'Pedido em preparo', className: 'bg-accent/10 text-accent' };
    if (!session.orders?.length) return { label: 'Aguardando pedido', className: 'bg-stone-100 text-stone-600' };
    return { label: 'Ocupada', className: 'bg-stone-200 text-stone-700' };
  };

  if (!data) return <section className="mx-auto max-w-7xl"><div className="h-40 animate-pulse rounded-3xl bg-stone-200" />{message && <p className="mt-4 rounded-xl bg-surface p-3">{message}</p>}</section>;

  return <section className="mx-auto max-w-7xl space-y-6">
    <header className="rounded-[30px] bg-ink p-6 text-white shadow-sm sm:p-7"><p className="text-xs font-black uppercase tracking-[.18em] text-lime">Operação · Menu Flow</p><div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-black">Salão, cozinha e caixa</h1><p className="mt-1 text-sm text-stone-300">Uma única tela para trabalhar com o mínimo de cliques.</p></div><div className="flex flex-wrap gap-2">{ownerMode&&<button type="button" onClick={()=>setPrinterSetupOpen(true)} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold">Menu Flow Printer</button>}<button type="button" onClick={() => void Promise.all([load(),loadSupport(),refreshPrinter()])} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold">Atualizar</button></div></div><div className="mt-5 flex gap-2 overflow-x-auto"><WorkspaceTab active={workspace==='TABLES'} onClick={()=>setWorkspace('TABLES')} label="Mesas" badge={String((data?.sessions??[]).filter((item)=>item.status==='OPEN').length)}/>{can('TABLES_KITCHEN')&&<WorkspaceTab active={workspace==='KITCHEN'} onClick={()=>setWorkspace('KITCHEN')} label="Cozinha" badge={String(kitchenQueue.filter((item)=>item.order.status==='PREPARING').length)}/>} {(can('TABLES_PAYMENT')||can('TABLES_PRINT'))&&<WorkspaceTab active={workspace==='CASHIER'} onClick={()=>setWorkspace('CASHIER')} label="Caixa" badge={String(cashierQueue.length)}/>}</div></header>

    {!data.settings.tableServiceEnabled && <div className="rounded-2xl border border-gold/30 bg-gold/10 p-5"><strong>Controle de mesas desativado.</strong><p className="mt-1 text-sm text-stone-600">O administrador do Menu Flow precisa liberar o recurso para este estabelecimento.</p></div>}

    {workspace==='TABLES'&&<>
    {ownerMode && <form onSubmit={createTables} className="rounded-2xl bg-surface p-5 shadow-sm"><div className="flex flex-col gap-1"><h2 className="text-lg font-black">Cadastro rápido de mesas</h2><p className="text-sm text-stone-500">Crie várias mesas de uma vez.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-5"><label className="font-bold">De<input className="field" type="number" min="1" value={bulk.from} onChange={(e)=>setBulk({...bulk,from:e.target.value})}/></label><label className="font-bold">Até<input className="field" type="number" min="1" value={bulk.to} onChange={(e)=>setBulk({...bulk,to:e.target.value})}/></label><label className="font-bold">Prefixo<input className="field" value={bulk.prefix} onChange={(e)=>setBulk({...bulk,prefix:e.target.value})}/></label><label className="font-bold">Capacidade<input className="field" type="number" min="1" value={bulk.capacity} onChange={(e)=>setBulk({...bulk,capacity:e.target.value})}/></label><button disabled={busy} className="mt-auto min-h-11 rounded-xl bg-ink px-4 font-bold text-white disabled:opacity-50">Criar mesas</button></div></form>}
    {ownerMode&&data.tables.length>0&&<form onSubmit={updateTable} className="rounded-2xl border bg-white p-5 shadow-sm"><div><h2 className="text-lg font-black">Gerenciar mesa</h2><p className="text-sm text-stone-500">Edite nome/capacidade ou desative uma mesa sem apagar seu histórico.</p></div><div className="mt-4 grid gap-3 sm:grid-cols-4"><label className="font-bold">Mesa<select className="field" value={manageTable.id} onChange={(e)=>{const table=data.tables.find((item)=>item._id===e.target.value);setManageTable(table?{id:table._id,name:table.name,capacity:String(table.capacity),active:table.active}:{id:'',name:'',capacity:'4',active:true})}}><option value="">Selecione…</option>{data.tables.map((table)=><option key={table._id} value={table._id}>{table.name}</option>)}</select></label><label className="font-bold">Nome<input required disabled={!manageTable.id} className="field" value={manageTable.name} onChange={(e)=>setManageTable({...manageTable,name:e.target.value})}/></label><label className="font-bold">Capacidade<input required disabled={!manageTable.id} min="1" type="number" className="field" value={manageTable.capacity} onChange={(e)=>setManageTable({...manageTable,capacity:e.target.value})}/></label><label className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3 font-bold sm:self-end"><span>Mesa ativa</span><input disabled={!manageTable.id} type="checkbox" checked={manageTable.active} onChange={(e)=>setManageTable({...manageTable,active:e.target.checked})}/></label></div><button disabled={busy||!manageTable.id} className="mt-3 rounded-xl border px-5 py-3 font-black disabled:opacity-50">Salvar mesa</button></form>}

    <div className="flex gap-2 overflow-x-auto">{([['ALL','Todas'],['FREE','Livres'],['OCCUPIED','Ocupadas'],['READY','Pedido pronto'],['PAYMENT','Aguardando pagamento']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>setFilter(value)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-black ${filter===value?'bg-ink text-white':'border bg-white text-stone-600'}`}>{label}</button>)}</div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredTables.map((table)=>{const session=sessionByTable.get(table._id);const state=stateFor(session);return <button type="button" key={table._id} onClick={()=>void selectTable(table)} className={`rounded-[24px] border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${!table.active?'opacity-50':''}`}><div className="flex items-start justify-between gap-3"><div><span className="text-xs font-bold text-stone-400">MESA {String(table.number).padStart(2,'0')}</span><h3 className="mt-1 text-xl font-black">{table.name}</h3></div><span className={`rounded-full px-3 py-1 text-[11px] font-black ${state.className}`}>{state.label}</span></div>{session?<div className="mt-5"><strong className="text-lg">{money(session.totalCents)}</strong><p className="mt-1 text-xs text-stone-500">{session.peopleCount} pessoa(s) · {session.waiterId && typeof session.waiterId==='object' ? session.waiterId.name : 'Sem garçom definido'}</p></div>:<p className="mt-5 text-sm text-stone-500">Capacidade: {table.capacity} pessoa(s)</p>}</button>})}</div>
    </>}

    {workspace==='KITCHEN'&&<section className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Fila da cozinha</h2><p className="text-sm text-stone-500">Pedidos do garçom entram direto em preparo. A cozinha só precisa marcar como pronto.</p></div><span className={`rounded-full px-3 py-2 text-xs font-black ${printerSettings?.connected?'bg-success/10 text-success':'bg-stone-100 text-stone-500'}`}>{printerSettings?.connected?'Printer conectado':'Printer offline'}</span></div><div className="grid gap-4 lg:grid-cols-2">{kitchenQueue.map(({session,order})=><article key={order._id} className={`rounded-2xl border bg-white p-5 shadow-sm ${order.status==='READY'?'border-success/30':''}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-stone-400">{sessionTableName(session,data.tables)}</p><h3 className="text-lg font-black">{order.orderNumber}</h3></div><span className={`rounded-full px-3 py-1 text-xs font-black ${order.status==='READY'?'bg-success/10 text-success':'bg-accent/10 text-accent'}`}>{order.status==='READY'?'Pronto':'Em preparo'}</span></div><div className="mt-4 space-y-2">{order.items.map((item,index)=><div key={index} className="rounded-xl bg-background p-3 text-sm"><b>{item.quantity}x {item.productName}</b>{item.addons?.length?<p className="mt-1 text-xs text-stone-500">+ {item.addons.map((addon)=>addon.name).join(', ')}</p>:null}{item.observation&&<p className="mt-1 font-bold text-danger">Obs.: {item.observation}</p>}</div>)}</div><div className="mt-4 flex gap-2"><button type="button" disabled={busy} onClick={()=>void printOrder(session,order)} className="flex-1 rounded-xl border px-4 py-3 font-black">Imprimir</button>{order.status==='PREPARING'&&<button type="button" disabled={busy} onClick={()=>void markReady(session,order)} className="flex-1 rounded-xl bg-success px-4 py-3 font-black text-white">Pronto</button>}</div></article>)}{!kitchenQueue.length&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-stone-500 lg:col-span-2"><strong className="block text-ink">Cozinha em dia</strong><span className="text-sm">Novos pedidos de mesa aparecerão aqui automaticamente.</span></div>}</div></section>}

    {workspace==='CASHIER'&&<section className="space-y-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Contas solicitadas</h2><p className="text-sm text-stone-500">O caixa recebe a fila pronta: imprimir, receber e fechar a mesa.</p></div><span className={`rounded-full px-3 py-2 text-xs font-black ${printerSettings?.connected?'bg-success/10 text-success':'bg-stone-100 text-stone-500'}`}>{printerSettings?.connected?`Printer: ${printerSettings.printerDeviceName||'conectado'}`:'Printer offline'}</span></div><div className="space-y-3">{cashierQueue.map((session)=><article key={session._id} className="flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-wide text-gold">Conta solicitada</p><h3 className="mt-1 text-xl font-black">{sessionTableName(session,data.tables)}</h3><p className="mt-1 text-sm text-stone-500">{session.peopleCount} pessoa(s) · {typeof session.waiterId==='object'&&session.waiterId?.name?`Garçom: ${session.waiterId.name}`:'Salão'}</p></div><div className="sm:text-right"><strong className="text-2xl">{money(session.balanceCents)}</strong><div className="mt-3 flex flex-wrap gap-2 sm:justify-end"><button type="button" disabled={busy} onClick={()=>void printBill(session)} className="rounded-xl border px-4 py-3 font-black">Imprimir conta</button><button type="button" onClick={()=>void openSessionDetail(session)} className="rounded-xl bg-ink px-4 py-3 font-black text-white">Receber</button></div></div></article>)}{!cashierQueue.length&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-stone-500"><strong className="block text-ink">Nenhuma conta aguardando</strong><span className="text-sm">Quando o garçom tocar em “Pedir conta”, ela aparecerá aqui.</span></div>}</div></section>}


    {message && <p aria-live="polite" className="rounded-xl border bg-surface p-3 font-semibold">{message}</p>}

    {openTable && <Modal title={`Abrir ${openTable.name}`} close={()=>setOpenTable(undefined)}><form onSubmit={openSession} className="space-y-4"><label className="font-bold">Nome do cliente (opcional)<input className="field" value={openForm.customerName} onChange={(e)=>setOpenForm({...openForm,customerName:e.target.value})}/></label><label className="font-bold">Quantidade de pessoas<input required min="1" type="number" className="field" value={openForm.peopleCount} onChange={(e)=>setOpenForm({...openForm,peopleCount:e.target.value})}/></label>{waiters.length>0&&<label className="font-bold">Garçom<select className="field" value={openForm.waiterId} onChange={(e)=>setOpenForm({...openForm,waiterId:e.target.value})}><option value="">{user?.role==='EMPLOYEE'?'Eu':'Selecionar depois'}</option>{waiters.map((waiter)=><option key={waiter.id} value={waiter.id}>{waiter.name}</option>)}</select></label>}<button disabled={busy||!data.settings.tableServiceEnabled} className="w-full rounded-xl bg-ink px-5 py-3 font-black text-white disabled:opacity-50">Abrir mesa</button></form></Modal>}

    {detail && <Modal wide title={tableTitle(detail)} close={()=>{setDetail(undefined);setSelectedId(undefined);setSelectedTableId(undefined);setCart([]);setEvents([])}}>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3"><Metric label="Total" value={money(detail.totalCents)}/><Metric label="Saldo" value={money(detail.balanceCents)}/><Metric label="Pessoas" value={String(detail.peopleCount)}/></div>
          <section><div className="flex items-center justify-between"><h3 className="text-lg font-black">Pedidos da mesa</h3><span className="text-xs font-bold text-stone-500">{detail.orders.length} pedido(s)</span></div><div className="mt-3 space-y-3">{detail.orders.map((order)=><article key={order._id} className="rounded-2xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{order.orderNumber}</strong><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black">{statusLabel[order.status]??order.status}</span></div><div className="mt-3 space-y-1 text-sm">{order.items.map((item,index)=><div key={index}><b>{item.quantity}x</b> {item.productName}{item.addons?.length?` · ${item.addons.map((addon)=>addon.name).join(', ')}`:''}{item.observation&&<span className="block text-xs text-stone-500">Obs.: {item.observation}</span>}</div>)}</div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><b>{money(order.totalCents)}</b><div className="flex flex-wrap gap-2">{detail.status==='AWAITING_PAYMENT'&&can('TABLES_PAYMENT')&&!['REJECTED','CANCELLED'].includes(order.status)&&<button type="button" onClick={()=>{setPaymentCents(Math.min(order.totalCents,detail.balanceCents));setPayment((current)=>({...current,note:`Pedido ${order.orderNumber??''}`.trim()}));}} className="rounded-lg border px-3 py-2 text-xs font-black">Cobrar este pedido</button>}{!['COMPLETED','REJECTED','CANCELLED'].includes(order.status)&&can('TABLES_CANCEL')&&<button disabled={busy} onClick={()=>void cancelTableOrder(order)} className="rounded-lg border border-danger/30 px-3 py-2 text-xs font-black text-danger">Cancelar</button>}{order.status==='READY'&&can('TABLES_DELIVER')&&<button disabled={busy} onClick={()=>void markDelivered(order)} className="rounded-lg bg-success px-3 py-2 text-xs font-black text-white">Entregue na mesa</button>}</div></div></article>)}{!detail.orders.length&&<p className="rounded-xl bg-background p-4 text-sm text-stone-500">Nenhum pedido enviado ainda.</p>}</div></section>

          {detail.status==='OPEN'&&can('TABLES_ORDER')&&<section className="rounded-2xl border p-4"><h3 className="font-black">Adicionar pedido</h3><div className="mt-3 max-h-64 space-y-4 overflow-auto pr-1">{[...catalog.categories].sort((a,b)=>a.order-b.order).map((category)=>{const products=catalog.products.filter((product)=>productCategory(product)===category._id);if(!products.length)return null;return <div key={category._id}><p className="mb-2 text-xs font-black uppercase tracking-wide text-stone-400">{category.name}</p><div className="grid gap-2 sm:grid-cols-2">{products.map((product)=><button type="button" key={product._id} onClick={()=>beginProduct(product)} className="rounded-xl border p-3 text-left"><strong>{product.name}</strong><span className="mt-1 block text-sm text-stone-500">{money(productPriceCents(product))}</span></button>)}</div></div>})}</div>{cart.length>0&&<div className="mt-4 rounded-xl bg-background p-3"><div className="space-y-2">{cart.map((item)=><div key={item.key} className="flex items-center justify-between gap-2 text-sm"><span><b>{item.quantity}x</b> {item.product.name}</span><button type="button" className="font-bold text-danger" onClick={()=>setCart(cart.filter((current)=>current.key!==item.key))}>Remover</button></div>)}</div><button disabled={busy} type="button" onClick={()=>void sendOrder()} className="mt-3 w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Enviar para produção</button></div>}</section>}
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl bg-background p-4"><h3 className="font-black">Resumo da conta</h3><dl className="mt-3 space-y-2 text-sm"><Row label="Pedidos" value={money(detail.subtotalCents)}/><Row label={`Serviço (${detail.serviceFeePercent}%)`} value={money(detail.serviceFeeCents)}/><Row label="Desconto" value={`- ${money(detail.discountCents)}`}/><Row label="Pago" value={money(detail.paidCents)}/><div className="border-t pt-2"><Row strong label="Total" value={money(detail.totalCents)}/><Row strong label="Saldo pendente" value={money(detail.balanceCents)}/></div></dl></section>
          {detail.status==='OPEN'&&can('TABLES_REQUEST_BILL')&&<button disabled={busy} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/request-bill`,{method:'PATCH'}),'Conta enviada ao caixa.')} className="w-full rounded-xl bg-gold px-4 py-3 font-black text-ink">Pedir conta</button>}
          {detail.status==='AWAITING_PAYMENT'&&can('TABLES_PRINT')&&<button disabled={busy} type="button" onClick={()=>void printBill(detail)} className="w-full rounded-xl border px-4 py-3 font-black">Imprimir pré-conta</button>}
          {detail.status==='AWAITING_PAYMENT'&&<>{can('TABLES_PAYMENT')&&<form onSubmit={(e)=>{e.preventDefault();void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/payments`,{method:'POST',body:JSON.stringify({amountCents:Math.round(Number(payment.amount.replace(',','.'))*100),method:payment.method,note:payment.note||undefined})}),'Pagamento registrado.').then(()=>setPayment({...payment,amount:'',note:''}))}} className="rounded-2xl border p-4"><h3 className="font-black">Registrar pagamento</h3><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setPaymentCents(detail.balanceCents)} className="rounded-lg border px-3 py-2 text-xs font-black">Saldo total</button>{detail.peopleCount>1&&<button type="button" onClick={()=>setPaymentCents(Math.min(detail.balanceCents,Math.ceil(detail.totalCents/detail.peopleCount)))} className="rounded-lg border px-3 py-2 text-xs font-black">Dividir por {detail.peopleCount}</button>}</div><label className="mt-3 block font-bold">Valor (R$)<input required min="0.01" step="0.01" className="field" value={payment.amount} onChange={(e)=>setPayment({...payment,amount:e.target.value})}/></label><label className="mt-3 block font-bold">Forma<select className="field" value={payment.method} onChange={(e)=>setPayment({...payment,method:e.target.value})}>{Object.entries(paymentLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="mt-3 block font-bold">Observação<input className="field" value={payment.note} onChange={(e)=>setPayment({...payment,note:e.target.value})}/></label><button disabled={busy} className="mt-3 w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Adicionar pagamento</button></form>}{can('TABLES_DISCOUNT')&&<form onSubmit={(e)=>{e.preventDefault();void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/discount`,{method:'PATCH',body:JSON.stringify({discountCents:Math.round(Number(discount.replace(',','.'))*100)})}),'Desconto atualizado.')}} className="rounded-2xl border p-4"><h3 className="font-black">Desconto</h3><div className="mt-2 flex gap-2"><input min="0" step="0.01" type="number" className="field !mt-0" placeholder="R$" value={discount} onChange={(e)=>setDiscount(e.target.value)}/><button disabled={busy} className="rounded-xl border px-4 font-black">Aplicar</button></div></form>}{(detail.payments??[]).length>0&&<section className="rounded-2xl border p-4"><h3 className="font-black">Pagamentos registrados</h3><div className="mt-3 space-y-2">{(detail.payments??[]).map((item,index)=><div key={`${item.recordedAt}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-background p-3 text-sm"><div><b>{paymentLabel[item.method]??item.method}</b>{item.note&&<p className="text-xs text-stone-500">{item.note}</p>}<p className="text-[11px] text-stone-400">{new Date(item.recordedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</p></div><strong>{money(item.amountCents)}</strong></div>)}</div></section>}{detail.balanceCents===0&&can('TABLES_CLOSE')&&<button disabled={busy} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/close`,{method:'PATCH'}),'Mesa fechada.').then(()=>{setDetail(undefined);setSelectedId(undefined);setSelectedTableId(undefined);setEvents([])})} className="w-full rounded-xl bg-success px-4 py-3 font-black text-white">Fechar mesa</button>}</>}
          {can('TABLES_TRANSFER')&&<section className="rounded-2xl border p-4"><h3 className="font-black">Operação</h3>{waiters.length>0&&<div className="mt-3 flex gap-2"><select className="field !mt-0" value={waiterTo} onChange={(e)=>setWaiterTo(e.target.value)}><option value="">Trocar garçom…</option>{waiters.map((waiter)=><option key={waiter.id} value={waiter.id}>{waiter.name}</option>)}</select><button type="button" disabled={busy||!waiterTo} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/waiter`,{method:'PATCH',body:JSON.stringify({waiterId:waiterTo})}),'Garçom alterado.')} className="rounded-xl border px-3 font-bold">OK</button></div>}<div className="mt-3 flex gap-2"><select className="field !mt-0" value={transferTo} onChange={(e)=>setTransferTo(e.target.value)}><option value="">Transferir para…</option>{freeTables.map((table)=><option key={table._id} value={table._id}>{table.name}</option>)}</select><button type="button" disabled={busy||!transferTo} onClick={()=>void run(async()=>{await authenticatedRequest(`/table-service/sessions/${detail._id}/transfer`,{method:'POST',body:JSON.stringify({fromTableId:selectedTableId??(typeof detail.tableIds[0]==='string'?detail.tableIds[0]:detail.tableIds[0]?._id),toTableId:transferTo})});setSelectedTableId(transferTo);setTransferTo('');},'Mesa transferida.')} className="rounded-xl border px-3 font-bold">OK</button></div>{freeTables.length>0&&<div className="mt-4"><p className="text-xs font-black uppercase tracking-wide text-stone-400">Juntar mesa</p><div className="mt-2 flex flex-wrap gap-2">{freeTables.slice(0,12).map((table)=><button type="button" disabled={busy} key={table._id} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/merge`,{method:'POST',body:JSON.stringify({tableIds:[table._id]})}),`${table.name} adicionada à comanda.`)} className="rounded-lg border px-3 py-2 text-xs font-bold">+ {table.name}</button>)}</div></div>}</section>}
          {events.length>0&&<section className="rounded-2xl border p-4"><div className="flex items-center justify-between"><h3 className="font-black">Histórico</h3><span className="text-xs font-bold text-stone-400">Auditoria</span></div><div className="mt-3 max-h-56 space-y-2 overflow-auto">{events.slice(0,20).map((event)=><div key={event._id} className="rounded-xl bg-background p-3 text-xs"><div className="flex justify-between gap-3"><b>{eventLabel[event.action]??event.action}</b><span className="text-stone-400">{new Date(event.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span></div><p className="mt-1 text-stone-500">{typeof event.actorId==='object'&&event.actorId?.name?event.actorId.name:'Usuário do estabelecimento'}</p></div>)}</div></section>}
        </aside>
      </div>
    </Modal>}

    {printerSetupOpen&&<Modal title="Menu Flow Printer" close={()=>{setPrinterSetupOpen(false);setPrinterToken('')}}><div className="space-y-4"><div className={`rounded-xl p-4 ${printerSettings?.connected?'bg-success/10':'bg-background'}`}><strong>{printerSettings?.connected?'Printer conectado':'Printer ainda não conectado'}</strong><p className="mt-1 text-sm text-stone-500">{printerSettings?.connected?`${printerSettings.printerDeviceName||'Computador'} está online.`:'Instale o Menu Flow Printer no Windows, gere a chave e cole no aplicativo local.'}</p></div><label className="flex items-center justify-between gap-4 rounded-xl border p-4 font-bold"><span>Ativar Menu Flow Printer</span><input type="checkbox" checked={Boolean(printerSettings?.printerEnabled)} onChange={(e)=>void savePrinterSettings({printerEnabled:e.target.checked})}/></label><label className="flex items-center justify-between gap-4 rounded-xl border p-4 font-bold"><span><b>Imprimir cozinha automaticamente</b><small className="mt-1 block font-normal text-stone-500">Pedido do garçom é impresso assim que for enviado.</small></span><input type="checkbox" checked={Boolean(printerSettings?.printerAutoKitchen)} onChange={(e)=>void savePrinterSettings({printerAutoKitchen:e.target.checked})}/></label><label className="flex items-center justify-between gap-4 rounded-xl border p-4 font-bold"><span><b>Imprimir conta automaticamente</b><small className="mt-1 block font-normal text-stone-500">Opcional. Desativado mantém a conta na fila do caixa para impressão com um clique.</small></span><input type="checkbox" checked={Boolean(printerSettings?.printerAutoBill)} onChange={(e)=>void savePrinterSettings({printerAutoBill:e.target.checked})}/></label><label className="font-bold">Papel<select className="field" value={printerSettings?.printerPaperWidth??80} onChange={(e)=>void savePrinterSettings({printerPaperWidth:Number(e.target.value) as 58|80})}><option value="80">80 mm</option><option value="58">58 mm</option></select></label><div className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><div><strong>Chave do computador</strong><p className="text-xs text-stone-500">Atual: {printerSettings?.printerTokenLast4?`termina em ${printerSettings.printerTokenLast4}`:'não gerada'}</p></div><button type="button" onClick={()=>void generatePrinterToken()} className="rounded-xl bg-ink px-4 py-2 font-black text-white">Gerar nova chave</button></div>{printerToken&&<div className="mt-3 rounded-xl bg-background p-3"><p className="text-xs font-bold text-stone-500">Copie agora. Por segurança ela não será exibida novamente.</p><code className="mt-2 block break-all text-xs font-bold">{printerToken}</code><button type="button" onClick={()=>void navigator.clipboard.writeText(printerToken)} className="mt-3 rounded-lg border px-3 py-2 text-xs font-black">Copiar chave</button></div>}</div><p className="text-xs text-stone-500">O pacote do sistema inclui a pasta <b>Menu-Flow-Printer</b> para instalar no computador Windows do restaurante.</p></div></Modal>}

    {addingProduct&&<Modal title={addingProduct.name} close={()=>setAddingProduct(undefined)}><div className="space-y-4"><label className="font-bold">Quantidade<input min="1" type="number" className="field" value={productQty} onChange={(e)=>setProductQty(Math.max(1,Number(e.target.value)))}/></label>{(addingProduct.addonGroups??[]).map((group)=><fieldset key={group._id??group.name} className="rounded-xl border p-3"><legend className="px-1 font-black">{group.name}{group.required?' *':''}</legend><div className="mt-2 space-y-2">{group.addons.map((addon)=><label key={addon._id??addon.name} className="flex items-center justify-between gap-3 rounded-lg bg-background p-2"><span><input className="mr-2" type="checkbox" checked={Boolean(group._id&&addon._id&&(addonSelections[group._id]??[]).includes(addon._id))} onChange={()=>toggleAddon(group,addon)}/>{addon.name}</span><b>{money(addon.priceCents??Math.round(addon.price*100))}</b></label>)}</div></fieldset>)}<label className="font-bold">Observação<textarea className="field min-h-20" value={productNote} onChange={(e)=>setProductNote(e.target.value)} placeholder="Ex.: sem cebola"/></label><button type="button" onClick={addProductToCart} className="w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Adicionar à comanda</button></div></Modal>}
  </section>;
}

function WorkspaceTab({active,onClick,label,badge}:{active:boolean;onClick:()=>void;label:string;badge:string}) { return <button type="button" onClick={onClick} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black ${active?'bg-white text-ink':'bg-white/10 text-white'}`}>{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${active?'bg-ink/10':'bg-white/10'}`}>{badge}</span></button>; }
function sessionTableName(session: Session, tables: TableItem[]) { const ids=(session.tableIds??[]).map((table)=>typeof table==='string'?table:table._id); const names=ids.map((id)=>tables.find((table)=>table._id===id)?.name).filter(Boolean); return names.length?names.join(' + '):'Mesa'; }
function browserPrint(title:string, lines:string[]) { const popup=window.open('','_blank','width=440,height=720'); if(!popup) return; const escaped=lines.map((line)=>escapeHtml(line)).join('\n'); popup.document.write(`<html><head><title>${escapeHtml(title)}</title><style>@page{margin:4mm}body{font-family:monospace;font-size:12px;margin:0;white-space:pre-wrap}pre{white-space:pre-wrap}</style></head><body><pre>${escaped}</pre><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`); popup.document.close(); }
function orderPrintLines(session:Session,order:Order,tables:TableItem[]) { const lines=[`PEDIDO - COZINHA`,sessionTableName(session,tables),order.orderNumber??'', '------------------------------']; for(const item of order.items){lines.push(`${item.quantity}x ${item.productName}`); if(item.addons?.length) lines.push(` + ${item.addons.map((a)=>a.name).join(', ')}`); if(item.observation) lines.push(` OBS: ${item.observation}`);} lines.push('------------------------------','MENU FLOW'); return lines; }
function billPrintLines(session:Session,tables:TableItem[]) { const lines=['PRE-CONTA',sessionTableName(session,tables),'------------------------------']; for(const order of session.orders.filter((item)=>!['REJECTED','CANCELLED'].includes(item.status))) for(const item of order.items) lines.push(`${item.quantity}x ${item.productName}`); lines.push('------------------------------',`Subtotal: ${money(session.subtotalCents)}`,`Servico ${session.serviceFeePercent}%: ${money(session.serviceFeeCents)}`,`Desconto: -${money(session.discountCents)}`,`TOTAL: ${money(session.totalCents)}`,`Saldo: ${money(session.balanceCents)}`,'------------------------------','Esta nao e uma nota fiscal.','MENU FLOW'); return lines; }
function escapeHtml(value:string) { return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]||char)); }
function productCategory(product: Product) { return typeof product.categoryId === 'string' ? product.categoryId : product.categoryId._id; }
function productPriceCents(product: Product) { return product.promotionalPriceCents ?? (product.promotionalPrice !== undefined ? Math.round(product.promotionalPrice * 100) : (product.priceCents ?? Math.round(product.price * 100))); }
function tableTitle(session: Session) { const tables = session.tableIds.map((table) => typeof table === 'string' ? '' : table.name).filter(Boolean); return tables.length ? tables.join(' + ') : 'Comanda da mesa'; }
function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-xl bg-background p-3"><span className="text-xs font-bold text-stone-500">{label}</span><strong className="mt-1 block text-lg">{value}</strong></div>; }
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}) { return <div className={`flex items-center justify-between gap-4 ${strong?'font-black':''}`}><dt>{label}</dt><dd>{value}</dd></div>; }
function Modal({title,close,children,wide=false}:{title:string;close:()=>void;children:React.ReactNode;wide?:boolean}) { return <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/55 p-3 sm:p-6"><div className={`mx-auto my-3 rounded-[26px] bg-white p-5 shadow-2xl ${wide?'max-w-6xl':'max-w-xl'}`}><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-black">{title}</h2><button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 font-black">×</button></div>{children}</div></div>; }
