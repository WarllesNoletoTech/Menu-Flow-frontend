"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEmpresa } from "../../../components/empresa/EmpresaContext";
import { apiUrl } from "../../../lib/api";
import { getSession } from "../../../lib/auth";
import { currentTuesdayMondayRange, type DateRange } from "../../../lib/date-range";
import { useOrderSocket } from "../../../lib/order-socket";
import { paymentMethodLabel } from "../../../lib/payment-methods";

type Report = {
  _id: string;
  reportNumber: string;
  periodStart: string;
  periodEnd: string;
  orderCount: number;
  serviceFeeTotalCents: number;
  includeMonthlyFee: boolean;
  monthlyFeeCents: number;
  totalCents: number;
  status: string;
  generatedAt: string;
  paidAt?: string;
  merchantViewedAt?: string;
};

type SalesReport = {
  periodStart: string;
  periodEnd: string;
  timezone: string;
  restaurantSnapshot?: { name?: string; tradeName?: string; cnpj?: string; city?: string; state?: string };
  salesMetrics: {
    completedOrders: number;
    orderTickets: number;
    tableSessions: number;
    grossRevenueCents: number;
    grossOrderVolumeCents: number;
    averageTicketCents: number;
    cancelledOrders: number;
    serviceFeeTotalCents: number;
  };
  details: {
    subtotalCents: number;
    deliveryFeesCents: number;
    serviceFeeTotalCents: number;
    discountsCents: number;
    products: Array<{ productName: string; quantity: number; productRevenueCents: number }>;
    categories: Array<{ categoryName: string; quantity: number; salesCents: number }>;
    paymentMethods: Array<{ method: string; transactions: number; salesCents: number }>;
    fulfillments: Array<{ fulfillment: string; orders: number; salesCents: number }>;
    daily: Array<{ date: string; orders: number; salesCents: number }>;
    hourly: Array<{ hour: number; orders: number; salesCents: number }>;
    waiters: Array<{ waiterId: string; waiterName: string; tables: number; orders: number; subtotalCents: number; serviceFeeCents: number; discountCents: number; salesCents: number }>;
    cancellations: Array<{ orderNumber: string; fulfillment: string; amountCents: number; reason: string; date: string }>;
    cash: {
      summary: {
        openingCents: number;
        suppliesCents: number;
        withdrawalsCents: number;
        salesCents: number;
        cashSalesCents: number;
        pixSalesCents: number;
        creditSalesCents: number;
        debitSalesCents: number;
        expectedCashCents: number;
        declaredCashCents: number;
        differenceCents: number;
      };
      shifts: Array<{ id: string; status: string; openedAt: string; openedByName: string; openingAmountCents: number; closedAt?: string; closedByName?: string; expectedCashCents: number; declaredCashCents: number; differenceCents: number }>;
      operations: Array<{ id: string; type: string; amountCents: number; method?: string; recordedAt: string; recordedByName: string; note?: string }>;
    };
  };
};

type Tab = "OVERVIEW" | "PRODUCTS" | "PAYMENTS" | "WAITERS" | "CASH" | "CANCELLATIONS";

const money = (value = 0) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);
const number = (value = 0) => new Intl.NumberFormat("pt-BR").format(value);

