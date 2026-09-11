"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
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
  paymentSnapshot?: { pixReceiverName?: string; pixKey?: string };
};

type Sales = {
  completedOrders: number;
  grossSalesCents?: number;
  grossRevenueCents: number;
  menuFlowServiceFeesCollectedCents: number;
  grossOrderVolumeCents: number;
  averageTicketCents: number;
  cancelledOrders: number;
};

type SalesReport = {
  periodStart: string;
  periodEnd: string;
  timezone: string;
  restaurantSnapshot?: { name?: string; tradeName?: string; cnpj?: string; city?: string; state?: string };
  salesMetrics: Sales;
  details: {
    subtotalCents: number;
    deliveryFeesCents: number;
    discountsCents: number;
    products: Array<{ productName: string; quantity: number; productRevenueCents: number }>;
    paymentMethods: Array<{ method: string; orders: number; salesCents: number }>;
    fulfillments: Array<{ fulfillment: string; orders: number; salesCents: number }>;
    daily: Array<{ date: string; orders: number; salesCents: number }>;
  };
};

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value / 100);

const labels: Record<string, string> = {
  DRAFT: "Rascunho",
  GENERATED: "Gerado",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};

const feeHelp =
  "Este valor corresponde às taxas de serviço Menu Flow cobradas dos clientes nos pedidos concluídos deste relatório.";

