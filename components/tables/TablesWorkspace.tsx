'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  payments?: Array<{ amountCents: number; receivedCents?: number; changeCents?: number; method: string; recordedAt: string; note?: string }>;
  orders: Order[];
};
type Context = { settings: { tableServiceEnabled: boolean; waiterAppEnabled: boolean; serviceFeePercent: number; qrOrderingEnabled: boolean }; tables: TableItem[]; sessions: Session[] };
type Workspace = 'TABLES'|'KITCHEN'|'CASHIER';
type PrinterSettings = { printerEnabled: boolean; printerAutoKitchen: boolean; printerAutoBar: boolean; printerAutoBill: boolean; printerAutoCashOpen: boolean; printerAutoCashSupply: boolean; printerAutoCashWithdrawal: boolean; printerAutoCashClose: boolean; printerPaperWidth: 58|80; printerTokenLast4?: string|null; printerLastSeenAt?: string|null; printerDeviceName?: string|null; connected: boolean };
type PrintJobSummary = { _id?: string; printerRole: 'KITCHEN'|'BAR'|'CASHIER'; type: string; status: 'PENDING'|'CLAIMED'|'PRINTED'|'FAILED'; attempts?: number; error?: string; createdAt: string; printedAt?: string };
type CartItem = { key: string; product: Product; quantity: number; observation: string; addons: Array<{ groupId: string; addonId: string; label: string }> };
type CashShift = { _id: string; status: 'OPEN'|'CLOSED'; openingAmountCents: number; openedAt: string; openedBy?: string | { name?: string }; closedAt?: string; closedBy?: string | { name?: string }; declaredCashCents?: number; expectedCashCents?: number; differenceCents?: number; note?: string };
type CashSummary = { openingAmountCents: number; supplyCents: number; withdrawalCents: number; salesCents: number; cashSalesCents: number; pixSalesCents: number; creditSalesCents: number; debitSalesCents: number; expectedCashCents: number; declaredCashCents?: number; differenceCents?: number };
type CashMovement = { _id: string; type: 'OPENING'|'SUPPLY'|'WITHDRAWAL'|'SALE'; amountCents: number; method?: string; recordedAt: string; recordedBy?: string | { name?: string }; note?: string; sourceType?: string; sourceId?: string };
type CashContext = { shift: CashShift | null; summary: CashSummary; movements: CashMovement[]; lastClosed?: { shift: CashShift; summary: CashSummary } | null };
type CashAction = 'OPEN'|'SUPPLY'|'WITHDRAWAL'|'CLOSE'|'HISTORY';

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
  const [refreshing, setRefreshing] = useState(false);
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
  const [recentPrintJobs, setRecentPrintJobs] = useState<PrintJobSummary[]>([]);
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
  const [cash, setCash] = useState<CashContext>();
  const [cashAction, setCashAction] = useState<CashAction>();
  const [cashForm, setCashForm] = useState({ amount: '', note: '' });
  const [cashDeclared, setCashDeclared] = useState('');
  const selectedIdRef = useRef<string | undefined>(undefined);
  const refreshIdRef = useRef(0);

  const can = useCallback((permission: string) => {
    if (ownerMode || user?.role === 'RESTAURANT_ADMIN' || user?.permissions?.includes(permission)) return true;
    if (['KITCHEN','BAR'].includes(user?.employeePosition ?? '') && ['TABLES_VIEW','TABLES_KITCHEN','TABLES_PRINT'].includes(permission)) return true;
    if (user?.employeePosition === 'CASHIER' && ['TABLES_VIEW','TABLES_PAYMENT','TABLES_PRINT','TABLES_CLOSE'].includes(permission)) return true;
    return false;
  }, [ownerMode, user?.employeePosition, user?.permissions, user?.role]);
  const setPaymentCents = (cents: number) => setPayment((current) => ({ ...current, amount: (Math.max(0, cents) / 100).toFixed(2) }));
  const selectSessionId = (value?: string) => { selectedIdRef.current = value; setSelectedId(value); };
  const closeDetailModal = () => {
    refreshIdRef.current += 1;
    selectSessionId(undefined);
    setAddingProduct(undefined);
    setDetail(undefined);
    setSelectedTableId(undefined);
    setEvents([]);
    setCart([]);
    setPayment({ amount: '', method: 'PIX', note: '' });
    setDiscount('');
    setTransferTo('');
    setWaiterTo('');
    setMessage('');
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const requestId = ++refreshIdRef.current;
    const activeSelection = selectedIdRef.current;
    try {
      const [result, current, history] = await Promise.all([
        authenticatedRequest<Context>('/table-service/context'),
        activeSelection ? authenticatedRequest<Session>(`/table-service/sessions/${activeSelection}`).catch(() => undefined) : Promise.resolve(undefined),
        activeSelection ? authenticatedRequest<TableEvent[]>(`/table-service/sessions/${activeSelection}/events`).catch(() => []) : Promise.resolve([] as TableEvent[]),
      ]);
      if (requestId !== refreshIdRef.current) return;
      setData(result);
      if (activeSelection && selectedIdRef.current === activeSelection) {
        if (current) setDetail(current);
        setEvents(history);
      }
    } catch (error) {
      if (requestId !== refreshIdRef.current) return;
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as mesas.');
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

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
    const [printer, recent] = await Promise.all([
      authenticatedRequest<PrinterSettings>('/printer/settings').catch(() => undefined),
      authenticatedRequest<PrintJobSummary[]>('/printer/jobs/recent').catch(() => []),
    ]);
    if (printer) setPrinterSettings(printer);
    setRecentPrintJobs(recent);
  }, []);

  const canCashAccess = ownerMode || user?.role === 'RESTAURANT_ADMIN' || ['CASHIER','MANAGER'].includes(user?.employeePosition ?? '') || Boolean(user?.permissions?.some((permission) => ['TABLES_PAYMENT','TABLES_CLOSE','TABLES_DISCOUNT'].includes(permission)));
  const loadCash = useCallback(async (silent = false) => {
    if (!canCashAccess) return;
    try {
      const result = await authenticatedRequest<CashContext>('/cash-register/current');
      setCash(result);
    } catch (error) {
      if (!silent) setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o caixa.');
    }
  }, [canCashAccess]);

  useEffect(() => { void load(); void loadSupport(); void refreshPrinter(); void loadCash(); }, [load, loadSupport, refreshPrinter, loadCash]);
  useEffect(() => {
    if (ownerMode) return;
    if (['KITCHEN','BAR'].includes(user?.employeePosition ?? '')) { setWorkspace('KITCHEN'); setProductionFilter(user?.employeePosition === 'BAR' ? 'BAR' : 'KITCHEN'); }
    else if (user?.employeePosition === 'CASHIER') setWorkspace('CASHIER');
    else setWorkspace('TABLES');
  }, [ownerMode, user?.employeePosition, user?.permissions]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(true), 1800);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void refreshPrinter(), 3500);
    return () => window.clearInterval(timer);
  }, [refreshPrinter]);

  useEffect(() => {
    if (!canCashAccess) return;
    const timer = window.setInterval(() => void loadCash(true), workspace === 'CASHIER' ? 2200 : 5000);
    return () => window.clearInterval(timer);
  }, [canCashAccess, loadCash, workspace]);

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
    try { await action(); if (success) setMessage(success); await Promise.all([load(true), loadCash(true)]); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível concluir a ação.'); }
    finally { setBusy(false); }
  }

  const parseMoneyToCents = (value: string) => Math.round((Number(value.replace(',', '.')) || 0) * 100);
  async function submitCashAction(event: FormEvent) {
    event.preventDefault();
    if (!cashAction || cashAction === 'HISTORY') return;
    const amountCents = parseMoneyToCents(cashAction === 'CLOSE' ? cashDeclared : cashForm.amount);
    const path = cashAction === 'OPEN' ? '/cash-register/open' : cashAction === 'SUPPLY' ? '/cash-register/supply' : cashAction === 'WITHDRAWAL' ? '/cash-register/withdrawal' : '/cash-register/close';
    const body = cashAction === 'OPEN'
      ? { openingAmountCents: amountCents, note: cashForm.note || undefined }
      : cashAction === 'CLOSE'
        ? { declaredCashCents: cashDeclared.trim() ? amountCents : undefined, note: cashForm.note || undefined }
        : { amountCents, note: cashForm.note || undefined };
    await run(async () => {
      await authenticatedRequest(path, { method: 'POST', body: JSON.stringify(body) });
      setCashAction(undefined); setCashForm({ amount: '', note: '' }); setCashDeclared('');
    }, cashAction === 'OPEN' ? 'Caixa aberto.' : cashAction === 'SUPPLY' ? 'Suprimento registrado.' : cashAction === 'WITHDRAWAL' ? 'Sangria registrada.' : 'Caixa fechado.');
  }
  async function printCashSummary() {
    if (!cash) return;
    if (printerSettings?.printerEnabled && printerSettings.connected) {
      const result = await authenticatedRequest<{queued?:boolean}>('/cash-register/print', { method: 'POST' });
      if (result.queued) { setMessage('Resumo do caixa enviado para a impressora.'); return; }
    }
    browserPrint('Caixa', cashPrintLines(cash), printerSettings?.printerPaperWidth ?? 80);
    setMessage('Impressão do caixa aberta no navegador.');
  }
  async function printCashMovement(movement: CashMovement) {
    if (printerSettings?.printerEnabled && printerSettings.connected) {
      const result = await authenticatedRequest<{queued?:boolean}>(`/cash-register/movements/${movement._id}/print`, { method: 'POST' });
      if (result.queued) { setMessage('Comprovante enviado para a impressora.'); return; }
    }
    browserPrint('Operação de caixa', cashMovementPrintLines(movement), printerSettings?.printerPaperWidth ?? 80);
    setMessage('Comprovante aberto no navegador.');
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
      setSelectedTableId(openTable._id); setOpenTable(undefined); selectSessionId(session._id); setDetail(session); setOpenForm({ customerName: '', peopleCount: '2', waiterId: '' });
    }, 'Mesa aberta.');
  }

  async function selectTable(table: TableItem) {
    setSelectedTableId(table._id);
    const session = sessionByTable.get(table._id);
    if (!session) {
      if (!can('TABLES_OPEN')) { setMessage('Seu usuário não possui permissão para abrir mesas.'); return; }
      setOpenTable(table); return;
    }
    selectSessionId(session._id); setDetailTab('ORDER');
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
      selectSessionId(session._id); setSelectedTableId(session.primaryTableId); setDetail(current); setEvents(history); setDetailTab(session.status === 'AWAITING_PAYMENT' ? 'ACCOUNT' : 'ORDER');
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
    browserPrint(`Pedido - ${sector === 'BAR' ? 'Bar' : 'Cozinha'}`, orderPrintLines(session, order, data?.tables ?? [], sector), printerSettings?.printerPaperWidth ?? 80);
    setMessage('Menu Flow Printer offline: aberta a impressão do navegador.');
  }
  async function printBill(session: Session) {
    if (printerSettings?.printerEnabled && printerSettings.connected) {
      await run(() => authenticatedRequest(`/printer/jobs/bill/${session._id}`, { method: 'POST' }), 'Pré-conta enviada para a impressora do caixa.');
      return;
    }
    browserPrint('Pré-conta', billPrintLines(session, data?.tables ?? []), printerSettings?.printerPaperWidth ?? 80);
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
  const paymentAmountCents = Math.round(Number(String(payment.amount).replace(',', '.')) * 100) || 0;
  const cashChangeCents = payment.method === 'CASH' ? Math.max(0, paymentAmountCents - (detail?.balanceCents ?? 0)) : 0;
  const billableOrders = (detail?.orders ?? []).filter((order) => !['REJECTED','CANCELLED'].includes(order.status));
  const hasBillableOrders = billableOrders.length > 0 && (detail?.subtotalCents ?? 0) > 0;
  const hasModalOpen = Boolean(openTable || detail || ownerSetupOpen || printerSetupOpen);
  const summaryCards = [
    { icon: '🪑', label: 'Mesas abertas', value: String((data?.sessions ?? []).filter((item) => item.status === 'OPEN').length), tone: 'bg-white/12' },
    { icon: '🍳', label: 'Produção', value: String(productionQueue.length), tone: 'bg-white/12' },
    { icon: '💳', label: 'Contas no caixa', value: String(cashierQueue.length), tone: 'bg-white/12' },
    { icon: printerSettings?.connected ? '🖨️' : '⚪', label: 'Printer', value: printerSettings?.connected ? 'Online' : 'Offline', tone: printerSettings?.connected ? 'bg-emerald-400/15' : 'bg-white/12' },
  ];

  if (!data) return <section className="mx-auto max-w-7xl"><div className="h-36 animate-pulse rounded-3xl bg-stone-200" />{message && <p className="mt-4 rounded-xl bg-surface p-3">{message}</p>}</section>;

  return <section className="mx-auto max-w-7xl space-y-4 px-1 sm:px-0">
    <header className="overflow-hidden rounded-[28px] bg-gradient-to-r from-ink via-[#701c21] to-[#8f242a] p-4 text-white shadow-xl sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.24em] text-lime/90">Operação · Menu Flow</p>
          <h1 className="mt-1 text-xl font-black sm:text-2xl">Salão, produção e caixa</h1>
          <p className="mt-1 text-xs text-white/75 sm:text-sm">Uma área única para garçom, cozinha e caixa, com atualização rápida e impressão automática.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ownerMode&&<button type="button" onClick={()=>setOwnerSetupOpen(true)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black backdrop-blur">⚙️ Configurar mesas</button>}
          {ownerMode&&<button type="button" onClick={()=>setPrinterSetupOpen(true)} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black backdrop-blur">🖨️ Printer</button>}
          <button type="button" onClick={() => void Promise.all([load(),loadSupport(),refreshPrinter()])} className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-black backdrop-blur">{refreshing ? 'Atualizando…' : 'Atualizar'}</button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => <div key={card.label} className={`rounded-2xl ${card.tone} p-3 backdrop-blur`}><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-bold text-white/70">{card.label}</p><strong className="mt-1 block text-lg font-black">{card.value}</strong></div><span className="text-xl">{card.icon}</span></div></div>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <WorkspaceTab active={workspace==='TABLES'} onClick={()=>setWorkspace('TABLES')} icon="🪑" label="Mesas" badge={String((data.sessions??[]).filter((item)=>item.status==='OPEN').length)}/>
        {can('TABLES_KITCHEN')&&<WorkspaceTab active={workspace==='KITCHEN'} onClick={()=>setWorkspace('KITCHEN')} icon="🍳" label="Produção" badge={String(productionQueue.length)}/>} 
        {(can('TABLES_PAYMENT')||can('TABLES_PRINT'))&&<WorkspaceTab active={workspace==='CASHIER'} onClick={()=>setWorkspace('CASHIER')} icon="💳" label="Caixa" badge={String(cashierQueue.length)}/>} 
      </div>
    </header>

    {message&&!hasModalOpen&&<InlineNotice message={message} onClose={()=>setMessage('')} />}
    {!data.settings.tableServiceEnabled && <div className="rounded-2xl border border-gold/30 bg-gold/10 p-4"><strong>Controle de mesas desativado.</strong><p className="mt-1 text-sm text-stone-600">O administrador precisa liberar o recurso para este estabelecimento.</p></div>}

    {workspace==='TABLES'&&<>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-stone-200/80 bg-white/80 p-3 shadow-sm backdrop-blur">
        <div className="flex flex-wrap gap-2">{([['ALL','Todas'],['FREE','Livres'],['OCCUPIED','Ocupadas'],['READY','Prontas'],['PAYMENT','Conta']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>{setFilter(value);setTablePage(1)}} className={`rounded-full px-3 py-2 text-xs font-black ${filter===value?'bg-ink text-white':'border bg-white text-stone-600'}`}>{label}</button>)}</div>
        <span className={`rounded-full px-3 py-2 text-xs font-black ${printerSettings?.connected?'bg-success/10 text-success':'bg-stone-100 text-stone-500'}`}>{printerSettings?.connected?'Printer online':'Printer offline'}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tableSlice.map((table)=>{const session=sessionByTable.get(table._id);const state=stateFor(session);return <button type="button" key={table._id} onClick={()=>void selectTable(table)} className={`min-h-[118px] rounded-2xl border bg-white p-4 text-left shadow-sm ${!table.active?'opacity-50':''}`}><div className="flex items-start justify-between gap-2"><div><span className="text-[10px] font-black text-stone-400">🪑 MESA {String(table.number).padStart(2,'0')}</span><h3 className="text-lg font-black">{table.name}</h3></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${state.className}`}>{state.label}</span></div>{session?<div className="mt-3 flex items-end justify-between gap-2"><div><strong className="text-lg">{money(session.totalCents)}</strong><p className="text-[11px] text-stone-500">{session.peopleCount} pessoa(s)</p></div>{session.waiterId&&typeof session.waiterId==='object'&&<span className="max-w-[120px] truncate text-[11px] font-bold text-stone-500">{session.waiterId.name}</span>}</div>:<p className="mt-3 text-xs text-stone-500">Capacidade: {table.capacity}</p>}</button>})}
        {!tableSlice.length&&<div className="rounded-2xl border border-dashed bg-white p-8 text-center text-sm text-stone-500 sm:col-span-2 lg:col-span-3 xl:col-span-4">Nenhuma mesa neste filtro.</div>}
      </div>
      <Pager page={visibleTablePage} pages={tablePages} setPage={setTablePage}/>
    </>}

    {workspace==='KITCHEN'&&<>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white/80 p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">{([['ALL','Tudo'],['KITCHEN','Cozinha'],['BAR','Bar']] as const).map(([value,label])=><button key={value} type="button" onClick={()=>{setProductionFilter(value);setProductionPage(1)}} className={`rounded-xl px-4 py-2 text-sm font-black ${productionFilter===value?'bg-ink text-white':'border bg-white'}`}>{label}<span className="ml-2 text-xs opacity-60">{productionQueue.filter((item)=>value==='ALL'||item.sector===value).length}</span></button>)}</div>
        <div className="text-right"><strong className="text-sm">Pedidos entram direto aqui</strong><p className="text-xs text-stone-500">Impressão automática ao enviar pelo garçom.</p></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {productionSlice.map(({session,order,sector,items})=><article key={`${order._id}-${sector}`} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-black uppercase tracking-wide text-stone-400">{sessionTableName(session,data.tables)} · {order.orderNumber}</p><h3 className="text-lg font-black">{sector==='BAR'?'🍹 BAR':'🍳 COZINHA'}</h3></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${sector==='BAR'?'bg-primary/10 text-primary':'bg-accent/10 text-accent'}`}>Em preparo</span></div><div className="mt-3 grid gap-2">{items.slice(0,5).map((item,index)=><div key={index} className="rounded-xl bg-background px-3 py-2 text-sm"><b>{item.quantity}x {item.productName}</b>{item.addons?.length?<p className="text-[11px] text-stone-500">+ {item.addons.map((addon)=>addon.name).join(', ')}</p>:null}{item.observation&&<p className="text-xs font-black text-danger">OBS: {item.observation}</p>}</div>)}{items.length>5&&<p className="text-xs font-bold text-stone-500">+ {items.length-5} item(ns)</p>}</div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={()=>void printOrder(session,order,sector)} className="rounded-xl border px-3 py-2 font-black">Reimprimir</button><button type="button" disabled={busy} onClick={()=>void markReady(session,order,sector)} className="rounded-xl bg-success px-3 py-2 font-black text-white">Pronto</button></div></article>)}
        {!productionSlice.length&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-stone-500 lg:col-span-2 xl:col-span-3"><strong className="block text-ink">Produção em dia</strong><span className="text-sm">Novos pedidos aparecem e imprimem automaticamente.</span></div>}
      </div>
      <Pager page={visibleProductionPage} pages={productionPages} setPage={setProductionPage}/>
    </>}

    {workspace==='CASHIER'&&<>
      <section className="rounded-[24px] border border-stone-200/80 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-primary">💼 Controle de caixa</p><h2 className="mt-1 text-lg font-black">{cash?.shift ? 'Caixa aberto' : 'Caixa fechado'}</h2><p className="mt-1 text-xs text-stone-500">Abertura, suprimento, sangria, conferência, fechamento e impressão sem sair da operação.</p></div>
          <div className="flex flex-wrap gap-2">
            {!cash?.shift&&<><button type="button" onClick={()=>{setCashForm({amount:'0',note:''});setCashAction('OPEN')}} className="rounded-xl bg-success px-4 py-2.5 text-xs font-black text-white">🔓 Abrir caixa</button>{cash?.lastClosed&&<button type="button" onClick={()=>void printCashSummary()} className="rounded-xl border bg-white px-3 py-2.5 text-xs font-black">🖨️ Último fechamento</button>}</>}
            {cash?.shift&&<><button type="button" onClick={()=>{setCashForm({amount:'',note:''});setCashAction('SUPPLY')}} className="rounded-xl border bg-white px-3 py-2.5 text-xs font-black">➕ Suprimento</button><button type="button" onClick={()=>{setCashForm({amount:'',note:''});setCashAction('WITHDRAWAL')}} className="rounded-xl border bg-white px-3 py-2.5 text-xs font-black">➖ Sangria</button><button type="button" onClick={()=>setCashAction('HISTORY')} className="rounded-xl border bg-white px-3 py-2.5 text-xs font-black">📋 Operações</button><button type="button" onClick={()=>void printCashSummary()} className="rounded-xl border bg-white px-3 py-2.5 text-xs font-black">🖨️ Imprimir</button><button type="button" onClick={()=>{setCashDeclared((cash.summary.expectedCashCents/100).toFixed(2));setCashForm({amount:'',note:''});setCashAction('CLOSE')}} className="rounded-xl bg-ink px-4 py-2.5 text-xs font-black text-white">🔒 Fechar caixa</button></>}
          </div>
        </div>
        {cash?.shift?<>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            <CashMetric icon="💵" label="Dinheiro esperado" value={money(cash.summary.expectedCashCents)} strong/>
            <CashMetric icon="🟢" label="Vendas em dinheiro" value={money(cash.summary.cashSalesCents)}/>
            <CashMetric icon="⚡" label="PIX" value={money(cash.summary.pixSalesCents)}/>
            <CashMetric icon="💳" label="Crédito" value={money(cash.summary.creditSalesCents)}/>
            <CashMetric icon="💳" label="Débito" value={money(cash.summary.debitSalesCents)}/>
            <CashMetric icon="📈" label="Vendas no turno" value={money(cash.summary.salesCents)}/>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl bg-background px-4 py-3 text-xs text-stone-600"><span>🕒 Aberto {new Date(cash.shift.openedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span><span>💰 Fundo {money(cash.summary.openingAmountCents)}</span><span>➕ Suprimentos {money(cash.summary.supplyCents)}</span><span>➖ Sangrias {money(cash.summary.withdrawalCents)}</span></div>
        </>:<div className="mt-4 rounded-2xl border border-dashed bg-background p-4 text-sm text-stone-600"><b className="text-ink">Abra o caixa antes de receber pagamentos.</b>{cash?.lastClosed?.shift&&<p className="mt-1 text-xs">Último fechamento: {new Date(cash.lastClosed.shift.closedAt??cash.lastClosed.shift.openedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})} · Esperado {money(cash.lastClosed.summary.expectedCashCents)}.</p>}</div>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white/80 p-3 shadow-sm">
        <div><h2 className="text-lg font-black">💳 Contas solicitadas</h2><p className="text-xs text-stone-500">Impressão, pagamentos, divisão, desconto e fechamento das mesas.</p></div>
        <div className="flex items-center gap-2"><span className={`rounded-full px-3 py-2 text-xs font-black ${printerSettings?.connected?'bg-success/10 text-success':'bg-stone-100 text-stone-500'}`}>{printerSettings?.connected?'🖨️ Printer online':'Printer offline'}</span><span className="rounded-full bg-gold/15 px-3 py-2 text-xs font-black">{cashierQueue.length} aguardando</span></div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cashierSlice.map((session)=><article key={session._id} className="rounded-[22px] border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase text-gold">🧾 Conta solicitada</p><h3 className="text-xl font-black">{sessionTableName(session,data.tables)}</h3><p className="mt-1 text-xs text-stone-500">{session.peopleCount} pessoa(s){typeof session.waiterId==='object'&&session.waiterId?.name?` · ${session.waiterId.name}`:''}</p></div><strong className="text-xl">{money(session.balanceCents)}</strong></div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center"><Metric label="Total" value={money(session.totalCents)}/><Metric label="Pago" value={money(session.paidCents)}/><Metric label="Saldo" value={money(session.balanceCents)}/></div>
          <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={()=>void printBill(session)} className="rounded-xl border px-3 py-3 font-black">🖨️ Pré-conta</button><button type="button" onClick={()=>void openSessionDetail(session)} className="rounded-xl bg-ink px-3 py-3 font-black text-white">💰 Receber</button></div>
        </article>)}
        {!cashierSlice.length&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-stone-500 md:col-span-2 xl:col-span-3"><strong className="block text-ink">✅ Nenhuma conta aguardando</strong><span className="text-sm">Quando o garçom pedir a conta ela aparece aqui automaticamente.</span></div>}
      </div>
      <Pager page={visibleCashierPage} pages={cashierPages} setPage={setCashierPage}/>
    </>}

    {openTable&&<Modal title={`Abrir ${openTable.name}`} close={()=>setOpenTable(undefined)}>{message&&<InlineNotice compact message={message} onClose={()=>setMessage('')} />}<form onSubmit={openSession} className="grid gap-3"><div><label className="font-bold">Pessoas<input min="1" max="100" type="number" className="field" value={openForm.peopleCount} onChange={(e)=>setOpenForm({...openForm,peopleCount:e.target.value})}/></label><div className="mt-2 flex flex-wrap gap-2">{['1','2','4','6','8'].map((value)=><button key={value} type="button" onClick={()=>setOpenForm({...openForm,peopleCount:value})} className={`rounded-full px-3 py-1.5 text-xs font-black ${openForm.peopleCount===value?'bg-ink text-white':'border bg-white text-stone-600'}`}>{value} pessoa(s)</button>)}</div></div><label className="font-bold">Cliente (opcional)<input className="field" value={openForm.customerName} onChange={(e)=>setOpenForm({...openForm,customerName:e.target.value})} placeholder="Ex.: Mesa varanda"/></label>{waiters.length>0&&<label className="font-bold">Garçom<select className="field" value={openForm.waiterId} onChange={(e)=>setOpenForm({...openForm,waiterId:e.target.value})}><option value="">Eu / automático</option>{waiters.map((waiter)=><option key={waiter.id} value={waiter.id}>{waiter.name}</option>)}</select></label>}<button disabled={busy} className="rounded-xl bg-ink px-4 py-3 font-black text-white">Abrir mesa</button></form></Modal>}

    {detail&&<Modal wide title={addingProduct?addingProduct.name:tableTitle(detail)} close={closeDetailModal}>
      {message&&<InlineNotice compact message={message} onClose={()=>setMessage('')} />}
      {addingProduct ? <div className="mx-auto max-w-2xl space-y-4">
        <button type="button" onClick={()=>setAddingProduct(undefined)} className="rounded-xl border px-4 py-2 text-sm font-black">← Voltar para a comanda</button>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><label className="font-bold">Quantidade<input min="1" type="number" className="field" value={productQty} onChange={(e)=>setProductQty(Math.max(1,Number(e.target.value)))}/></label><div className="self-end rounded-xl bg-background px-4 py-3 text-right"><span className="text-xs text-stone-500">Valor unitário</span><strong className="block text-lg">{money(productPriceCents(addingProduct))}</strong></div></div>
        {(addingProduct.addonGroups??[]).map((group)=><fieldset key={group._id??group.name} className="rounded-xl border p-3"><legend className="px-1 font-black">{group.name}{group.required?' *':''}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{group.addons.map((addon)=><label key={addon._id??addon.name} className="flex items-center justify-between gap-3 rounded-lg bg-background p-2"><span><input className="mr-2" type="checkbox" checked={Boolean(group._id&&addon._id&&(addonSelections[group._id]??[]).includes(addon._id))} onChange={()=>toggleAddon(group,addon)}/>{addon.name}</span><b>{money(addon.priceCents??Math.round(addon.price*100))}</b></label>)}</div></fieldset>)}
        <label className="font-bold">Observação<textarea className="field min-h-20" value={productNote} onChange={(e)=>setProductNote(e.target.value)} placeholder="Ex.: sem cebola"/></label>
        <button type="button" onClick={addProductToCart} className="w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Adicionar à comanda</button>
      </div> : <>
        <div className="mb-3 flex flex-wrap gap-2"><DetailTab active={detailTab==='ORDER'} onClick={()=>setDetailTab('ORDER')}>🍽️ Pedido</DetailTab>{(hasBillableOrders||detail.status==='AWAITING_PAYMENT')&&<DetailTab active={detailTab==='ACCOUNT'} onClick={()=>setDetailTab('ACCOUNT')}>🧾 Conta</DetailTab>}<DetailTab active={detailTab==='MORE'} onClick={()=>setDetailTab('MORE')}>⚙️ Mais</DetailTab></div>

        {detailTab==='ORDER'&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(270px,.75fr)]">
          <main className="min-w-0 space-y-3">
            {detail.status==='OPEN'&&can('TABLES_ORDER')?<><div className="flex gap-2 overflow-x-auto pb-1">{orderedCategories.map((category)=><button type="button" key={category._id} onClick={()=>{setMenuCategory(category._id);setMenuPage(1)}} className={`shrink-0 rounded-full px-3 py-2 text-xs font-black ${(activeMenuCategory===category._id)?'bg-ink text-white':'border bg-white'}`}>{category.name}</button>)}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{menuSlice.map((product)=><button type="button" key={product._id} onClick={()=>beginProduct(product)} className="rounded-xl border bg-white p-3 text-left"><strong className="line-clamp-2 text-sm">{product.name}</strong><span className="mt-1 block text-xs text-stone-500">{money(productPriceCents(product))}</span></button>)}{!menuSlice.length&&<p className="col-span-full rounded-xl border border-dashed p-5 text-center text-sm text-stone-500">Nenhum produto nesta categoria.</p>}</div><Pager page={visibleMenuPage} pages={menuPages} setPage={setMenuPage} compact/>{cart.length>0&&<div className="rounded-xl bg-background p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><strong>{cart.reduce((sum,item)=>sum+item.quantity,0)} item(ns)</strong><p className="text-xs text-stone-500">Ao enviar, vai direto para produção e impressão automática.</p></div><button disabled={busy} type="button" onClick={()=>void sendOrder()} className="rounded-xl bg-ink px-4 py-3 font-black text-white">Enviar pedido</button></div><div className="mt-2 flex flex-wrap gap-2">{cart.map((item)=><button type="button" key={item.key} onClick={()=>setCart(cart.filter((current)=>current.key!==item.key))} className="rounded-full border bg-white px-2.5 py-1 text-xs font-bold">{item.quantity}x {item.product.name} ×</button>)}</div></div>}</>:<div className="rounded-xl bg-gold/10 p-4 text-sm font-bold">A conta já foi solicitada. Novos itens estão bloqueados.</div>}
          </main>
          <aside className="rounded-[22px] border border-stone-200/80 bg-background p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-stone-500">{detail.peopleCount} pessoa(s)</p><strong>{typeof detail.waiterId==='object'&&detail.waiterId?.name?detail.waiterId.name:'Sem garçom'}</strong></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${detail.status==='AWAITING_PAYMENT'?'bg-gold/20 text-ink':'bg-white text-stone-600'}`}>{detail.status==='AWAITING_PAYMENT'?'Conta solicitada':'Mesa aberta'}</span></div>
            <div className="mt-3 rounded-2xl bg-white p-3"><p className="text-[10px] font-black uppercase tracking-wide text-stone-400">Total atual</p><div className="mt-1 flex items-end justify-between gap-3"><strong className="text-2xl font-black text-ink">{money(detail.totalCents)}</strong><span className="text-xs font-bold text-stone-500">{billableOrders.length} pedido(s)</span></div></div>
            {!hasBillableOrders&&detail.status==='OPEN'&&<div className="mt-3 rounded-2xl border border-dashed border-stone-300 bg-white p-4 text-center"><span className="text-2xl">🍽️</span><strong className="mt-1 block text-sm">Comece pelo primeiro pedido</strong><p className="mt-1 text-xs text-stone-500">A opção de solicitar a conta só aparece depois que houver consumo na mesa.</p></div>}
            {hasBillableOrders&&detail.status==='OPEN'&&can('TABLES_REQUEST_BILL')&&<button type="button" disabled={busy} onClick={()=>{setDetailTab('ACCOUNT');void run(async()=>{const updated=await authenticatedRequest<Session>(`/table-service/sessions/${detail._id}/request-bill`,{method:'PATCH'});setDetail(updated)},'Conta enviada ao caixa.')}} className="mt-3 w-full rounded-2xl border border-gold/40 bg-gold/15 px-4 py-3 text-left transition hover:bg-gold/20"><div className="flex items-center justify-between gap-3"><div><span className="text-xs font-black uppercase tracking-wide text-stone-500">🧾 Fechamento</span><strong className="mt-0.5 block text-sm text-ink">Solicitar conta ao caixa</strong><small className="block text-[11px] text-stone-500">Bloqueia novos itens e avisa o caixa.</small></div><strong className="whitespace-nowrap text-sm text-ink">{money(detail.balanceCents)}</strong></div></button>}
            {detail.status==='AWAITING_PAYMENT'&&<div className="mt-3 rounded-2xl border border-gold/30 bg-gold/10 p-3"><strong className="text-sm">🧾 Conta enviada ao caixa</strong><p className="mt-1 text-xs text-stone-600">Aguarde o recebimento. Novos pedidos estão bloqueados.</p></div>}
            <div className="mt-4 space-y-2">{detail.orders.slice(-6).reverse().map((order)=><div key={order._id} className="rounded-xl bg-white p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs">{order.orderNumber}</b><span className="text-[10px] font-black text-stone-500">{statusLabel[order.status]??order.status}</span></div><p className="mt-1 text-xs text-stone-500">{order.items.reduce((sum,item)=>sum+item.quantity,0)} item(ns) · {money(order.totalCents)}</p>{order.status==='READY'&&can('TABLES_DELIVER')&&<button type="button" disabled={busy} onClick={()=>void markDelivered(order)} className="mt-2 w-full rounded-lg bg-success px-3 py-2 text-xs font-black text-white">✓ Entregue na mesa</button>}{can('TABLES_CANCEL')&&!['COMPLETED','REJECTED','CANCELLED'].includes(order.status)&&detail.paidCents===0&&<button type="button" disabled={busy} onClick={()=>void cancelTableOrder(order)} className="mt-1 w-full rounded-lg px-3 py-1.5 text-[11px] font-bold text-danger">Cancelar pedido</button>}</div>)}</div>
          </aside>
        </div>}

        {detailTab==='ACCOUNT'&&<div className="grid gap-3 lg:grid-cols-[.85fr_1.15fr_.9fr]">
          <section className="rounded-2xl bg-background p-4"><h3 className="font-black">🧾 Resumo da conta</h3><dl className="mt-3 space-y-2 text-sm"><Row label="Pedidos" value={money(detail.subtotalCents)}/><Row label={`Serviço (${detail.serviceFeePercent}%)`} value={money(detail.serviceFeeCents)}/><Row label="Desconto" value={`- ${money(detail.discountCents)}`}/><Row label="Pago" value={money(detail.paidCents)}/><div className="border-t pt-2"><Row strong label="Total" value={money(detail.totalCents)}/><Row strong label="Saldo pendente" value={money(detail.balanceCents)}/></div></dl><div className="mt-4 grid gap-2"><button type="button" disabled={busy} onClick={()=>void printBill(detail)} className="rounded-xl border bg-white px-4 py-3 font-black">Imprimir pré-conta</button>{detail.status==='OPEN'&&hasBillableOrders&&can('TABLES_REQUEST_BILL')&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{const updated=await authenticatedRequest<Session>(`/table-service/sessions/${detail._id}/request-bill`,{method:'PATCH'});setDetail(updated)},'Conta enviada ao caixa.')} className="rounded-xl bg-gold px-4 py-3 font-black text-ink">🧾 Solicitar conta ao caixa</button>}{detail.balanceCents===0&&detail.status==='AWAITING_PAYMENT'&&can('TABLES_CLOSE')&&<button disabled={busy} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/close`,{method:'PATCH'}),'Mesa fechada.').then(()=>{closeDetailModal()})} className="rounded-xl bg-success px-4 py-3 font-black text-white">Fechar mesa</button>}</div></section>

          <section className="rounded-2xl border p-4"><h3 className="font-black">💰 Recebimento</h3>{detail.status==='AWAITING_PAYMENT'&&can('TABLES_PAYMENT')?<form onSubmit={(e)=>{e.preventDefault();void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/payments`,{method:'POST',body:JSON.stringify({amountCents:Math.round(Number(payment.amount.replace(',','.'))*100),method:payment.method,note:payment.note||undefined})}),'Pagamento registrado.').then(()=>setPayment({...payment,amount:'',note:''}))}}><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={()=>setPaymentCents(detail.balanceCents)} className="rounded-lg border px-3 py-2 text-xs font-black">Saldo total</button>{detail.peopleCount>1&&<button type="button" onClick={()=>setPaymentCents(Math.min(detail.balanceCents,Math.ceil(detail.totalCents/detail.peopleCount)))} className="rounded-lg border px-3 py-2 text-xs font-black">Dividir por {detail.peopleCount}</button>}<button type="button" onClick={()=>setPaymentCents(Math.ceil(detail.balanceCents/2))} className="rounded-lg border px-3 py-2 text-xs font-black">50%</button><button type="button" onClick={()=>setPaymentCents(Math.ceil(detail.balanceCents/4))} className="rounded-lg border px-3 py-2 text-xs font-black">25%</button></div><label className="mt-3 block text-sm font-bold">Valor (R$)<input required min="0.01" step="0.01" className="field" value={payment.amount} onChange={(e)=>setPayment({...payment,amount:e.target.value})}/></label><label className="mt-2 block text-sm font-bold">Forma<select className="field" value={payment.method} onChange={(e)=>setPayment({...payment,method:e.target.value})}>{Object.entries(paymentLabel).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(paymentLabel).map(([value,label])=><button key={value} type="button" onClick={()=>setPayment({...payment,method:value})} className={`rounded-xl border px-3 py-2 text-xs font-black ${payment.method===value?'bg-ink text-white':'bg-white'}`}>{label}</button>)}</div><label className="mt-2 block text-sm font-bold">Observação<input className="field" value={payment.note} onChange={(e)=>setPayment({...payment,note:e.target.value})} placeholder="Ex.: parcial, cortesia, troco para 100"/></label><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={()=>setPayment((current)=>({...current,note:'Troco para 100'}))} className="rounded-lg border px-3 py-2 text-xs font-black">Troco para 100</button><button type="button" onClick={()=>setPayment((current)=>({...current,note:'Pagamento parcial'}))} className="rounded-lg border px-3 py-2 text-xs font-black">Parcial</button></div>{payment.method==='CASH'&&paymentAmountCents>0&&<div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><div className="flex items-center justify-between gap-3 text-sm"><span className="font-bold text-emerald-900">Troco</span><strong className="text-lg text-emerald-900">{money(cashChangeCents)}</strong></div><p className="mt-1 text-xs text-emerald-800">Recebido: {money(paymentAmountCents)} · Saldo: {money(detail.balanceCents)}</p></div>}<button disabled={busy} className="mt-3 w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Adicionar pagamento</button></form>:<p className="mt-3 rounded-xl bg-background p-3 text-sm text-stone-500">Solicite a conta para registrar o pagamento.</p>}
            {detail.status==='AWAITING_PAYMENT'&&detail.orders.some((order)=>!['REJECTED','CANCELLED'].includes(order.status))&&<div className="mt-4 border-t pt-3"><p className="text-xs font-black uppercase text-stone-400">Cobrar pedido específico</p><div className="mt-2 flex flex-wrap gap-2">{detail.orders.filter((order)=>!['REJECTED','CANCELLED'].includes(order.status)).slice(-6).map((order)=><button type="button" key={order._id} onClick={()=>{setPaymentCents(Math.min(order.totalCents,detail.balanceCents));setPayment((current)=>({...current,note:`Pedido ${order.orderNumber??''}`.trim()}));}} className="rounded-lg border px-3 py-2 text-xs font-black">{order.orderNumber} · {money(Math.min(order.totalCents,detail.balanceCents))}</button>)}</div></div>}
          </section>

          <div className="space-y-3">{detail.status==='AWAITING_PAYMENT'&&can('TABLES_DISCOUNT')&&<form onSubmit={(e)=>{e.preventDefault();void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/discount`,{method:'PATCH',body:JSON.stringify({discountCents:Math.round(Number(discount.replace(',','.'))*100)})}),'Desconto atualizado.')}} className="rounded-2xl border p-4"><h3 className="font-black">🏷️ Desconto</h3><div className="mt-2 flex gap-2"><input min="0" step="0.01" type="number" className="field !mt-0" placeholder="R$" value={discount} onChange={(e)=>setDiscount(e.target.value)}/><button disabled={busy} className="rounded-xl border px-4 font-black">Aplicar</button></div><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={()=>setDiscount((detail.serviceFeeCents/100).toFixed(2))} className="rounded-lg border px-3 py-2 text-xs font-black">Desconto serviço</button><button type="button" onClick={()=>setDiscount((detail.subtotalCents*0.1/100).toFixed(2))} className="rounded-lg border px-3 py-2 text-xs font-black">10% pedidos</button><button type="button" onClick={()=>setDiscount('0')} className="rounded-lg border px-3 py-2 text-xs font-black">Zerar</button></div></form>}{(detail.payments??[]).length>0&&<section className="rounded-2xl border p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-black">📋 Pagamentos</h3><span className="text-xs font-bold text-stone-400">{detail.payments?.length}</span></div><div className="mt-2 space-y-2">{(detail.payments??[]).slice(-4).reverse().map((item,index)=><div key={`${item.recordedAt}-${index}`} className="rounded-xl bg-background p-2 text-xs"><div className="flex items-start justify-between gap-2"><div><b>{paymentLabel[item.method]??item.method}</b>{item.note&&<p className="mt-0.5 text-stone-500">{item.note}</p>}</div><strong>{money(item.amountCents)}</strong></div>{item.method==='CASH'&&item.receivedCents!=null&&item.receivedCents>item.amountCents&&<div className="mt-2 flex items-center justify-between gap-3 border-t border-stone-200 pt-2 text-[11px] text-stone-600"><span>Recebido {money(item.receivedCents)}</span><b className="text-emerald-700">Troco {money(item.changeCents??Math.max(0,item.receivedCents-item.amountCents))}</b></div>}</div>)}</div></section>}</div>
        </div>}

        {detailTab==='MORE'&&<div className="grid gap-3 sm:grid-cols-2">{can('TABLES_TRANSFER')&&<section className="rounded-2xl border p-4"><h3 className="font-black">Mesa e garçom</h3>{waiters.length>0&&<div className="mt-3 flex gap-2"><select className="field !mt-0" value={waiterTo} onChange={(e)=>setWaiterTo(e.target.value)}><option value="">Trocar garçom…</option>{waiters.map((waiter)=><option key={waiter.id} value={waiter.id}>{waiter.name}</option>)}</select><button type="button" disabled={busy||!waiterTo} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/waiter`,{method:'PATCH',body:JSON.stringify({waiterId:waiterTo})}),'Garçom alterado.')} className="rounded-xl border px-3 font-bold">OK</button></div>}<div className="mt-2 flex gap-2"><select className="field !mt-0" value={transferTo} onChange={(e)=>setTransferTo(e.target.value)}><option value="">Transferir para…</option>{freeTables.map((table)=><option key={table._id} value={table._id}>{table.name}</option>)}</select><button type="button" disabled={busy||!transferTo} onClick={()=>void run(async()=>{await authenticatedRequest(`/table-service/sessions/${detail._id}/transfer`,{method:'POST',body:JSON.stringify({fromTableId:selectedTableId??(typeof detail.tableIds[0]==='string'?detail.tableIds[0]:detail.tableIds[0]?._id),toTableId:transferTo})});setSelectedTableId(transferTo);setTransferTo('')},'Mesa transferida.')} className="rounded-xl border px-3 font-bold">OK</button></div></section>}{can('TABLES_TRANSFER')&&freeTables.length>0&&<section className="rounded-2xl border p-4"><h3 className="font-black">Juntar mesa</h3><div className="mt-3 flex flex-wrap gap-2">{freeTables.slice(0,8).map((table)=><button type="button" disabled={busy} key={table._id} onClick={()=>void run(()=>authenticatedRequest(`/table-service/sessions/${detail._id}/merge`,{method:'POST',body:JSON.stringify({tableIds:[table._id]})}),`${table.name} adicionada.`)} className="rounded-lg border px-3 py-2 text-xs font-bold">+ {table.name}</button>)}</div></section>}{events.length>0&&<section className="rounded-2xl border p-4 sm:col-span-2"><div className="flex items-center justify-between"><h3 className="font-black">Histórico</h3><span className="text-xs font-bold text-stone-400">Auditoria</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{events.slice(0,8).map((event)=><div key={event._id} className="rounded-xl bg-background p-3 text-xs"><div className="flex justify-between gap-3"><b>{eventLabel[event.action]??event.action}</b><span className="text-stone-400">{new Date(event.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</span></div></div>)}</div></section>}</div>}
      </>}
    </Modal>}

    {cashAction&&<Modal wide={cashAction==='HISTORY'} title={cashAction==='OPEN'?'Abrir caixa':cashAction==='SUPPLY'?'Registrar suprimento':cashAction==='WITHDRAWAL'?'Registrar sangria':cashAction==='CLOSE'?'Fechar caixa':'Operações do caixa'} close={()=>{setCashAction(undefined);setCashForm({amount:'',note:''});setCashDeclared('');setMessage('')}}>
      {message&&<InlineNotice compact message={message} onClose={()=>setMessage('')} />}
      {cashAction==='HISTORY'?<div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><CashMetric icon="💵" label="Esperado" value={money(cash?.summary.expectedCashCents??0)} strong/><CashMetric icon="➕" label="Suprimentos" value={money(cash?.summary.supplyCents??0)}/><CashMetric icon="➖" label="Sangrias" value={money(cash?.summary.withdrawalCents??0)}/><CashMetric icon="📈" label="Vendas" value={money(cash?.summary.salesCents??0)}/></div>
        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">{(cash?.movements??[]).map((movement)=><div key={movement._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-background px-2.5 py-1 text-[10px] font-black">{cashMovementLabel(movement.type)}</span>{movement.method&&<span className="text-xs font-bold text-stone-500">{paymentLabel[movement.method]??movement.method}</span>}</div><p className="mt-1 text-xs text-stone-500">{new Date(movement.recordedAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}{movement.recordedBy&&typeof movement.recordedBy==='object'&&movement.recordedBy.name?` · ${movement.recordedBy.name}`:''}</p>{movement.note&&<p className="mt-1 text-xs text-stone-600">{movement.note}</p>}</div><div className="flex items-center gap-3"><strong className={movement.type==='WITHDRAWAL'?'text-danger':movement.type==='SUPPLY'?'text-success':'text-ink'}>{movement.type==='WITHDRAWAL'?'- ':''}{money(movement.amountCents)}</strong><button type="button" onClick={()=>void printCashMovement(movement)} className="grid h-9 w-9 place-items-center rounded-xl border bg-white" title="Imprimir comprovante">🖨️</button></div></div>)}{!(cash?.movements??[]).length&&<p className="rounded-2xl border border-dashed p-8 text-center text-sm text-stone-500">Nenhuma operação registrada neste caixa.</p>}</div>
      </div>:<form onSubmit={submitCashAction} className="mx-auto grid max-w-2xl gap-4">
        {cashAction==='CLOSE'?<><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><CashMetric icon="💵" label="Esperado" value={money(cash?.summary.expectedCashCents??0)} strong/><CashMetric icon="➕" label="Suprimentos" value={money(cash?.summary.supplyCents??0)}/><CashMetric icon="➖" label="Sangrias" value={money(cash?.summary.withdrawalCents??0)}/></div><label className="font-bold">Dinheiro contado na gaveta (R$)<input autoFocus min="0" step="0.01" type="number" className="field" value={cashDeclared} onChange={(e)=>setCashDeclared(e.target.value)}/></label>{cashDeclared&&<div className={`rounded-2xl p-3 text-sm font-bold ${parseMoneyToCents(cashDeclared)===(cash?.summary.expectedCashCents??0)?'bg-success/10 text-success':'bg-gold/15 text-ink'}`}>Diferença: {money(parseMoneyToCents(cashDeclared)-(cash?.summary.expectedCashCents??0))}</div>}</>:<label className="font-bold">{cashAction==='OPEN'?'Fundo inicial':'Valor'} (R$)<input autoFocus required min={cashAction==='OPEN'?'0':'0.01'} step="0.01" type="number" className="field" value={cashForm.amount} onChange={(e)=>setCashForm({...cashForm,amount:e.target.value})}/></label>}
        <label className="font-bold">Observação (opcional)<input className="field" value={cashForm.note} onChange={(e)=>setCashForm({...cashForm,note:e.target.value})} placeholder={cashAction==='SUPPLY'?'Ex.: troco adicional':cashAction==='WITHDRAWAL'?'Ex.: retirada para cofre':cashAction==='CLOSE'?'Ex.: conferido por Carlos':'Ex.: abertura do turno'}/></label>
        {cashAction==='OPEN'&&<div className="flex flex-wrap gap-2"><button type="button" onClick={()=>setCashForm({...cashForm,amount:'0'})} className="rounded-xl border px-3 py-2 text-xs font-black">Sem fundo</button>{['50','100','200'].map((value)=><button key={value} type="button" onClick={()=>setCashForm({...cashForm,amount:value})} className="rounded-xl border px-3 py-2 text-xs font-black">R$ {value}</button>)}</div>}
        {cashAction==='SUPPLY'&&<div className="flex flex-wrap gap-2">{['20','50','100','200'].map((value)=><button key={value} type="button" onClick={()=>setCashForm({...cashForm,amount:value})} className="rounded-xl border px-3 py-2 text-xs font-black">R$ {value}</button>)}</div>}
        {cashAction==='WITHDRAWAL'&&<div className="flex flex-wrap gap-2">{['50','100','200'].map((value)=><button key={value} type="button" onClick={()=>setCashForm({...cashForm,amount:value})} className="rounded-xl border px-3 py-2 text-xs font-black">R$ {value}</button>)}</div>}
        <button disabled={busy} className={`rounded-xl px-4 py-3 font-black text-white ${cashAction==='WITHDRAWAL'||cashAction==='CLOSE'?'bg-ink':'bg-success'}`}>{cashAction==='OPEN'?'Abrir caixa':cashAction==='SUPPLY'?'Confirmar suprimento':cashAction==='WITHDRAWAL'?'Confirmar sangria':'Conferir e fechar caixa'}</button>
      </form>}
    </Modal>}

    {ownerSetupOpen&&<Modal wide title="Configurar mesas" close={()=>setOwnerSetupOpen(false)}>{message&&<InlineNotice compact message={message} onClose={()=>setMessage('')} />}<div className="grid gap-4 lg:grid-cols-2"><form onSubmit={createTables} className="rounded-2xl border p-4"><h3 className="font-black">Criar várias mesas</h3><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-sm font-bold">De<input className="field" type="number" min="1" value={bulk.from} onChange={(e)=>setBulk({...bulk,from:e.target.value})}/></label><label className="text-sm font-bold">Até<input className="field" type="number" min="1" value={bulk.to} onChange={(e)=>setBulk({...bulk,to:e.target.value})}/></label><label className="text-sm font-bold">Prefixo<input className="field" value={bulk.prefix} onChange={(e)=>setBulk({...bulk,prefix:e.target.value})}/></label><label className="text-sm font-bold">Capacidade<input className="field" type="number" min="1" value={bulk.capacity} onChange={(e)=>setBulk({...bulk,capacity:e.target.value})}/></label></div><button disabled={busy} className="mt-3 w-full rounded-xl bg-ink px-4 py-3 font-black text-white">Criar mesas</button></form><form onSubmit={updateTable} className="rounded-2xl border p-4"><h3 className="font-black">Editar mesa</h3><div className="mt-3 grid gap-2"><select className="field !mt-0" value={manageTable.id} onChange={(e)=>{const table=data.tables.find((item)=>item._id===e.target.value);setManageTable(table?{id:table._id,name:table.name,capacity:String(table.capacity),active:table.active}:{id:'',name:'',capacity:'4',active:true})}}><option value="">Selecione…</option>{data.tables.map((table)=><option key={table._id} value={table._id}>{table.name}</option>)}</select><input disabled={!manageTable.id} className="field !mt-0" placeholder="Nome" value={manageTable.name} onChange={(e)=>setManageTable({...manageTable,name:e.target.value})}/><div className="grid grid-cols-2 gap-2"><input disabled={!manageTable.id} min="1" type="number" className="field !mt-0" value={manageTable.capacity} onChange={(e)=>setManageTable({...manageTable,capacity:e.target.value})}/><label className="flex items-center justify-between rounded-xl border px-3 font-bold">Ativa <input disabled={!manageTable.id} type="checkbox" checked={manageTable.active} onChange={(e)=>setManageTable({...manageTable,active:e.target.checked})}/></label></div></div><button disabled={busy||!manageTable.id} className="mt-3 w-full rounded-xl border px-4 py-3 font-black">Salvar mesa</button></form></div></Modal>}

    {printerSetupOpen&&<Modal wide title="Menu Flow Printer" close={()=>{setPrinterSetupOpen(false);setPrinterToken('')}}>{message&&<InlineNotice compact message={message} onClose={()=>setMessage('')} />}
      <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <section className="space-y-3">
          <div className={`rounded-2xl border p-4 ${printerSettings?.connected?'border-emerald-200 bg-emerald-50':'border-stone-200 bg-background'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-wide text-stone-400">Status</p><strong className="mt-1 block">{printerSettings?.connected?'🟢 Printer conectado':'⚪ Printer ainda não conectado'}</strong><p className="mt-1 text-xs text-stone-500">{printerSettings?.connected?`${printerSettings.printerDeviceName||'Computador'} online e recebendo a fila.`:'Instale/abra o agente no Windows e confira a chave.'}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black">{printerSettings?.printerPaperWidth??80} mm</span></div></div>
          <PrinterSwitch title="Ativar Menu Flow Printer" description="Habilita a fila de impressão deste estabelecimento." checked={Boolean(printerSettings?.printerEnabled)} onChange={(checked)=>void savePrinterSettings({printerEnabled:checked})}/>
          <label className="block rounded-2xl border bg-white p-4 font-bold">Largura do papel<select className="field" value={printerSettings?.printerPaperWidth??80} onChange={(e)=>void savePrinterSettings({printerPaperWidth:Number(e.target.value) as 58|80})}><option value="80">80 mm · mais espaço</option><option value="58">58 mm · compacta</option></select></label>
          <div className="rounded-2xl border bg-white p-4"><div className="flex items-center justify-between gap-2"><div><strong>Chave do computador</strong><p className="text-xs text-stone-500">{printerSettings?.printerTokenLast4?`Termina em ${printerSettings.printerTokenLast4}`:'Ainda não gerada'}</p></div><button type="button" onClick={()=>void generatePrinterToken()} className="rounded-xl bg-ink px-3 py-2 text-sm font-black text-white">Gerar chave</button></div>{printerToken&&<code className="mt-3 block break-all rounded-lg bg-background p-2 text-xs font-bold">{printerToken}</code>}</div>
        </section>
        <section className="rounded-[22px] border bg-white p-4"><div className="mb-3"><p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Automação</p><h3 className="text-lg font-black">O que imprimir automaticamente</h3><p className="mt-1 text-xs text-stone-500">Marque somente o que deve sair sem clicar em Imprimir. As impressões manuais continuam disponíveis.</p></div><div className="grid gap-2 sm:grid-cols-2">
          <PrinterSwitch title="🍳 Pedidos da cozinha" description="Imprime ao garçom enviar itens destinados à cozinha." checked={printerSettings?.printerAutoKitchen!==false} onChange={(checked)=>void savePrinterSettings({printerAutoKitchen:checked})}/>
          <PrinterSwitch title="🍹 Pedidos do bar" description="Imprime ao garçom enviar bebidas/itens destinados ao bar." checked={printerSettings?.printerAutoBar!==false} onChange={(checked)=>void savePrinterSettings({printerAutoBar:checked})}/>
          <PrinterSwitch title="🧾 Pré-conta" description="Imprime automaticamente quando o garçom solicitar a conta." checked={Boolean(printerSettings?.printerAutoBill)} onChange={(checked)=>void savePrinterSettings({printerAutoBill:checked})}/>
          <PrinterSwitch title="🔓 Abertura do caixa" description="Gera comprovante assim que o caixa for aberto." checked={Boolean(printerSettings?.printerAutoCashOpen)} onChange={(checked)=>void savePrinterSettings({printerAutoCashOpen:checked})}/>
          <PrinterSwitch title="➕ Suprimento" description="Imprime o comprovante de entrada de dinheiro." checked={Boolean(printerSettings?.printerAutoCashSupply)} onChange={(checked)=>void savePrinterSettings({printerAutoCashSupply:checked})}/>
          <PrinterSwitch title="➖ Sangria" description="Imprime o comprovante de retirada de dinheiro." checked={Boolean(printerSettings?.printerAutoCashWithdrawal)} onChange={(checked)=>void savePrinterSettings({printerAutoCashWithdrawal:checked})}/>
          <PrinterSwitch title="🔒 Fechamento do caixa" description="Imprime o resumo completo no fechamento do turno." checked={Boolean(printerSettings?.printerAutoCashClose)} onChange={(checked)=>void savePrinterSettings({printerAutoCashClose:checked})}/>
        </div><div className="mt-3 rounded-xl bg-background p-3 text-xs text-stone-600"><b>Uma impressora?</b> No Menu Flow Printer, use “mesma impressora para cozinha e bar”. O sistema continuará gerando duas comandas separadas, na ordem correta.</div>
        <div className="mt-4 border-t pt-4"><div className="flex items-center justify-between gap-2"><div><h4 className="text-sm font-black">Últimas impressões</h4><p className="text-[11px] text-stone-500">Use esta lista para identificar rapidamente fila, impressão concluída ou erro.</p></div><button type="button" onClick={()=>void refreshPrinter()} className="rounded-lg border px-2.5 py-1.5 text-xs font-black">Atualizar</button></div><div className="mt-2 space-y-2">{recentPrintJobs.slice(0,6).map((job,index)=><div key={job._id??`${job.createdAt}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-background p-2.5 text-xs"><div className="min-w-0"><b>{job.printerRole==='KITCHEN'?'🍳 Cozinha':job.printerRole==='BAR'?'🍹 Bar':'💳 Caixa'} · {printTypeLabel(job.type)}</b><p className="truncate text-[10px] text-stone-500">{job.error||new Date(job.createdAt).toLocaleString('pt-BR')}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${job.status==='PRINTED'?'bg-success/10 text-success':job.status==='FAILED'?'bg-danger/10 text-danger':job.status==='CLAIMED'?'bg-gold/20 text-ink':'bg-stone-100 text-stone-600'}`}>{job.status==='PRINTED'?'Impresso':job.status==='FAILED'?'Erro':job.status==='CLAIMED'?'Imprimindo':'Na fila'}</span></div>)}{!recentPrintJobs.length&&<p className="rounded-xl border border-dashed p-3 text-center text-xs text-stone-500">Nenhum trabalho de impressão registrado ainda.</p>}</div></div></section>
      </div>
    </Modal>}

  </section>;
}

function printTypeLabel(type:string) { return ({KITCHEN_ORDER:'Pedido',BAR_ORDER:'Pedido',PRE_BILL:'Pré-conta',CASH_OPENING:'Abertura',CASH_SUPPLY:'Suprimento',CASH_WITHDRAWAL:'Sangria',CASH_CLOSE:'Fechamento',CASH_SUMMARY:'Resumo'} as Record<string,string>)[type] || type.replaceAll('_',' '); }
function PrinterSwitch({title,description,checked,onChange}:{title:string;description:string;checked:boolean;onChange:(checked:boolean)=>void}) { return <label className={`flex min-h-[82px] items-center justify-between gap-3 rounded-2xl border p-3 transition ${checked?'border-primary/25 bg-primary/5':'bg-white'}`}><span className="min-w-0"><b className="block text-sm">{title}</b><small className="mt-0.5 block text-[11px] font-normal leading-4 text-stone-500">{description}</small></span><input type="checkbox" className="h-5 w-5 shrink-0 accent-current" checked={checked} onChange={(event)=>onChange(event.target.checked)}/></label>; }
function WorkspaceTab({active,onClick,label,badge,icon}:{active:boolean;onClick:()=>void;label:string;badge:string;icon:string}) { return <button type="button" onClick={onClick} className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-black transition ${active?'bg-white text-ink shadow':'bg-white/10 text-white hover:bg-white/15'}`}><span className="mr-2">{icon}</span>{label}<span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${active?'bg-ink/10':'bg-white/10'}`}>{badge}</span></button>; }
function InlineNotice({message,onClose,compact=false}:{message:string;onClose:()=>void;compact?:boolean}) { return <div className={`mb-3 flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 ${compact?'':'shadow-sm'}`}><span>{message}</span><button type="button" onClick={onClose} className="text-amber-700">×</button></div>; }
function sessionTableName(session: Session, tables: TableItem[]) { const ids=(session.tableIds??[]).map((table)=>typeof table==='string'?table:table._id); const names=ids.map((id)=>tables.find((table)=>table._id===id)?.name).filter(Boolean); return names.length?names.join(' + '):'Mesa'; }
function browserPrint(title:string, lines:string[], paper:58|80=80) { const popup=window.open('','_blank','width=440,height=720'); if(!popup) return; const escaped=lines.map((line)=>escapeHtml(line)).join('\n'); const body=paper===58?54:76; const font=paper===58?10:11; popup.document.write(`<html><head><title>${escapeHtml(title)}</title><style>@page{size:${paper}mm auto;margin:0}html,body{margin:0;padding:0;background:white}body{width:${paper}mm;box-sizing:border-box;padding:2mm;font-family:Consolas,"Courier New",monospace;font-size:${font}px;line-height:1.25}pre{width:${body}mm;margin:0;white-space:pre-wrap;overflow-wrap:normal;word-break:normal}</style></head><body><pre>${escaped}</pre><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}<\/script></body></html>`); popup.document.close(); }
function orderPrintLines(session:Session,order:Order,tables:TableItem[],sector:'KITCHEN'|'BAR'='KITCHEN') { const lines=[`PEDIDO - ${sector==='BAR'?'BAR':'COZINHA'}`,sessionTableName(session,tables),order.orderNumber??'', '------------------------------']; for(const item of order.items.filter((entry)=>(entry.productionSector??'KITCHEN')===sector)){lines.push(`${item.quantity}x ${item.productName}`); if(item.addons?.length) lines.push(` + ${item.addons.map((a)=>a.name).join(', ')}`); if(item.observation) lines.push(` OBS: ${item.observation}`);} lines.push('------------------------------','MENU FLOW'); return lines; }
function billPrintLines(session:Session,tables:TableItem[]) { const lines=['PRE-CONTA',sessionTableName(session,tables),'------------------------------']; for(const order of session.orders.filter((item)=>!['REJECTED','CANCELLED'].includes(item.status))) for(const item of order.items) lines.push(`${item.quantity}x ${item.productName}`); lines.push('------------------------------',`Subtotal: ${money(session.subtotalCents)}`,`Servico ${session.serviceFeePercent}%: ${money(session.serviceFeeCents)}`,`Desconto: -${money(session.discountCents)}`,`TOTAL: ${money(session.totalCents)}`,`Saldo: ${money(session.balanceCents)}`,'------------------------------','Esta nao e uma nota fiscal.','MENU FLOW'); return lines; }
function escapeHtml(value:string) { return String(value).replace(/[&<>"']/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]||char)); }
function productCategory(product: Product) { return typeof product.categoryId === 'string' ? product.categoryId : product.categoryId._id; }
function productPriceCents(product: Product) { return product.promotionalPriceCents ?? (product.promotionalPrice !== undefined ? Math.round(product.promotionalPrice * 100) : (product.priceCents ?? Math.round(product.price * 100))); }
function tableTitle(session: Session) { const tables = session.tableIds.map((table) => typeof table === 'string' ? '' : table.name).filter(Boolean); return tables.length ? tables.join(' + ') : 'Comanda da mesa'; }
function CashMetric({icon,label,value,strong=false}:{icon:string;label:string;value:string;strong?:boolean}) { return <div className={`rounded-2xl border p-3 ${strong?'border-primary/20 bg-primary/5':'border-stone-200 bg-background'}`}><div className="flex items-start justify-between gap-2"><span className="text-lg">{icon}</span><strong className={`text-sm ${strong?'text-primary':'text-ink'}`}>{value}</strong></div><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">{label}</p></div>; }
function cashMovementLabel(type: CashMovement['type']) { return ({OPENING:'🔓 Abertura',SUPPLY:'➕ Suprimento',WITHDRAWAL:'➖ Sangria',SALE:'💰 Venda'} as Record<string,string>)[type]??type; }
function cashPrintLines(cash: CashContext) { const targetShift=cash.shift??cash.lastClosed?.shift??null; const s=cash.shift?cash.summary:(cash.lastClosed?.summary??cash.summary); const lines=['MENU FLOW - CAIXA',targetShift?.status==='CLOSED'?'FECHAMENTO':'MOVIMENTO','------------------------------']; if(targetShift) lines.push(`Abertura: ${new Date(targetShift.openedAt).toLocaleString('pt-BR')}`); if(targetShift?.closedAt) lines.push(`Fechamento: ${new Date(targetShift.closedAt).toLocaleString('pt-BR')}`); lines.push(`Fundo: ${money(s.openingAmountCents)}`,`Suprimentos: ${money(s.supplyCents)}`,`Sangrias: -${money(s.withdrawalCents)}`,`Dinheiro: ${money(s.cashSalesCents)}`,`PIX: ${money(s.pixSalesCents)}`,`Credito: ${money(s.creditSalesCents)}`,`Debito: ${money(s.debitSalesCents)}`,'------------------------------',`DINHEIRO ESPERADO: ${money(s.expectedCashCents)}`); if(targetShift?.status==='CLOSED'){lines.push(`DINHEIRO INFORMADO: ${money(targetShift.declaredCashCents??s.expectedCashCents)}`,`DIFERENCA: ${money(targetShift.differenceCents??0)}`);} lines.push('------------------------------','MENU FLOW'); return lines; }
function cashMovementPrintLines(movement: CashMovement) { return ['MENU FLOW - CAIXA',cashMovementLabel(movement.type),new Date(movement.recordedAt).toLocaleString('pt-BR'),'------------------------------',movement.method?`Forma: ${paymentLabel[movement.method]??movement.method}`:'',`Valor: ${money(movement.amountCents)}`,movement.note?`Obs: ${movement.note}`:'','------------------------------','MENU FLOW'].filter(Boolean); }
function Metric({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border border-stone-200/70 bg-background p-3 shadow-sm"><span className="text-xs font-bold text-stone-500">{label}</span><strong className="mt-1 block text-lg">{value}</strong></div>; }
function Row({label,value,strong=false}:{label:string;value:string;strong?:boolean}) { return <div className={`flex items-center justify-between gap-4 ${strong?'font-black':''}`}><dt>{label}</dt><dd>{value}</dd></div>; }
function Modal({title,close,children,wide=false}:{title:string;close:()=>void;children:React.ReactNode;wide?:boolean}) { return <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/60 p-2 sm:p-5" onClick={close}><div className={`mx-auto my-3 rounded-[28px] border border-stone-200 bg-white p-4 shadow-2xl sm:p-5 ${wide?'max-w-6xl':'max-w-xl'}`} onClick={(event)=>event.stopPropagation()}><div className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-lg font-black sm:text-xl">{title}</h2><p className="text-xs text-stone-500">Tudo em uma única janela, sem abrir várias telas.</p></div><button type="button" onClick={(event)=>{event.preventDefault();event.stopPropagation();close();}} className="grid h-10 w-10 place-items-center rounded-full bg-stone-100 font-black">×</button></div>{children}</div></div>; }

function Pager({page,pages,setPage,compact=false}:{page:number;pages:number;setPage:(page:number)=>void;compact?:boolean}) {
  if (pages <= 1) return null;
  return <div className={`flex items-center justify-center gap-3 ${compact?'mt-1':'mt-3'}`}><button type="button" disabled={page<=1} onClick={()=>setPage(Math.max(1,page-1))} className="rounded-xl border bg-white px-4 py-2 text-xs font-black shadow-sm disabled:opacity-30">‹ Anterior</button><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-stone-500 shadow-sm">{page} / {pages}</span><button type="button" disabled={page>=pages} onClick={()=>setPage(Math.min(pages,page+1))} className="rounded-xl border bg-white px-4 py-2 text-xs font-black shadow-sm disabled:opacity-30">Próxima ›</button></div>;
}
function DetailTab({active,onClick,children}:{active:boolean;onClick:()=>void;children:React.ReactNode}) { return <button type="button" onClick={onClick} className={`rounded-2xl px-4 py-2 text-sm font-black transition ${active?'bg-ink text-white shadow':'border bg-white hover:bg-stone-50'}`}>{children}</button>; }