export default function Page() {
  const { request } = useEmpresa();
  const initial = currentTuesdayMondayRange();
  const [range, setRange] = useState<DateRange>(initial);
  const [draftRange, setDraftRange] = useState<DateRange>(initial);
  const [salesReport, setSalesReport] = useState<SalesReport>();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState("");
  const [periodError, setPeriodError] = useState("");
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [waiterFilter, setWaiterFilter] = useState("ALL");

  const load = useCallback(async (selectedRange: DateRange) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ start: selectedRange.start, end: selectedRange.end });
      const [sales, billingReports] = await Promise.all([
        request<SalesReport>(`/billing/me/sales-report?${params.toString()}`, { cache: "no-store" }),
        request<Report[]>("/billing/me/reports", { cache: "no-store" }).catch(() => []),
      ]);
      setSalesReport(sales);
      setReports(billingReports);
      void request<{ updated: number }>("/billing/me/reports/viewed", { method: "PATCH" }).catch(() => undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os relatórios.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => { void load(range); }, [load, range]);
  useEffect(() => {
    const focus = () => void load(range);
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [load, range]);

  useOrderSocket(useCallback((event, value) => {
    if (event === "updated" && (value as { status?: string })?.status === "COMPLETED") void load(range);
  }, [load, range]));

  const sales = salesReport?.salesMetrics;
  const details = salesReport?.details;
  const selectedWaiters = useMemo(() => details?.waiters.filter((item) => waiterFilter === "ALL" || item.waiterId === waiterFilter) ?? [], [details?.waiters, waiterFilter]);

  function applyPeriod(next = draftRange) {
    if (!next.start || !next.end) return setPeriodError("Informe a data inicial e a data final.");
    if (next.start > next.end) return setPeriodError("A data inicial não pode ser maior que a data final.");
    setPeriodError("");
    setDraftRange(next);
    setRange(next);
  }

  function useQuickRange(kind: "TODAY" | "YESTERDAY" | "WEEK" | "MONTH" | "TUE_MON") {
    const now = new Date();
    const today = iso(now);
    let next: DateRange;
    if (kind === "TODAY") next = { start: today, end: today };
    else if (kind === "YESTERDAY") { const d = new Date(now); d.setDate(d.getDate() - 1); const value = iso(d); next = { start: value, end: value }; }
    else if (kind === "WEEK") { const d = new Date(now); const day = d.getDay(); const offset = day === 0 ? -6 : 1 - day; d.setDate(d.getDate() + offset); next = { start: iso(d), end: today }; }
    else if (kind === "MONTH") next = { start: `${today.slice(0, 7)}-01`, end: today };
    else next = currentTuesdayMondayRange();
    applyPeriod(next);
  }

  function printReport() {
    document.body.classList.add("print-sales-report");
    const cleanup = () => document.body.classList.remove("print-sales-report");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  }

  async function downloadPdf() {
    setPdfLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ start: range.start, end: range.end });
      const response = await fetch(apiUrl(`/billing/me/sales-report/pdf?${params.toString()}`), { headers: { Authorization: `Bearer ${getSession()?.accessToken}` }, cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível gerar o PDF.");
      downloadBlob(await response.blob(), `relatorio-${range.start}-a-${range.end}.pdf`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível gerar o PDF.");
    } finally { setPdfLoading(false); }
  }

  function exportCsv() {
    if (!salesReport) return;
    const rows: string[][] = [["RELATÓRIO MENU FLOW"], ["Período", range.start, range.end], []];
    rows.push(["RESUMO"], ["Total vendido", cents(salesReport.salesMetrics.grossRevenueCents)], ["Vendas finalizadas", String(salesReport.salesMetrics.completedOrders)], ["Ticket médio", cents(salesReport.salesMetrics.averageTicketCents)], ["Taxa de serviço", cents(salesReport.salesMetrics.serviceFeeTotalCents)], ["Descontos", cents(salesReport.details.discountsCents)], []);
    rows.push(["PRODUTOS", "Quantidade", "Valor"], ...salesReport.details.products.map((item) => [item.productName, String(item.quantity), cents(item.productRevenueCents)]), []);
    rows.push(["FORMAS DE PAGAMENTO", "Transações", "Valor"], ...salesReport.details.paymentMethods.map((item) => [paymentMethodLabel(item.method), String(item.transactions), cents(item.salesCents)]), []);
    rows.push(["GARÇONS", "Mesas", "Pedidos", "Vendas", "Taxa de serviço"], ...salesReport.details.waiters.map((item) => [item.waiterName, String(item.tables), String(item.orders), cents(item.salesCents), cents(item.serviceFeeCents)]));
    const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
    downloadBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }), `relatorio-${range.start}-a-${range.end}.csv`);
  }

  return (
    <section className="sales-page mx-auto max-w-7xl space-y-5">
      <style jsx global>{`
        @media print {
          body.print-sales-report aside, body.print-sales-report header.sticky, body.print-sales-report .report-no-print { display:none!important; }
          body.print-sales-report main { padding:0!important; }
          body.print-sales-report .sales-page > * { display:none!important; }
          body.print-sales-report .sales-page > .report-print-area { display:block!important; padding:12mm!important; }
          body.print-sales-report .report-print-area * { box-shadow:none!important; }
        }
      `}</style>

      <header className="overflow-hidden rounded-[28px] bg-gradient-to-r from-ink via-[#741f24] to-[#92282d] p-5 text-white shadow-xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-lime">Gestão financeira</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Faturamento e relatórios</h1><p className="mt-2 max-w-2xl text-sm text-white/75">Vendas, produtos, pagamentos, taxa de serviço dos garçons, caixa e auditoria em um único lugar.</p></div>
          <div className="report-no-print flex flex-wrap gap-2"><button type="button" onClick={printReport} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black">🖨️ Imprimir</button><button type="button" disabled={pdfLoading} onClick={() => void downloadPdf()} className="rounded-xl bg-white px-4 py-2 text-sm font-black text-ink disabled:opacity-50">{pdfLoading ? "Gerando…" : "📄 PDF"}</button><button type="button" onClick={exportCsv} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-black">📊 CSV</button></div>
        </div>
        {sales && <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><HeroMetric icon="💰" label="Total vendido" value={money(sales.grossRevenueCents)} /><HeroMetric icon="🧾" label="Vendas finalizadas" value={number(sales.completedOrders)} /><HeroMetric icon="📈" label="Ticket médio" value={money(sales.averageTicketCents)} /><HeroMetric icon="🤵" label="Taxa de serviço" value={money(sales.serviceFeeTotalCents)} /></div>}
      </header>

      <div className="report-no-print rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2"><QuickButton onClick={() => useQuickRange("TODAY")}>Hoje</QuickButton><QuickButton onClick={() => useQuickRange("YESTERDAY")}>Ontem</QuickButton><QuickButton onClick={() => useQuickRange("WEEK")}>Esta semana</QuickButton><QuickButton onClick={() => useQuickRange("MONTH")}>Este mês</QuickButton><QuickButton onClick={() => useQuickRange("TUE_MON")}>Terça a segunda</QuickButton></div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-sm font-bold">Data inicial<input type="date" className="field !mt-2" value={draftRange.start} onChange={(event) => setDraftRange({ ...draftRange, start: event.target.value })} /></label><label className="text-sm font-bold">Data final<input type="date" className="field !mt-2" value={draftRange.end} onChange={(event) => setDraftRange({ ...draftRange, end: event.target.value })} /></label><button type="button" onClick={() => applyPeriod()} className="rounded-xl bg-ink px-5 py-3 font-black text-white">Atualizar relatório</button></div>
        {periodError && <p className="mt-2 text-sm font-bold text-danger">{periodError}</p>}
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">{error}</div>}
      {loading && <div className="rounded-2xl border bg-white p-8 text-center font-bold text-stone-500">Atualizando relatórios…</div>}

      {salesReport && details && sales && <div className="report-print-area">
        <div className="report-no-print mb-4 flex gap-2 overflow-x-auto pb-1"><TabButton active={tab === "OVERVIEW"} onClick={() => setTab("OVERVIEW")} icon="📊">Visão geral</TabButton><TabButton active={tab === "PRODUCTS"} onClick={() => setTab("PRODUCTS")} icon="🍽️">Produtos</TabButton><TabButton active={tab === "PAYMENTS"} onClick={() => setTab("PAYMENTS")} icon="💳">Pagamentos</TabButton><TabButton active={tab === "WAITERS"} onClick={() => setTab("WAITERS")} icon="🤵">Garçons</TabButton><TabButton active={tab === "CASH"} onClick={() => setTab("CASH")} icon="💵">Caixa</TabButton><TabButton active={tab === "CANCELLATIONS"} onClick={() => setTab("CANCELLATIONS")} icon="🚫">Cancelamentos</TabButton></div>

        <div className="mb-4 rounded-2xl border bg-white px-4 py-3 text-sm text-stone-600"><b className="text-ink">Período:</b> {dateInput(range.start)} a {dateInput(range.end)} <span className="mx-2">•</span> Os valores de mesa incluem a taxa de serviço do estabelecimento e descontos aplicados.</div>

        {(tab === "OVERVIEW" || !isScreen()) && <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon="💰" label="Total vendido" value={money(sales.grossRevenueCents)} /><MetricCard icon="🧾" label="Pedidos internos" value={number(sales.orderTickets)} /><MetricCard icon="🪑" label="Mesas fechadas" value={number(sales.tableSessions)} /><MetricCard icon="🚚" label="Taxas de entrega" value={money(details.deliveryFeesCents)} /><MetricCard icon="🏷️" label="Descontos" value={money(details.discountsCents)} /><MetricCard icon="🤵" label="Taxa de serviço" value={money(details.serviceFeeTotalCents)} /><MetricCard icon="❌" label="Cancelamentos" value={number(sales.cancelledOrders)} /><MetricCard icon="📈" label="Ticket médio" value={money(sales.averageTicketCents)} /></div>
          <div className="grid gap-4 lg:grid-cols-2"><ReportTable title="Canais de venda" headers={["Canal", "Vendas", "Valor"]} rows={details.fulfillments.map((item) => [fulfillmentLabel(item.fulfillment), number(item.orders), money(item.salesCents)])} /><ReportTable title="Categorias" headers={["Categoria", "Itens", "Valor"]} rows={details.categories.map((item) => [item.categoryName, number(item.quantity), money(item.salesCents)])} /></div>
          <div className="grid gap-4 lg:grid-cols-2"><ReportTable title="Vendas por dia" headers={["Data", "Vendas", "Valor"]} rows={details.daily.map((item) => [dateInput(item.date), number(item.orders), money(item.salesCents)])} /><ReportTable title="Vendas por horário" headers={["Horário", "Vendas", "Valor"]} rows={details.hourly.map((item) => [`${String(item.hour).padStart(2, "0")}:00`, number(item.orders), money(item.salesCents)])} /></div>
        </section>}

        {tab === "PRODUCTS" && <section className="space-y-4"><SectionTitle icon="🍽️" title="Produtos vendidos" subtitle="Quantidade e faturamento gerado por produto no período." /><ReportTable title="Produtos" headers={["Produto", "Quantidade", "Valor"]} rows={details.products.map((item) => [item.productName, number(item.quantity), money(item.productRevenueCents)])} /><ReportTable title="Categorias" headers={["Categoria", "Itens", "Valor"]} rows={details.categories.map((item) => [item.categoryName, number(item.quantity), money(item.salesCents)])} /></section>}

        {tab === "PAYMENTS" && <section className="space-y-4"><SectionTitle icon="💳" title="Formas de pagamento" subtitle="Pagamentos mistos de mesas são separados corretamente por forma." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{details.paymentMethods.map((item) => <MetricCard key={item.method} icon={paymentIcon(item.method)} label={paymentMethodLabel(item.method)} value={money(item.salesCents)} note={`${number(item.transactions)} transação(ões)`} />)}</div><ReportTable title="Detalhamento" headers={["Forma", "Transações", "Valor"]} rows={details.paymentMethods.map((item) => [paymentMethodLabel(item.method), number(item.transactions), money(item.salesCents)])} /></section>}

        {tab === "WAITERS" && <section className="space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><SectionTitle icon="🤵" title="Garçons e taxa de serviço" subtitle="Veja o geral ou filtre um garçom individualmente." /><label className="report-no-print text-sm font-bold">Garçom<select className="field !mt-1 min-w-56" value={waiterFilter} onChange={(event) => setWaiterFilter(event.target.value)}><option value="ALL">Todos os garçons</option>{details.waiters.map((item) => <option key={item.waiterId} value={item.waiterId}>{item.waiterName}</option>)}</select></label></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon="🤵" label="Taxa de serviço" value={money(selectedWaiters.reduce((sum, item) => sum + item.serviceFeeCents, 0))} /><MetricCard icon="🪑" label="Mesas atendidas" value={number(selectedWaiters.reduce((sum, item) => sum + item.tables, 0))} /><MetricCard icon="🧾" label="Pedidos lançados" value={number(selectedWaiters.reduce((sum, item) => sum + item.orders, 0))} /><MetricCard icon="💰" label="Vendas das mesas" value={money(selectedWaiters.reduce((sum, item) => sum + item.salesCents, 0))} /></div><ReportTable title="Relatório por garçom" headers={["Garçom", "Mesas", "Pedidos", "Vendas", "Taxa de serviço", "Descontos"]} rows={selectedWaiters.map((item) => [item.waiterName, number(item.tables), number(item.orders), money(item.salesCents), money(item.serviceFeeCents), money(item.discountCents)])} /></section>}

        {tab === "CASH" && <section className="space-y-4"><SectionTitle icon="💵" title="Relatório de caixa" subtitle="Vendas, suprimentos, sangrias e conferência dos turnos." /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard icon="💵" label="Vendas em dinheiro" value={money(details.cash.summary.cashSalesCents)} /><MetricCard icon="➕" label="Suprimentos" value={money(details.cash.summary.suppliesCents)} /><MetricCard icon="➖" label="Sangrias" value={money(details.cash.summary.withdrawalsCents)} /><MetricCard icon="⚖️" label="Diferença em fechamentos" value={money(details.cash.summary.differenceCents)} /></div><ReportTable title="Turnos de caixa" headers={["Abertura", "Operador", "Status", "Fundo", "Esperado", "Informado", "Diferença"]} rows={details.cash.shifts.map((item) => [dateTime(item.openedAt), item.openedByName, item.status === "OPEN" ? "Aberto" : "Fechado", money(item.openingAmountCents), money(item.expectedCashCents), money(item.declaredCashCents), money(item.differenceCents)])} /><ReportTable title="Operações do caixa" headers={["Data", "Operação", "Forma", "Operador", "Valor", "Observação"]} rows={details.cash.operations.map((item) => [dateTime(item.recordedAt), cashOperationLabel(item.type), item.method ? paymentMethodLabel(item.method) : "—", item.recordedByName, money(item.amountCents), item.note || "—"])} /></section>}

        {tab === "CANCELLATIONS" && <section className="space-y-4"><SectionTitle icon="🚫" title="Cancelamentos e recusas" subtitle="Auditoria dos pedidos cancelados no período." /><ReportTable title="Pedidos cancelados" headers={["Pedido", "Data", "Canal", "Valor", "Motivo"]} rows={details.cancellations.map((item) => [item.orderNumber, dateTime(item.date), fulfillmentLabel(item.fulfillment), money(item.amountCents), item.reason])} /></section>}
      </div>}

      {reports.some((item) => item.monthlyFeeCents > 0) && <section className="report-no-print rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-black">📄 Documentos de cobrança da plataforma</h2><p className="mt-1 text-sm text-stone-500">Histórico de mensalidades emitidas pelo Menu Flow.</p><div className="mt-3 grid gap-3">{reports.filter((item) => item.monthlyFeeCents > 0).slice(0, 6).map((item) => <div key={item._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background p-3"><div><b>{item.reportNumber}</b><p className="text-xs text-stone-500">{dateInput(item.periodStart.slice(0, 10))} a {dateInput(item.periodEnd.slice(0, 10))}</p></div><div className="text-right"><b>{money(item.monthlyFeeCents)}</b><p className="text-xs text-stone-500">{item.status === "PAID" ? "Pago" : "Emitido"}</p></div></div>)}</div></section>}
    </section>
  );
}

function HeroMetric({ icon, label, value }: { icon: string; label: string; value: string }) { return <div className="rounded-2xl bg-white/10 p-3 backdrop-blur"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-white/65">{label}</p><strong className="mt-1 block text-xl">{value}</strong></div><span className="text-xl">{icon}</span></div></div>; }
function MetricCard({ icon, label, value, note }: { icon: string; label: string; value: string; note?: string }) { return <article className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold text-stone-500">{label}</p><strong className="mt-2 block text-xl text-ink">{value}</strong>{note && <p className="mt-1 text-xs text-stone-400">{note}</p>}</div><span className="text-xl">{icon}</span></div></article>; }
function QuickButton({ children, onClick }: { children: ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className="rounded-full border bg-white px-3 py-2 text-xs font-black text-stone-700 hover:bg-stone-50">{children}</button>; }
function TabButton({ active, icon, children, onClick }: { active: boolean; icon: string; children: ReactNode; onClick: () => void }) { return <button type="button" onClick={onClick} className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-black ${active ? "bg-ink text-white shadow" : "border bg-white text-stone-600"}`}><span className="mr-2">{icon}</span>{children}</button>; }
function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) { return <div><h2 className="text-xl font-black"><span className="mr-2">{icon}</span>{title}</h2><p className="mt-1 text-sm text-stone-500">{subtitle}</p></div>; }
function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) { return <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm"><div className="border-b px-4 py-3"><h3 className="font-black">{title}</h3></div><table className="w-full min-w-[600px] text-left text-sm"><thead className="bg-background"><tr>{headers.map((item, index) => <th key={`${item}-${index}`} className="p-3 font-black">{item}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-t" key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td key={cellIndex} className={`p-3 ${cellIndex === 0 ? "font-bold" : ""}`}>{cell}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length} className="p-6 text-center text-stone-500">Sem dados no período.</td></tr>}</tbody></table></div>; }
function paymentIcon(method: string) { return method === "PIX" ? "📱" : method === "CASH" ? "💵" : method === "CREDIT_CARD" ? "💳" : method === "DEBIT_CARD" ? "💳" : "💰"; }
function fulfillmentLabel(value: string) { return value === "DELIVERY" ? "Entrega" : value === "TABLE" ? "Mesa / salão" : value === "PICKUP" ? "Retirada" : value; }
function cashOperationLabel(value: string) { return value === "OPENING" ? "Abertura" : value === "SUPPLY" ? "Suprimento" : value === "WITHDRAWAL" ? "Sangria" : value === "SALE" ? "Venda" : value; }
function dateInput(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value); return match ? `${match[3]}/${match[2]}/${match[1]}` : value; }
function dateTime(value?: string) { if (!value) return "—"; return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }); }
function iso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function cents(value: number) { return (value / 100).toFixed(2).replace(".", ","); }
function csvCell(value: string) { const escaped = String(value).replace(/"/g, '""'); return /[;"\n]/.test(escaped) ? `"${escaped}"` : escaped; }
function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); }
function isScreen() { return typeof window !== "undefined" && window.matchMedia("screen").matches; }