export default function Page() {
  const { request } = useEmpresa();
  const [range, setRange] = useState<DateRange>(() => currentTuesdayMondayRange());
  const [draftRange, setDraftRange] = useState<DateRange>(() => currentTuesdayMondayRange());
  const [periodError, setPeriodError] = useState("");
  const [salesReport, setSalesReport] = useState<SalesReport>();
  const [reports, setReports] = useState<Report[]>([]);
  const [salesError, setSalesError] = useState("");
  const [reportsError, setReportsError] = useState("");
  const [salesLoading, setSalesLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  const loadSales = useCallback(async (selectedRange: DateRange) => {
    setSalesLoading(true);
    setSalesError("");
    try {
      const params = new URLSearchParams({ start: selectedRange.start, end: selectedRange.end });
      setSalesReport(await request<SalesReport>(`/billing/me/sales-report?${params.toString()}`, { cache: "no-store" }));
    } catch (error) {
      setSalesError(error instanceof Error ? error.message : "Não foi possível carregar o relatório de faturamento.");
    } finally {
      setSalesLoading(false);
    }
  }, [request]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError("");
    try {
      const result = await request<Report[]>("/billing/me/reports", { cache: "no-store" });
      setReports(result);
      try {
        const viewed = await request<{ updated: number }>("/billing/me/reports/viewed", { method: "PATCH" });
        if (viewed.updated > 0) window.dispatchEvent(new CustomEvent("menu-flow:billing-reports-viewed"));
      } catch {
        // O relatório continua visível mesmo se a confirmação de leitura falhar temporariamente.
      }
    } catch (error) {
      setReportsError(error instanceof Error ? error.message : "Não foi possível carregar as cobranças.");
    } finally {
      setReportsLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void loadSales(range);
    void loadReports();
    const focus = () => {
      void loadSales(range);
      void loadReports();
    };
    const interval = window.setInterval(() => void loadReports(), 60_000);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("focus", focus);
      window.clearInterval(interval);
    };
  }, [loadReports, loadSales, range]);

  useOrderSocket(
    useCallback(
      (event, value) => {
        if (event === "updated" && (value as { status?: string })?.status === "COMPLETED") void loadSales(range);
      },
      [loadSales, range],
    ),
  );

  function applyPeriod() {
    if (!draftRange.start || !draftRange.end) {
      setPeriodError("Informe a data inicial e a data final.");
      return;
    }
    if (draftRange.start > draftRange.end) {
      setPeriodError("A data inicial não pode ser maior que a data final.");
      return;
    }
    setPeriodError("");
    setRange({ ...draftRange });
  }

  function printSalesReport() {
    document.body.classList.add("print-sales-report");
    const cleanup = () => document.body.classList.remove("print-sales-report");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  }

  async function downloadSalesPdf() {
    setPdfLoading(true);
    setSalesError("");
    try {
      const params = new URLSearchParams({ start: range.start, end: range.end });
      const response = await fetch(apiUrl(`/billing/me/sales-report/pdf?${params.toString()}`), {
        headers: { Authorization: `Bearer ${getSession()?.accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Não foi possível gerar o PDF do faturamento.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `faturamento-${range.start}-a-${range.end}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setSalesError(error instanceof Error ? error.message : "Não foi possível gerar o PDF do faturamento.");
    } finally {
      setPdfLoading(false);
    }
  }

  async function download(report: Report) {
    try {
      setReportsError("");
      const response = await fetch(apiUrl(`/billing/me/reports/${report._id}/pdf`), {
        headers: { Authorization: `Bearer ${getSession()?.accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Não foi possível baixar o PDF.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${report.reportNumber}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setReportsError(error instanceof Error ? error.message : "Não foi possível baixar o PDF.");
    }
  }

  const badge = (status: string) =>
    status === "PAID"
      ? "bg-green-100 text-green-800"
      : status === "GENERATED"
        ? "bg-amber-100 text-amber-900"
        : status === "CANCELLED"
          ? "bg-red-100 text-red-800"
          : "bg-stone-200 text-stone-700";

  const sales = salesReport?.salesMetrics;
  const details = salesReport?.details;

  return (
    <section className="sales-page mx-auto max-w-6xl">
      <style jsx global>{`
        @media print {
          body.print-sales-report aside,
          body.print-sales-report header.sticky {
            display: none !important;
          }
          body.print-sales-report main {
            padding: 0 !important;
          }
          body.print-sales-report .sales-page > * {
            display: none !important;
          }
          body.print-sales-report .sales-page > .report-print-area {
            display: block !important;
          }
          body.print-sales-report .report-print-area {
            width: 100% !important;
            max-width: none !important;
            padding: 18mm 16mm !important;
            background: white !important;
          }
          body.print-sales-report .report-print-area article,
          body.print-sales-report .report-print-area table,
          body.print-sales-report .report-print-area .shadow-sm {
            box-shadow: none !important;
          }
          body.print-sales-report .sales-actions {
            display: none !important;
          }
        }
      `}</style>

      <h1 className="text-3xl font-black">Faturamento</h1>
      <p className="mt-2 text-stone-500">Consulte as vendas por período e veja um relatório detalhado dos produtos vendidos.</p>

      <div className="mt-6 rounded-2xl border bg-surface p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-bold">Data inicial
            <input type="date" className="field !mt-2" value={draftRange.start} onChange={(event) => setDraftRange({ ...draftRange, start: event.target.value })} />
          </label>
          <label className="text-sm font-bold">Data final
            <input type="date" className="field !mt-2" value={draftRange.end} onChange={(event) => setDraftRange({ ...draftRange, end: event.target.value })} />
          </label>
          <button type="button" onClick={applyPeriod} className="h-fit rounded-xl bg-ink px-5 py-3 font-black text-white">ATUALIZAR RELATÓRIO</button>
        </div>
        <p className="mt-2 text-xs text-stone-500">Por padrão, o período vem preenchido da terça-feira mais recente até a próxima segunda-feira. Você pode escolher qualquer intervalo.</p>
        {periodError && <p role="alert" className="mt-2 text-sm font-bold text-danger">{periodError}</p>}
      </div>

      {salesLoading && <p className="mt-5">Carregando faturamento do período…</p>}
      {salesError && <p role="alert" className="mt-5 rounded-xl bg-danger/10 p-4 text-danger">{salesError}</p>}

      <div className="report-print-area">
        <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Resumo de vendas</h2>
            <p className="mt-1 text-sm text-stone-500">Período: {dateInput(range.start)} a {dateInput(range.end)}</p>
          </div>
          {salesReport && (
            <div className="sales-actions flex flex-wrap gap-2">
              <button type="button" onClick={printSalesReport} className="rounded-xl border px-4 py-2 text-sm font-black">IMPRIMIR</button>
              <button type="button" disabled={pdfLoading} onClick={() => void downloadSalesPdf()} className="rounded-xl bg-ink px-4 py-2 text-sm font-black text-white disabled:opacity-50">
                {pdfLoading ? "GERANDO PDF…" : "GERAR PDF"}
              </button>
            </div>
          )}
        </div>

        {sales && (
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Pedidos concluídos" value={sales.completedOrders} />
            <Card label="Faturamento de vendas" value={money(sales.grossRevenueCents)} />
            <Card label="Taxas Menu Flow a repassar" value={money(sales.menuFlowServiceFeesCollectedCents)} />
            <Card label="Total transacionado" value={money(sales.grossOrderVolumeCents)} />
            <Card label="Ticket médio" value={money(sales.averageTicketCents)} />
            <Card label="Pedidos cancelados" value={sales.cancelledOrders} />
            {details && <Card label="Taxas de entrega" value={money(details.deliveryFeesCents)} />}
            {details && <Card label="Descontos concedidos" value={money(details.discountsCents)} />}
          </div>
        )}

        {details && (
          <section className="mt-8">
            <h2 className="text-xl font-black">Relatório detalhado</h2>
            <p className="mt-1 text-stone-500">Produtos, formas de pagamento, tipo de atendimento e vendas por dia dentro do período selecionado.</p>

            <div className="mt-4 overflow-x-auto rounded-2xl bg-surface shadow-sm">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead><tr><th className="p-4">Produto</th><th className="p-4 text-right">Quantidade vendida</th><th className="p-4 text-right">Valor dos produtos</th></tr></thead>
                <tbody>
                  {details.products.map((product, index) => (
                    <tr className="border-t" key={`${product.productName}-${index}`}>
                      <td className="p-4 font-bold">{product.productName}</td>
                      <td className="p-4 text-right">{product.quantity}</td>
                      <td className="p-4 text-right font-bold">{money(product.productRevenueCents)}</td>
                    </tr>
                  ))}
                  {!details.products.length && <tr><td colSpan={3} className="border-t p-6 text-center text-stone-500">Nenhum produto vendido no período.</td></tr>}
                </tbody>
                <tfoot><tr className="border-t"><td className="p-4 font-black" colSpan={2}>Subtotal dos produtos</td><td className="p-4 text-right font-black">{money(details.subtotalCents)}</td></tr></tfoot>
              </table>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <DetailTable title="Por forma de pagamento" headers={["Forma", "Pedidos", "Faturamento"]} rows={details.paymentMethods.map((item) => [paymentMethodLabel(item.method), String(item.orders), money(item.salesCents)])} />
              <DetailTable title="Entrega e retirada" headers={["Tipo", "Pedidos", "Faturamento"]} rows={details.fulfillments.map((item) => [item.fulfillment === "DELIVERY" ? "Entrega" : "Retirada", String(item.orders), money(item.salesCents)])} />
            </div>

            <div className="mt-4">
              <DetailTable title="Vendas por dia" headers={["Data", "Pedidos", "Faturamento"]} rows={details.daily.map((item) => [dateInput(item.date), String(item.orders), money(item.salesCents)])} />
            </div>
          </section>
        )}
      </div>

      <h2 className="mt-10 text-xl font-black">Cobranças Menu Flow</h2>
      <p className="mt-1 text-stone-500">Relatórios de serviço emitidos pela plataforma. Quando o administrador gerar um novo relatório, a aba Faturamento mostrará um aviso até você abrir esta página.</p>
      {reportsError && <p role="alert" className="mt-3 bg-danger/10 p-4 text-danger">{reportsError}</p>}
      <div className="mt-3 grid gap-4">
        {reports.map((report) => (
          <article className="rounded-2xl bg-surface p-5 shadow-sm" key={report._id}>
            <div className="flex flex-wrap justify-between gap-3">
              <div className="flex items-start gap-2">
                <div><p className="text-sm text-stone-500">Relatório</p><h3 className="font-black">{report.reportNumber}</h3></div>
                {!report.merchantViewedAt && ["GENERATED", "PAID"].includes(report.status) && <span className="rounded-full bg-accent px-2 py-1 text-[10px] font-black uppercase text-ink">Novo</span>}
              </div>
              <span className={`h-fit rounded-full px-3 py-1 text-sm font-bold ${badge(report.status)}`}>{labels[report.status] ?? report.status}</span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Item label="Período" value={`${date(report.periodStart)} a ${date(report.periodEnd)}`} />
              <Item label="Data de emissão" value={date(report.generatedAt)} />
              <Item label="Pedidos cobrados" value={report.orderCount} />
              <Item label={<span className="flex gap-2">Taxa de desenvolvimento <Help /></span>} value={money(report.serviceFeeTotalCents)} />
              <Item label="Mensalidade" value={money(report.monthlyFeeCents)} />
              <Item label="Total" value={money(report.totalCents)} strong />
              {report.paymentSnapshot?.pixReceiverName && <Item label="PIX / Favorecido" value={`${report.paymentSnapshot.pixReceiverName} — ${report.paymentSnapshot.pixKey}`} />}
            </dl>
            <button className="mt-5 rounded-xl border px-4 py-2 font-bold" onClick={() => void download(report)}>BAIXAR PDF</button>
          </article>
        ))}
        {!reportsLoading && !reportsError && !reports.length && <p className="rounded-2xl bg-surface p-4 text-stone-500">Nenhum relatório emitido.</p>}
      </div>
    </section>
  );
}

function DetailTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
      <div className="border-b p-4"><h3 className="font-black">{title}</h3></div>
      <table className="w-full min-w-[440px] text-left text-sm">
        <thead><tr>{headers.map((header, index) => <th key={header} className={`p-4 ${index > 0 ? "text-right" : ""}`}>{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr className="border-t" key={`${row[0]}-${index}`}>
              {row.map((value, column) => <td key={column} className={`p-4 ${column === 0 ? "font-bold" : "text-right"}`}>{value}</td>)}
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={headers.length} className="border-t p-5 text-center text-stone-500">Sem dados no período.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function Help() {
  return (
    <details className="relative inline-block">
      <summary aria-label="Sobre a taxa de desenvolvimento" className="cursor-pointer list-none rounded-full border px-1 text-xs">?</summary>
      <span className="absolute right-0 z-10 mt-2 block w-72 rounded-xl bg-ink p-3 text-xs font-normal text-white shadow-soft">{feeHelp}</span>
    </details>
  );
}

function Item({ label, value, strong }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return <div><dt className="text-sm text-stone-500">{label}</dt><dd className={strong ? "font-black" : ""}>{value}</dd></div>;
}

function Card({ label, value }: { label: string; value: ReactNode }) {
  return <article className="rounded-2xl bg-surface p-5"><p className="text-sm font-bold text-stone-500">{label}</p><strong className="mt-3 block text-2xl">{value}</strong></article>;
}

function date(value: string) {
  return new Date(value).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function dateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
