"use client";
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

const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);
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
      setReports(await request<Report[]>("/billing/me/reports", { cache: "no-store" }));
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
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
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

  async function download(report: Report) {
    try {
      setReportsError("");
      const response = await fetch(apiUrl(`/billing/me/reports/${report._id}/pdf`), {
        headers: { Authorization: `Bearer ${getSession()?.accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Não foi possível baixar o PDF.");
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${report.reportNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setReportsError(e instanceof Error ? e.message : "Não foi possível baixar o PDF.");
    }
  }

  const badge = (s: string) =>
    s === "PAID"
      ? "bg-green-100 text-green-800"
      : s === "GENERATED"
        ? "bg-amber-100 text-amber-900"
        : s === "CANCELLED"
          ? "bg-red-100 text-red-800"
          : "bg-stone-200 text-stone-700";
  const sales = salesReport?.salesMetrics;
  const details = salesReport?.details;

  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-black">Faturamento</h1>
      <p className="mt-2 text-stone-500">
        Consulte as vendas por período e veja um relatório detalhado dos produtos vendidos.
      </p>

      <div className="mt-6 rounded-2xl border bg-surface p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label className="text-sm font-bold">Data inicial
            <input type="date" className="field !mt-2" value={draftRange.start} onChange={(event) => setDraftRange({ ...draftRange, start: event.target.value })}/>
          </label>
          <label className="text-sm font-bold">Data final
            <input type="date" className="field !mt-2" value={draftRange.end} onChange={(event) => setDraftRange({ ...draftRange, end: event.target.value })}/>
          </label>
          <button type="button" onClick={applyPeriod} className="h-fit rounded-xl bg-ink px-5 py-3 font-black text-white">ATUALIZAR RELATÓRIO</button>
        </div>
        <p className="mt-2 text-xs text-stone-500">Por padrão, o período vem preenchido da terça-feira mais recente até a próxima segunda-feira. Você pode escolher qualquer intervalo.</p>
        {periodError && <p role="alert" className="mt-2 text-sm font-bold text-danger">{periodError}</p>}
      </div>

      {salesLoading && <p className="mt-5">Carregando faturamento do período…</p>}
      {salesError && <p role="alert" className="mt-5 rounded-xl bg-danger/10 p-4 text-danger">{salesError}</p>}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Resumo de vendas</h2>
          <p className="mt-1 text-sm text-stone-500">Período: {dateInput(range.start)} a {dateInput(range.end)}</p>
        </div>
        {salesReport && <button type="button" onClick={() => window.print()} className="rounded-xl border px-4 py-2 text-sm font-black">IMPRIMIR / SALVAR PDF</button>}
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
                {details.products.map((product, index) => <tr className="border-t" key={`${product.productName}-${index}`}><td className="p-4 font-bold">{product.productName}</td><td className="p-4 text-right">{product.quantity}</td><td className="p-4 text-right font-bold">{money(product.productRevenueCents)}</td></tr>)}
                {!details.products.length && <tr><td colSpan={3} className="border-t p-6 text-center text-stone-500">Nenhum produto vendido no período.</td></tr>}
              </tbody>
              <tfoot><tr className="border-t"><td className="p-4 font-black" colSpan={2}>Subtotal dos produtos</td><td className="p-4 text-right font-black">{money(details.subtotalCents)}</td></tr></tfoot>
            </table>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DetailTable title="Por forma de pagamento" headers={["Forma", "Pedidos", "Faturamento"]} rows={details.paymentMethods.map((item) => [paymentMethodLabel(item.method), String(item.orders), money(item.salesCents)])}/>
            <DetailTable title="Entrega e retirada" headers={["Tipo", "Pedidos", "Faturamento"]} rows={details.fulfillments.map((item) => [item.fulfillment === "DELIVERY" ? "Entrega" : "Retirada", String(item.orders), money(item.salesCents)])}/>
          </div>

          <div className="mt-4">
            <DetailTable title="Vendas por dia" headers={["Data", "Pedidos", "Faturamento"]} rows={details.daily.map((item) => [dateInput(item.date), String(item.orders), money(item.salesCents)])}/>
          </div>
        </section>
      )}

      <h2 className="mt-10 text-xl font-black">Cobranças Menu Flow</h2>
      <p className="mt-1 text-stone-500">Relatórios de serviço emitidos pela plataforma. O filtro de datas acima controla o faturamento e o relatório detalhado; estas cobranças mantêm o período próprio de cada relatório emitido.</p>
      {reportsError && <p role="alert" className="mt-3 bg-danger/10 p-4 text-danger">{reportsError}</p>}
      <div className="mt-3 grid gap-4">
        {reports.map((r) => (
          <article className="rounded-2xl bg-surface p-5 shadow-sm" key={r._id}>
            <div className="flex justify-between gap-3">
              <div><p className="text-sm text-stone-500">Relatório</p><h3 className="font-black">{r.reportNumber}</h3></div>
              <span className={`h-fit rounded-full px-3 py-1 text-sm font-bold ${badge(r.status)}`}>{labels[r.status] ?? r.status}</span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Item label="Período" value={`${date(r.periodStart)} a ${date(r.periodEnd)}`} />
              <Item label="Data de emissão" value={date(r.generatedAt)} />
              <Item label="Pedidos cobrados" value={r.orderCount} />
              <Item label={<span className="flex gap-2">Taxa de desenvolvimento <Help /></span>} value={money(r.serviceFeeTotalCents)} />
              <Item label="Mensalidade" value={money(r.monthlyFeeCents)} />
              <Item label="Total" value={money(r.totalCents)} strong />
              {r.paymentSnapshot?.pixReceiverName && <Item label="PIX / Favorecido" value={`${r.paymentSnapshot.pixReceiverName} — ${r.paymentSnapshot.pixKey}`} />}
            </dl>
            <button className="mt-5 rounded-xl border px-4 py-2 font-bold" onClick={() => void download(r)}>BAIXAR PDF</button>
          </article>
        ))}
        {!reportsLoading && !reportsError && !reports.length && <p className="rounded-2xl bg-surface p-4 text-stone-500">Nenhum relatório emitido.</p>}
      </div>
    </section>
  );
}

function DetailTable({title,headers,rows}:{title:string;headers:string[];rows:string[][]}) {
  return <div className="overflow-x-auto rounded-2xl bg-surface shadow-sm">
    <div className="border-b p-4"><h3 className="font-black">{title}</h3></div>
    <table className="w-full min-w-[440px] text-left text-sm">
      <thead><tr>{headers.map((header,index)=><th key={header} className={`p-4 ${index>0?'text-right':''}`}>{header}</th>)}</tr></thead>
      <tbody>{rows.map((row,index)=><tr className="border-t" key={`${row[0]}-${index}`}>{row.map((value,column)=><td key={column} className={`p-4 ${column===0?'font-bold':'text-right'}`}>{value}</td>)}</tr>)}{!rows.length&&<tr><td colSpan={headers.length} className="border-t p-5 text-center text-stone-500">Sem dados no período.</td></tr>}</tbody>
    </table>
  </div>;
}

function Help() {
  return (
    <details className="relative inline-block">
      <summary aria-label="Sobre a taxa de desenvolvimento" className="cursor-pointer list-none rounded-full border px-1 text-xs">?</summary>
      <span className="absolute right-0 z-10 mt-2 block w-72 rounded-xl bg-ink p-3 text-xs font-normal text-white shadow-soft">{feeHelp}</span>
    </details>
  );
}
function Item({label,value,strong}:{label:React.ReactNode;value:React.ReactNode;strong?:boolean}) {
  return <div><dt className="text-sm text-stone-500">{label}</dt><dd className={strong ? "font-black" : ""}>{value}</dd></div>;
}
function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return <article className="rounded-2xl bg-surface p-5"><p className="text-sm font-bold text-stone-500">{label}</p><strong className="mt-3 block text-2xl">{value}</strong></article>;
}
function date(v: string) {
  return new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function dateInput(v:string) {
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return match?`${match[3]}/${match[2]}/${match[1]}`:v;
}
