'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { authenticatedRequest } from '../../lib/authenticated-request';

type TableItem = { _id: string; number: number; name: string; capacity: number; active: boolean; sortOrder: number; qrToken?: string };
type Addon = { _id?: string; name: string; price: number; priceCents?: number };
type AddonGroup = { _id?: string; name: string; required?: boolean; min?: number; max?: number; pricingMode?: 'SUM'|'MAX'; addons: Addon[] };
type Product = { _id: string; categoryId: string | { _id: string }; name: string; price: number; priceCents?: number; promotionalPrice?: number; promotionalPriceCents?: number; addonGroups?: AddonGroup[] };
type Category = { _id: string; name: string; order: number; productionSector?: 'KITCHEN'|'BAR'|'NONE' };
type Order = { _id: string; orderNumber?: string; status: string; totalCents: number; createdAt: string; productionStates?: Array<{ sector: 'KITCHEN'|'BAR'; status: 'PREPARING'|'READY'; readyAt?: string }>; items: Array<{ productId?: string; productName: string; quantity: number; observation?: string; productionSector?: 'KITCHEN'|'BAR'|'NONE'; addons?: Array<{ name: string }> }> };
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
const eventLabel: Record<string, string> = { TABLE_OPENED: 'Mesa aberta', ORDER_ADDED: 'Pedido adicionado', ORDER_SECTOR_READY: 'Setor finalizou o pedido', ORDER_READY: 'Pedido pronto', ORDER_DELIVERED: 'Pedido entregue na mesa', ORDER_CANCELLED: 'Pedido cancelado', BILL_REQUESTED: 'Conta solicitada', PAYMENT_ADDED: 'Pagamento registrado', DISCOUNT_CHANGED: 'Desconto alterado', WAITER_CHANGED: 'Garçom alterado', TABLE_TRANSFERRED: 'Mesa transferida', TABLES_MERGED: 'Mesas agrupadas', TABLE_CLOSED: 'Mesa fechada' };

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
  const [detailTab, setDetailTab] = useState<'ORDER'|'ACCOUNT'|'MORE'>('ORDER');
  const [productionFilter, setProductionFilter] = useState<'ALL'|'KITCHEN'|'BAR'>('ALL');
  const [tablePage, setTablePage] = useState(1);
  const [productionPage, setProductionPage] = useState(1);
  const [cashierPage, setCashierPage] = useState(1);
  const [menuCategory, setMenuCategory] = useState<string>('');
  const [menuPage, setMenuPage] = useState(1);
  const [ownerSetupOpen, setOwnerSetupOpen] = useState(false);

  const can = useCallback((permission: string) => {
    if (ownerMode || user?.role === 'RESTAURANT_ADMIN' || user?.permissions?.includes(permission)) return true;
    if (['KITCHEN','BAR'].includes(user?.employeePosition ?? '') && ['TABLES_VIEW','TABLES_KITCHEN','TABLES_PRINT'].includes(permission)) return true;
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
    if (['KITCHEN','BAR'].includes(user?.employeePosition ?? '')) { setWorkspace('KITCHEN'); setProductionFilter(user?.employeePosition === 'BAR' ? 'BAR' : 'KITCHEN'); }
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
  const productionQueue = useMemo(() => (data?.sessions ?? []).flatMap((session) => (session.orders ?? []).filter((order) => order.status === 'PREPARING').flatMap((order) => {
    const states = order.productionStates?.length ? order.productionStates : [...new Set(order.items.map((item)=>item.productionSector ?? 'KITCHEN').filter((sector)=>sector==='KITCHEN'||sector==='BAR'))].map((sector)=>({sector:sector as 'KITCHEN'|'BAR',status:'PREPARING' as const}));
    return states.filter((state)=>state.status==='PREPARING').map((state)=>({ session, order, sector: state.sector, items: order.items.filter((item)=>(item.productionSector ?? 'KITCHEN')===state.sector) }));
  })).sort((a,b)=>new Date(a.order.createdAt).getTime()-new Date(b.order.createdAt).getTime()), [data?.sessions]);
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
    setSelectedId(session._id); setDetailTab('ORDER');
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
      setSelectedId(session._id); setSelectedTableId(session.primaryTableId); setDetail(current); setEvents(history); setDetailTab(session.status === 'AWAITING_PAYMENT' ? 'ACCOUNT' : 'ORDER');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível abrir a comanda.'); }
  }
  async function markReady(session: Session, order: Order, sector?: 'KITCHEN'|'BAR') {
    await run(() => authenticatedRequest(`/table-service/sessions/${session._id}/orders/${order._id}/ready`, { method: 'PATCH', body: JSON.stringify(sector ? { sector } : {}) }), sector ? `${sector === 'BAR' ? 'Bar' : 'Cozinha'} finalizado.` : 'Pedido pronto. O garçom foi avisado.');
  }
  async function printOrder(session: Session, order: Order, sector: 'KITCHEN'|'BAR' = 'KITCHEN') {
    if (printerSettings?.printerEnabled && printerSettings.connected) {
      await run(() => authenticatedRequest(`/printer/jobs/order/${order._id}/${sector}`, { method: 'POST' }), `${sector === 'BAR' ? 'Bar' : 'Cozinha'} enviado para a impressora.`);
      return;
    }
    browserPrint(`Pedido - ${sector === 'BAR' ? 'Bar' : 'Cozinha'}`, orderPrintLines(session, order, data?.tables ?? [], sector));
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

  const tablePageSize = 12;
  const productionPageSize = 6;
  const cashierPageSize = 6;
  const tablePages = Math.max(1, Math.ceil(filteredTables.length / tablePageSize));
  const visibleTablePage = Math.min(tablePage, tablePages);
  const tableSlice = filteredTables.slice((visibleTablePage - 1) * tablePageSize, visibleTablePage * tablePageSize);
  const productionFiltered = productionQueue.filter((item) => productionFilter === 'ALL' || item.sector === productionFilter);
  const productionPages = Math.max(1, Math.ceil(productionFiltered.length / productionPageSize));
  const visibleProductionPage = Math.min(productionPage, productionPages);
  const productionSlice = productionFiltered.slice((visibleProductionPage - 1) * productionPageSize, visibleProductionPage * productionPageSize);
  const cashierPages = Math.max(1, Math.ceil(cashierQueue.length / cashierPageSize));
  const visibleCashierPage = Math.min(cashierPage, cashierPages);
  const cashierSlice = cashierQueue.slice((visibleCashierPage - 1) * cashierPageSize, visibleCashierPage * cashierPageSize);
  const orderedCategories = [...catalog.categories].filter((category)=>catalog.products.some((product)=>productCategory(product)===category._id)).sort((a,b)=>a.order-b.order);
  const activeMenuCategory = menuCategory || orderedCategories[0]?._id || '';
  const menuProducts = catalog.products.filter((product)=>productCategory(product)===activeMenuCategory);
  const menuPages = Math.max(1, Math.ceil(menuProducts.length / 6));
  const visibleMenuPage = Math.min(menuPage, menuPages);
  const menuSlice = menuProducts.slice((visibleMenuPage-1)*6, visibleMenuPage*6);

  if (!data) return <section className="mx-auto max-w-7xl"><div className="h-36 animate-pulse rounded-3xl bg-stone-200" />{message && <p className="mt-4 rounded-xl bg-surface p-3">{message}</p>}</section>;

  return <section className="mx-auto max-w-7xl space-y-4">
    <header className="rounded-2xl bg-ink p-4 text-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-lime">Operação · Menu Flow</p><h1 className="mt-1 text-xl font-black">Salão, produção e caixa</h1></div>
        <div className="flex flex-wrap gap-2">
          {ownerMode&&<button type="button" onClick={()=>setOwnerSetupOpen(true)} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-black">Configurar mesas</button>}
          {ownerMode&&<button type="button" onClick={()=>setPrinterSetupOpen(true)} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-black">Printer</button>}
          <button type="button" onClick={() => void Promise.all([load(),loadSupport(),refreshPrinter()])} className="rounded-xl border border-white/20 px-3 py-2 text-xs font-black">Atualizar</button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <WorkspaceTab active={workspace==='TABLES'} onClick={()=>setWorkspace('TABLES')} label="Mesas" badge={String((data.sessions??[]).filter((item)=>item.status==='OPEN').length)}/>
        {can('TABLES_KITCHEN')&&<WorkspaceTab active={workspace==='KITCHEN'} onClick={()=>setWorkspace('KITCHEN')} label="Produção" badge={String(productionQueue.length)}/>} 
        {(can('TABLES_PAYMENT')||can('TABLES_PRINT'))&&<WorkspaceTab active={workspace==='CASHIER'} onClick={()=>setWorkspace('CASHIER')} label="Caixa" badge={String(cashierQueue.length)}/>} 
      </div>
    </header>

    {message&&<div className="flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm font-bold"><span>{message}</span><button type="button" onClick={()=>setMessage('')} className="text-stone-400">×</button></div>}
    {!data.settings.tableServiceEnabled && <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4"><strong>Controle de mesas desativado.</strong><p className="mt-1 text-sm text-stone-600">O administrador precisa liberar o recurso para este estabelecimento.</p></div>}

    {workspace==='TABLES'&&<>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">{([['ALL','Todas'],['FREE','Livres'],['OCCUPIED','Ocupadas'],['READY','Prontas'],['PAYMENT','Conta']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>{setFilter(value);setTablePage(1)}} className={`rounded-full px-3 py-2 text-xs font-black ${filter===value?'bg-ink text-white':'border bg-white text-stone-600'}`}>{label}</button>)}</div>
        <span className={`rounded-full px-3 py-2 text-xs font-black ${printerSettings?.connected?'bg-success/10 text-success':'bg-stone-100 text-stone-500'}`}>{printerSettings?.connected?'Printer online':'Printer offline'}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tableSlice.map((table)=>{const session=sessionByTable.get(table._id);const state=stateFor(session);return <button type="button" key={table._id} onClick={()=>void selectTable(table)} className={`min-h-[118px] rounded-2xl border bg-white p-4 text-left shadow-sm ${!table.active?'opacity-50':''}`}><div className="flex items-start justify-between gap-2"><div><span className="text-[10px] font-black text-stone-400">MESA {String(table.number).padStart(2,'0')}</span><h3 className="text-lg font-black">{table.name}</h3></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${state.className}`}>{state.label}</span></div>{session?<div className="mt-3 flex items-end justify-between gap-2"><div><strong className="text-lg">{money(session.totalCents)}</strong><p className="text-[11px] text-stone-500">{session.peopleCount} pessoa(s)</p></div>{session.waiterId&&typeof session.waiterId==='object'&&<span className="max-w-[120px] truncate text-[11px] font-bold text-stone-500">{session.waiterId.name}</span>}</div>:<p className="mt-3 text-xs text-stone-500">Capacidade: {table.capacity}</p>}</button>})}
        {!tableSlice.length&&<div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-stone-500 sm:col-span-2 lg:col-span-3 xl:col-span-4">Nenhuma mesa neste filtro.</div>}
      </div>
      <Pager page={visibleTablePage} pages={tablePages} setPage={setTablePage}/>
    </>}

    {workspace==='KITCHEN'&&<>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{([['ALL','Tudo'],['KITCHEN','Cozinha'],['BAR','Bar']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>{setProductionFilter(value);setProductionPage(1)}} className={`rounded-xl px-4 py-2 text-sm font-black ${productionFilter===value?'bg-ink text-white':'border bg-white'}`}>{label}<span className="ml-2 text-xs opacity-60">{productionQueue.filter((item)=>value==='ALL'||item.sector===value).length}</span></button>)}</div>
        <div className="text-right"><strong className="text-sm">Pedidos entram direto aqui</strong><p className="text-xs text-stone-500">Impressão automática ao enviar pelo garçom.</p></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {productionSlice.map(({session,order,sector,items})=><article key={`${order._id}-${sector}`} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-wide text-stone-400">{sessionTableName(session,data.tables)} · {order.orderNumber}</p><h3 className="text-lg font-black">{sector==='BAR'?'BAR':'COZINHA'}</h3></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${sector==='BAR'?'bg-primary/10 text-primary':'bg-accent/10 text-accent'}`}>Em preparo</span></div><div className="mt-3 grid gap-2">{items.slice(0,5).map((item,index)=><div key={index} className="rounded-xl bg-background px-3 py-2 text-sm"><b>{item.quantity}x {item.productName}</b>{item.addons?.length?<p className="text-[11px] text-stone-500">+ {item.addons.map((addon)=>addon.name).join(', ')}</p>:null}{item.observation&&<p className="text-xs font-black text-danger">OBS: {item.observation}</p>}</div>)}{items.length>5&&<p className="text-xs font-bold text-stone-500">+ {items.length-5} item(ns)</p>}</div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={()=>void printOrder(session,order,sector)} className="rounded-xl border px-3 py-2 font-black">Reimprimir</button><button type="button" disabled={busy} onClick={()=>void markReady(session,order,sector)} className="rounded-xl bg-success px-3 py-2 font-black text-white">Pronto</button></div></article>)}
        {!productionSlice.length&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-stone-500 lg:col-span-2 xl:col-span-3"><strong className="block text-ink">Produção em dia</strong><span className="text-sm">Novos pedidos aparecem e imprimem automaticamente.</span></div>}
      </div>
      <Pager page={visibleProductionPage} pages={productionPages} setPage={setProductionPage}/>
    </>}

    {workspace==='CASHIER'&&<>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-black">Contas solicitadas</h2><p className="text-xs text-stone-500">O caixa mantém todas as funções: impressão, pagamentos, divisão, desconto e fechamento.</p></div>
        <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-2 text-xs font-black ${printerSettings?.connected?'bg-success/10 text-success':'bg-stone-100 text-stone-500'}`}>{printerSettings?.connected?'Printer online':'Printer offline'}</span><span className="rounded-full bg-gold/15 px-3 py-2 text-xs font-black">{cashierQueue.length} aguardando</span></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cashierSlice.map((session)=><article key={session._id} className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-gold">Conta solicitada</p><h3 className="text-xl font-black">{sessionTableName(session,data.tables)}</h3><p className="mt-1 text-xs text-stone-500">{session.peopleCount} pessoa(s){typeof session.waiterId==='object'&&session.waiterId?.name?` · ${session.waiterId.name}`:''}</p></div><strong className="text-xl">{money(session.balanceCents)}</strong></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center"><Metric label="Total" value={money(session.totalCents)}/><Metric label="Pago" value={money(session.paidCents)}/><Metric label="Saldo" value={money(session.balanceCents)}/></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={()=>void printBill(session)} className="rounded-xl border px-3 py-3 font-black">Imprimir</button><button type="button" onClick={()=>void openSessionDetail(session)} className="rounded-xl bg-ink px-3 py-3 font-black text-white">Abrir conta</button></div>
        </article>)}
        {!cashierSlice.length&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-stone-500 md:col-span-2 xl:col-span-3"><strong className="block text-ink">Nenhuma conta aguardando</strong><span className="text-sm">Quando o garçom pedir a conta ela aparece aqui automaticamente.</span></div>}
      </div>
      <Pager page={visibleCashierPage} pages={cashierPages} setPage={setCashierPage}/>
    </>}

    {openTable&&<Modal title={`Abrir ${openTable.name}`} close={()=>setOpenTable(undefined)}><form onSubmit={openSession} className="grid gap-3"><label className="font-bold">Pessoas<input min="1" max="100" type="number" className="field" value={openForm.peopleCount} onChange={(e)=>setOpenForm({...openForm,peopleCount:e.target.value})}/></label><label className="font-bold">Cliente (opcional)<input className="field" value={openForm.customerName} onChange={(e)=>setOpenForm({...openForm,customerName:e.target.value})}/></label>{waiters.length>0&&<label className="font-bold">Garçom<select className="field" value={openForm.waiterId} onChange={(e)=>setOpenForm({...openForm,waiterId:e.target.value})}><option value="">Eu / automático</option>{waiters.map((waiter)=><option key={waiter.id} value={waiter.id}>{waiter.name}</option>)}</select></label>}<button disabled={busy} className="rounded-xl bg-ink px-4 py-3 font-black text-white">Abrir mesa</button></form></Modal>}

    {detail&&<Modal wide title={addingProduct?addingProduct.name:tableTitle(detail)} close={()=>{setAddingProduct(undefined);setDetail(undefined);setSelectedId(undefined);setSelectedTableId(undefined);setEvents([]);setCart([])}}>
      {addingProduct ? <div className="mx-auto max-w-2xl space-y-4">
        <button type="button" onClick={()=>setAddingProduct(undefined)} className="rounded-xl border px-4 py-2 text-sm font-black">← Voltar para a comanda</button>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="font-bold">Quantidade<input min="1" type="number" className="field" value={productQty} onChange={(e)=>setProductQty(Math.max(1,Number(e.target.value)))}/></label><div className="self-end rounded-xl bg-background px-4 py-3 text-right"><span className="text-xs text-stone-500">Valor unitário</span><strong className="block text-lg">{money(productPriceCents(addingProduct))}</strong></div></div>
        {(addingProduct.addonGroups??[]).map((group)=><fieldset key={group._id??group.name} className="rounded-xl border p-3"><legend className="px-1 font-black">{group.name}{group.required?' *':''}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.addons.map((addon)=><label key={addon._id??addon.name} className="flex items-center justify-between gap-3 rounded-lg bg-background p-2"><span><input className="mr-2" type="checkbox" checked={Boolean(group._id&&addon._id&&(addonSelections[group._id]??[]).includes(addon._id))} onChange={()=>toggleAddon(group,addon)}/>{addon.name}</span><b>{money(addon.priceCents??Math.round(addon.price*100))}</b></label>)}</div></fieldset>)}
        <label className="font-bold">Observação<textarea className="field min-h-20" value={productNote} onChange={(e)=>setProductNote(e.target.value)} placeholder="Ex.: sem cebola"/></label>
        <button type="button" onClick={addProductToCart} className="w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Adicionar à comanda</button>
      </div> : <>
        <div className="mb-3 flex flex-wrap gap-2"><DetailTab active={detailTab==='ORDER'} onClick={()=>setDetailTab('ORDER')}>Pedido</DetailTab><DetailTab active={detailTab==='ACCOUNT'} onClick={()=>setDetailTab('ACCOUNT')}>Conta</DetailTab><DetailTab active={detailTab==='MORE'} onClick={()=>setDetailTab('MORE')}>Mais</DetailTab></div>

        {detailTab==='ORDER'&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(270px,.75fr)]">
          <main className="min-w-0 space-y-3">
            {detail.status==='OPEN'&&can('TABLES_ORDER')?<><div className="flex gap-2 overflow-x-auto pb-1">{orderedCategories.map((category)=><button type="button" key={category._id} onClick={()=>{setMenuCategory(category._id);setMenuPage(1)}} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${(activeMenuCategory===category._id)?'bg-ink text-white':'border bg-white'}`}>{category.name}</button>)}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{menuSlice.map((product)=><button type="button" key={product._id} onClick={()=>beginProduct(product)} className="rounded-xl border bg-white p-3 text-left"><strong className="line-clamp-2 text-sm">{product.name}</strong><span className="mt-1 block text-xs text-stone-500">{money(productPriceCents(product))}</span></button>)}{!menuSlice.length&&<p className="col-span-full rounded-xl border border-dashed p-5 text-center text-sm text-stone-500">Nenhum produto nesta categoria.</p>}</div><Pager page={visibleMenuPage} pages={menuPages} setPage={setMenuPage} compact/>{cart.length>0&&<div className="rounded-xl bg-background p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{cart.reduce((sum,item)=>sum+item.quantity,0)} item(ns)</strong><p className="text-xs text-stone-500">Ao enviar, vai direto para produção e impressão automática.</p></div><button disabled={busy} type="button" onClick={()=>void sendOrder()} className="rounded-xl bg-ink px-4 py-3 font-black text-white">Enviar pedido</button></div><div className="mt-2 flex flex-wrap gap-2">{cart.map((item)=><button type="button" key={item.key} onClick={()=>setCart(cart.filter((current)=>current.key!==item.key))} className="rounded-full border bg-white px-2.5 py-1 text-xs font-bold">{item.quantity}x {item.product.name} ×</button>)}</div></div>}</>:<div className="rounded-xl bg-gold/10 p-4 text-sm font-bold">A conta já foi solicitada. Novos itens estão bloqueados.</div>}
          </main>
          <aside className="rounded-2xl bg-background p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-stone-500">{detail.peopleCount} pessoa(s)</p><strong>{typeof detail.waiterId==='object'&&detail.waiterId?.name?detail.waiterId.name:'Sem garçom'}</strong></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${detail.status==='AWAITING_PAYMENT'?'bg-gold/20':'bg-white'}`}>{detail.status==='AWAITING_PAYMENT'?'Conta solicitada':'Mesa aberta'}</span></div><div className="mt-4 space-y-2">{detail.orders.slice(-6).reverse().map((order)=><div key={order._id} className="rounded-xl bg-white p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs">{order.orderNumber}</b><span className="text-[10px] font-black text-stone-500">{statusLabel[order.status]??order.status}</span></div><p className="mt-1 text-xs text-stone-500">{order.items.reduce((sum,item)=>sum+item.quantity,0)} item(ns) · {money(order.totalCents)}</p>{order.status==='READY'&&can('TABLES_DELIVER')&&<button type="button" disabled={busy} onClick={()=>void markDelivered(order)} className="mt-2 w-full rounded-lg bg-success px-3 py-2 text-xs font-black text-white">Entregue na mesa</button>}{can('TABLES_CANCEL')&&!['COMPLETED','REJECTED','CANCELLED'].includes(order.status)&&detail.paidCents===0&&<button type="button" disabled={busy} onClick={()=>void cancelTableOrder(order)} className="mt-1 w-full rounded-lg px-3 py-1.5 text-[11px] font-bold text-danger">Cancelar pedido</button>}</div>)}</div>{detail.status==='OPEN'&&can('TABLES_REQUEST_BILL')&&<button type="button" disabled={busy} onClick={()=>{setDetailTab('ACCOUNT');void run(async()=>{const updated=await authenticatedRequest<Session>(`/table-service/sessions/${detail._id}/request-bill`,{method:'PATCH'});setDetail(updated)},'Conta enviada ao caixa.')}} className="mt-4 w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Pedir conta</button>}</aside>
        </div>}

        {detailTab==='ACCOUNT'&&<div className="grid gap-3 lg:grid-cols-[.85fr_1.15fr_.9fr]">
          <section className="rounded-2xl bg-background p-4"><h3 className="font-black">Resumo da conta</h3><dl className="mt-3 space-y-2 text-sm"><Row label="Pedidos" value={money(detail.subtotalCents)}/><Row label={`Serviço (${detail.serviceFeePercent}%)`} value={money(detail.serviceFeeCents)}/><Row label="Desconto" value={`- ${money(detail.discountCents)}`}/><Row label="Pago" value={money(detail.paidCents)}/><div className="border-t pt-2"><Row strong label="Total" value={money(detail.totalCents)}/><Row strong label="Saldo pendente" value={money(detail.balanceCents)}/></div></dl><div className="mt-4 grid gap-2"><button type="button" disabled={busy} onClick={()=>void printBill(detail)} className="rounded-xl border bg-white px-4 py-3 font-black">Imprimir pré-conta</button>{detail.status==='OPEN'&&can('TABLES_REQUEST_BILL')&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{const updated=await authenticatedRequest<Session>(`/table-service/sessions/${detail._id}/request-bill`,{method:'PATCH'});setDetail(updated)},'Conta enviada ao caixa.')} className="rounded-xl bg-gold px-4 py-3 font-black text-ink">Pedir conta</button>}{detail.balanceCents===0&&detail.status==='AWAITING_PAYMENT'&&can('TABLES_CLOSE')&&<button disabled={busy} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/close`,{method:'PATCH'}),'Mesa fechada.').then(()=>{setDetail(undefined);setSelectedId(undefined);setSelectedTableId(undefined);setEvents([])})} className="rounded-xl bg-success px-4 py-3 font-black text-white">Fechar mesa</button>}</div></section>

          <section className="rounded-2xl border p-4"><h3 className="font-black">Recebimento</h3>{detail.status==='AWAITING_PAYMENT'&&can('TABLES_PAYMENT')?<form onSubmit={(e)=>{e.preventDefault();void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/payments`,{method:'POST',body:JSON.stringify({amountCents:Math.round(Number(payment.amount.replace(',','.'))*100),method:payment.method,note:payment.note||undefined})}),'Pagamento registrado.').then(()=>setPayment({...payment,amount:'',note:''}))}}><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setPaymentCents(detail.balanceCents)} className="rounded-lg border px-3 py-2 text-xs font-black">Saldo total</button>{detail.peopleCount>1&&<button type="button" onClick={()=>setPaymentCents(Math.min(detail.balanceCents,Math.ceil(detail.totalCents/detail.peopleCount)))} className="rounded-lg border px-3 py-2 text-xs font-black">Dividir por {detail.peopleCount}</button>}</div><label className="mt-3 block text-sm font-bold">Valor (R$)<input required min="0.01" step="0.01" className="field" value={payment.amount} onChange={(e)=>setPayment({...payment,amount:e.target.value})}/></label><label className="mt-2 block text-sm font-bold">Forma<select className="field" value={payment.method} onChange={(e)=>setPayment({...payment,method:e.target.value})}>{Object.entries(paymentLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="mt-2 block text-sm font-bold">Observação<input className="field" value={payment.note} onChange={(e)=>setPayment({...payment,note:e.target.value})}/></label><button disabled={busy} className="mt-3 w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Adicionar pagamento</button></form>:<p className="mt-3 rounded-xl bg-background p-3 text-sm text-stone-500">Solicite a conta para registrar o pagamento.</p>}
            {detail.status==='AWAITING_PAYMENT'&&detail.orders.some((order)=>!['REJECTED','CANCELLED'].includes(order.status))&&<div className="mt-4 border-t pt-3"><p className="text-xs font-black uppercase text-stone-400">Cobrar pedido específico</p><div className="mt-2 flex flex-wrap gap-2">{detail.orders.filter((order)=>!['REJECTED','CANCELLED'].includes(order.status)).slice(-6).map((order)=><button type="button" key={order._id} onClick={()=>{setPaymentCents(Math.min(order.totalCents,detail.balanceCents));setPayment((current)=>({...current,note:`Pedido ${order.orderNumber??''}`.trim()}));}} className="rounded-lg border px-3 py-2 text-xs font-black">{order.orderNumber} · {money(Math.min(order.totalCents,detail.balanceCents))}</button>)}</div></div>}
          </section>

          <div className="space-y-3">{detail.status==='AWAITING_PAYMENT'&&can('TABLES_DISCOUNT')&&<form onSubmit={(e)=>{e.preventDefault();void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/discount`,{method:'PATCH',body:JSON.stringify({discountCents:Math.round(Number(discount.replace(',','.'))*100)})}),'Desconto atualizado.')}} className="rounded-2xl border p-4"><h3 className="font-black">Desconto</h3><div className="mt-2 flex gap-2"><input min="0" step="0.01" type="number" className="field !mt-0" placeholder="R$" value={discount} onChange={(e)=>setDiscount(e.target.value)}/><button disabled={busy} className="rounded-xl border px-4 font-black">Aplicar</button></div></form>}{(detail.payments??[]).length>0&&<section className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-black">Pagamentos</h3><span className="text-xs font-bold text-stone-400">{detail.payments?.length}</span></div><div className="mt-2 space-y-2">{(detail.payments??[]).slice(-4).reverse().map((item,index)=><div key={`${item.recordedAt}-${index}`} className="flex items-start justify-between gap-2 rounded-xl bg-background p-2 text-xs"><div><b>{paymentLabel[item.method]??item.method}</b>{item.note&&<p className="text-stone-500">{item.note}</p>}</div><strong>{money(item.amountCents)}</strong></div>)}</div></section>}</div>
        </div>}

        {detailTab==='MORE'&&<div className="grid gap-3 sm:grid-cols-2">{can('TABLES_TRANSFER')&&<section className="rounded-2xl border p-4"><h3 className="font-black">Mesa e garçom</h3>{waiters.length>0&&<div className="mt-3 flex gap-2"><select className="field !mt-0" value={waiterTo} onChange={(e)=>setWaiterTo(e.target.value)}><option value="">Trocar garçom…</option>{waiters.map((waiter)=><option key={waiter.id} value={waiter.id}>{waiter.name}</option>)}</select><button type="button" disabled={busy||!waiterTo} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/waiter`,{method:'PATCH',body:JSON.stringify({waiterId:waiterTo})}),'Garçom alterado.')} className="rounded-xl border px-3 font-bold">OK</button></div>}<div className="mt-2 flex gap-2"><select className="field !mt-0" value={transferTo} onChange={(e)=>setTransferTo(e.target.value)}><option value="">Transferir para…</option>{freeTables.map((table)=><option key={table._id} value={table._id}>{table.name}</option>)}</select><button type="button" disabled={busy||!transferTo} onClick={()=>void run(async()=>{await authenticatedRequest(`/table-service/sessions/${detail._id}/transfer`,{method:'POST',body:JSON.stringify({fromTableId:selectedTableId??(typeof detail.tableIds[0]==='string'?detail.tableIds[0]:detail.tableIds[0]?._id),toTableId:transferTo})});setSelectedTableId(transferTo);setTransferTo('')},'Mesa transferida.')} className="rounded-xl border px-3 font-bold">OK</button></div></section>}{can('TABLES_TRANSFER')&&freeTables.length>0&&<section className="rounded-2xl border p-4"><h3 className="font-black">Juntar mesa</h3><div className="mt-3 flex flex-wrap gap-2">{freeTables.slice(0,8).map((table)=><button type="button" disabled={busy} key={table._id} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/merge`,{method:'POST',body:JSON.stringify({tableIds:[table._id]})}),`${table.name} adicionada.`)} className="rounded-lg border px-3 py-2 text-xs font-bold">+ {table.name}</button>)}</div></section>}{events.length>0&&<section className="rounded-2xl border p-4 sm:col-span-2"><div className="flex items-center justify-between"><h3 className="font-black">Histórico</h3><span className="text-xs font-bold text-stone-400">Auditoria</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{events.slice(0,8).map((event)=><div key={event._id} className="rounded-xl bg-background p-3 text-xs"><div className="flex justify-between gap-3"><b>{eventLabel[event.action]??event.action}</b><span className="text-stone-400">{new Date(event.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span></div></div>)}</div></section>}</div>}
      </>}
    </Modal>}

    {ownerSetupOpen&&<Modal wide title="Configurar mesas" close={()=>setOwnerSetupOpen(false)}><div className="grid gap-4 lg:grid-cols-2"><form onSubmit={createTables} className="rounded-2xl border p-4"><h3 className="font-black">Criar várias mesas</h3><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-sm font-bold">De<input className="field" type="number" min="1" value={bulk.from} onChange={(e)=>setBulk({...bulk,from:e.target.value})}/></label><label className="text-sm font-bold">Até<input className="field" type="number" min="1" value={bulk.to} onChange={(e)=>setBulk({...bulk,to:e.target.value})}/></label><label className="text-sm font-bold">Prefixo<input className="field" value={bulk.prefix} onChange={(e)=>setBulk({...bulk,prefix:e.target.value})}/></label><label className="text-sm font-bold">Capacidade<input className="field" type="number" min="1" value={bulk.capacity} onChange={(e)=>setBulk({...bulk,capacity:e.target.value})}/></label></div><button disabled={busy} className="mt-3 w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Criar mesas</button></form><form onSubmit={updateTable} className="rounded-2xl border p-4"><h3 className="font-black">Editar mesa</h3><div className="mt-3 grid gap-2"><select className="field !mt-0" value={manageTable.id} onChange={(e)=>{const table=data.tables.find((item)=>item._id===e.target.value);setManageTable(table?{id:table._id,name:table.name,capacity:String(table.capacity),active:table.active}:{id:'',name:'',capacity:'4',active:true})}}><option value="">Selecione…</option>{data.tables.map((table)=><option key={table._id} value={table._id}>{table.name}</option>)}</select><input disabled={!manageTable.id} className="field !mt-0" placeholder="Nome" value={manageTable.name} onChange={(e)=>setManageTable({...manageTable,name:e.target.value})}/><div className="grid grid-cols-2 gap-2"><input disabled={!manageTable.id} min="1" type="number" className="field !mt-0" value={manageTable.capacity} onChange={(e)=>setManageTable({...manageTable,capacity:e.target.value})}/><label className="flex items-center justify-between rounded-xl border px-3 font-bold">Ativa <input disabled={!manageTable.id} type="checkbox" checked={manageTable.active} onChange={(e)=>setManageTable({...manageTable,active:e.target.checked})}/></label></div></div><button disabled={busy||!manageTable.id} className="mt-3 w-full rounded-xl border px-4 py-3 font-black">Salvar mesa</button></form></div></Modal>}

    {printerSetupOpen&&<Modal title="Menu Flow Printer" close={()=>{setPrinterSetupOpen(false);setPrinterToken('')}}><div className="space-y-3"><div className={`rounded-xl p-3 ${printerSettings?.connected?'bg-success/10':'bg-background'}`}><strong>{printerSettings?.connected?'Printer conectado':'Printer ainda não conectado'}</strong><p className="text-xs text-stone-500">{printerSettings?.connected?`${printerSettings.printerDeviceName||'Computador'} online.`:'Instale o agente no Windows e gere a chave.'}</p></div><label className="flex items-center justify-between gap-3 rounded-xl border p-3 font-bold"><span>Ativar Menu Flow Printer</span><input type="checkbox" checked={Boolean(printerSettings?.printerEnabled)} onChange={(e)=>void savePrinterSettings({printerEnabled:e.target.checked})}/></label><label className="flex items-center justify-between gap-3 rounded-xl border p-3 font-bold"><span><b>Imprimir pedidos automaticamente</b><small className="block font-normal text-stone-500">Cozinha e bar são separados pelo cardápio.</small></span><input type="checkbox" checked={Boolean(printerSettings?.printerAutoKitchen)} onChange={(e)=>void savePrinterSettings({printerAutoKitchen:e.target.checked})}/></label><label className="flex items-center justify-between gap-3 rounded-xl border p-3 font-bold"><span>Pré-conta automática</span><input type="checkbox" checked={Boolean(printerSettings?.printerAutoBill)} onChange={(e)=>void savePrinterSettings({printerAutoBill:e.target.checked})}/></label><label className="font-bold">Papel<select className="field" value={printerSettings?.printerPaperWidth??80} onChange={(e)=>void savePrinterSettings({printerPaperWidth:Number(e.target.value) as 58|80})}><option value="80">80 mm</option><option value="58">58 mm</option></select></label><div className="rounded-xl border p-3"><div className="flex items-center justify-between gap-2"><div><strong>Chave do computador</strong><p className="text-xs text-stone-500">{printerSettings?.printerTokenLast4?`Termina em ${printerSettings.printerTokenLast4}`:'Ainda não gerada'}</p></div><button type="button" onClick={()=>void generatePrinterToken()} className="rounded-xl bg-ink px-3 py-2 text-sm font-black text-white">Gerar chave</button></div>{printerToken&&<code className="mt-3 block break-all rounded-lg bg-background p-2 text-xs font-bold">{printerToken}</code>}</div><p className="text-xs text-stone-500">No Menu Flow Printer, marque “mesma impressora para cozinha e bar” se o restaurante tiver somente uma impressora de produção.</p></div></Modal>}

  </section>;
}

function WorkspaceTab({active,onClick,label,badge}:{active:boolean;onClick:()=>void;label:string;badge:string}) { return <button type="button" onClick={onClick} className={`shrink-0 rounded-xl px-4 py-2 text-sm font-black ${active?'bg-white text-ink':'bg-white/10 text-white'}`}>{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${active?'bg-ink/10':'bg-white/10'}`}>{badge}</span></button>; }
function sessionTableName(session: Session, tables: TableItem[]) { const ids=(session.tableIds??[]).map((table)=>typeof table==='string'?table:table._id); const names=ids.map((id)=>tables.find((table)=>table._id===id)?.name).filter(Boolean); return names.length?names.join(' + '):'Mesa'; }
function browserPrint(title:string, lines:string[]) { const popup=window.open('','_blank','width=440,height=720'); if(!popup) return; const escaped=lines.map((line)=>escapeHtml(line)).join('\n'); popup.document.write(`<html><head><title>${escapeHtml(title)}</title><style>@page{margin:4mm}body{font-family:monospace;font-size:12px;margin:0;white-space:pre-wrap}pre{white-space:pre-wrap}</style></head><body><pre>${escaped}</pre><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`); popup.document.close(); }
function orderPrintLines(session:Session,order:Order,tables:TableItem[],sector:'KITCHEN'|'BAR'='KITCHEN') { const lines=[`PEDIDO - ${sector==='BAR'?'BAR':'COZINHA'}`,sessionTableName(session,tables),order.orderNumber??'', '------------------------------']; for(const item of order.items.filter((entry)=>(entry.productionSector??'KITCHEN')===sector)){lines.push(`${item.quantity}x ${item.productName}`); if(item.addons?.length) lines.push(` + ${item.addons.map((a)=>a.name).join(', ')}`); if(item.observation) lines.push(` OBS: ${item.observation}`);} lines.push('------------------------------','MENU FLOW'); return lines; }
function billPrintLines(session:Session,tables:TableItem[]) { const lines=['PRE-CONTA',sessionTableName(session,tables),'------------------------------']; for(const order of session.orders.filter((item)=>!['REJECTED','CANCELLED'].includes(item.status))) for(const item of order.items) lines.push(`${item.quantity}x ${item.productName}`); lines.push('------------------------------',`Subtotal: ${money(session.subtotalCents)}`,`Servico ${session.serviceFeePercent}%: ${money(session.serviceFeeCents)}`,`Desconto: -${money(session.discountCents)}`,`TOTAL: ${money(session.totalCents)}`,`Saldo: ${money(session.balanceCents)}`,'------------------------------','Esta nao e uma nota fiscal.','MENU FLOW'); return lines; }
function escapeHtml(value:string) { return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]||char)); }
function productCategory(product: Product) { return typeof product.categoryId === 'string' ? product.categoryId : product.categoryId._id; }
function productPriceCents(product: Product) { return product.promotionalPriceCents ?? (product.promotionalPrice !== undefined ? Math.round(product.promotionalPrice * 100) : (product.priceCents ?? Math.round(product.price * 100))); }
function tableTitle(session: Session) { const tables = session.tableIds.map((table) => typeof table === 'string' ? '' : table.name).filter(Boolean); return tables.length ? tables.join(' + ') : 'Comanda da mesa'; }
function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-xl bg-background p-3"><span className="text-xs font-bold text-stone-500">{label}</span><strong className="mt-1 block text-lg">{value}</strong></div>; }
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}) { return <div className={`flex items-center justify-between gap-4 ${strong?'font-black':''}`}><dt>{label}</dt><dd>{value}</dd></div>; }
function Modal({title,close,children,wide=false}:{title:string;close:()=>void;children:React.ReactNode;wide?:boolean}) { return <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/55 p-3 sm:p-6"><div className={`mx-auto my-3 rounded-[26px] bg-white p-5 shadow-2xl ${wide?'max-w-6xl':'max-w-xl'}`}><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-xl font-black">{title}</h2><button type="button" onClick={close} className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 font-black">×</button></div>{children}</div></div>; }

function Pager({page,pages,setPage,compact=false}:{page:number;pages:number;setPage:(page:number)=>void;compact?:boolean}) {
  if (pages <= 1) return null;
  return <div className={`flex items-center justify-center gap-3 ${compact?'mt-1':'mt-2'}`}><button type="button" disabled={page<=1} onClick={()=>setPage(Math.max(1,page-1))} className="rounded-xl border bg-white px-4 py-2 text-xs font-black disabled:opacity-30">‹ Anterior</button><span className="text-xs font-black text-stone-500">{page} / {pages}</span><button type="button" disabled={page>=pages} onClick={()=>setPage(Math.min(pages,page+1))} className="rounded-xl border bg-white px-4 py-2 text-xs font-black disabled:opacity-30">Próxima ›</button></div>;
}
function DetailTab({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}) { return <button type="button" onClick={onClick} className={`rounded-xl px-4 py-2 text-sm font-black ${active?'bg-ink text-white':'border bg-white'}`}>{children}</button>; }
