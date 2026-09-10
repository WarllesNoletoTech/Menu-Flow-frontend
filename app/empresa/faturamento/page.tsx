"use client";
import { useCallback, useEffect, useState } from "react";
import { useEmpresa } from "../../../components/empresa/EmpresaContext";
import { useOrderSocket } from "../../../lib/order-socket";
import { getSession } from "../../../lib/auth";
import { apiUrl } from "../../../lib/api";
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
  grossRevenueCents: number;
  menuFlowServiceFeesCollectedCents: number;
  grossOrderVolumeCents: number;
  averageTicketCents: number;
  cancelledOrders: number;
};
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    v / 100,
  );
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
  const [sales, setSales] = useState<Sales>(),
    [reports, setReports] = useState<Report[]>([]),
    [salesError, setSalesError] = useState(""),
    [reportsError, setReportsError] = useState(""),
    [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setSalesError("");
    setReportsError("");
    const now = new Date(),
      period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const results = await Promise.allSettled([
      request<{ salesMetrics: Sales }>(`/billing/me?period=${period}`, {
        cache: "no-store",
      }),
      request<Report[]>("/billing/me/reports", { cache: "no-store" }),
    ]);
    if (results[0].status === "fulfilled")
      setSales(results[0].value.salesMetrics);
    else
      setSalesError(
        results[0].reason instanceof Error
          ? results[0].reason.message
          : "Não foi possível carregar o resumo de vendas.",
      );
    if (results[1].status === "fulfilled") setReports(results[1].value);
    else
      setReportsError(
        results[1].reason instanceof Error
          ? results[1].reason.message
          : "Não foi possível carregar as cobranças.",
      );
    setLoading(false);
  }, [request]);
  useEffect(() => {
    void load();
    const focus = () => void load();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [load]);
  useOrderSocket(
    useCallback(
      (event, value) => {
        if (
          event === "updated" &&
          (value as { status?: string })?.status === "COMPLETED"
        )
          void load();
      },
      [load],
    ),
  );
  async function download(report: Report) {
    try {
      setReportsError("");
      const response = await fetch(
        apiUrl(`/billing/me/reports/${report._id}/pdf`),
        {
          headers: { Authorization: `Bearer ${getSession()?.accessToken}` },
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error("Não foi possível baixar o PDF.");
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `${report.reportNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setReportsError(
        e instanceof Error ? e.message : "Não foi possível baixar o PDF.",
      );
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
  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-black">Faturamento</h1>
      <p className="mt-2 text-stone-500">
        Vendas da loja e cobranças do Menu Flow são informações independentes.
      </p>
      {loading && <p className="mt-5">Carregando dados atuais…</p>}
      <h2 className="mt-8 text-xl font-black">Resumo de vendas</h2>
      {salesError && (
        <p role="alert" className="mt-3 bg-danger/10 p-4 text-danger">
          {salesError}
        </p>
      )}
      {sales && (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Pedidos concluídos" value={sales.completedOrders} />
          <Card
            label="Faturamento de vendas"
            value={money(sales.grossRevenueCents)}
          />
          <Card label="Taxas Menu Flow a repassar" value={money(sales.menuFlowServiceFeesCollectedCents)} />
          <Card label="Total transacionado" value={money(sales.grossOrderVolumeCents)} />
          <Card label="Ticket médio" value={money(sales.averageTicketCents)} />
          <Card label="Pedidos cancelados" value={sales.cancelledOrders} />
        </div>
      )}
      <h2 className="mt-8 text-xl font-black">Cobranças Menu Flow</h2>
      <p className="mt-1 text-stone-500">
        Relatórios de serviço emitidos pela plataforma.
      </p>
      {reportsError && (
        <p role="alert" className="mt-3 bg-danger/10 p-4 text-danger">
          {reportsError}
        </p>
      )}
      <div className="mt-3 grid gap-4">
        {reports.map((r) => (
          <article className="rounded-2xl bg-surface p-5 shadow-sm" key={r._id}>
            <div className="flex justify-between gap-3">
              <div>
                <p className="text-sm text-stone-500">Relatório</p>
                <h3 className="font-black">{r.reportNumber}</h3>
              </div>
              <span
                className={`h-fit rounded-full px-3 py-1 text-sm font-bold ${badge(r.status)}`}
              >
                {labels[r.status] ?? r.status}
              </span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Item
                label="Período"
                value={`${date(r.periodStart)} a ${date(r.periodEnd)}`}
              />
              <Item label="Data de emissão" value={date(r.generatedAt)} />
              <Item label="Pedidos cobrados" value={r.orderCount} />
              <Item
                label={
                  <span className="flex gap-2">
                    Taxa de desenvolvimento <Help />
                  </span>
                }
                value={money(r.serviceFeeTotalCents)}
              />
              <Item label="Mensalidade" value={money(r.monthlyFeeCents)} />
              <Item label="Total" value={money(r.totalCents)} strong />
              {r.paymentSnapshot?.pixReceiverName && (
                <Item
                  label="PIX / Favorecido"
                  value={`${r.paymentSnapshot.pixReceiverName} — ${r.paymentSnapshot.pixKey}`}
                />
              )}
            </dl>
            <button
              className="mt-5 rounded-xl border px-4 py-2 font-bold"
              onClick={() => void download(r)}
            >
              BAIXAR PDF
            </button>
          </article>
        ))}
        {!loading && !reportsError && !reports.length && (
          <p className="rounded-2xl bg-surface p-4 text-stone-500">
            Nenhum relatório emitido.
          </p>
        )}
      </div>
    </section>
  );
}
function Help() {
  return (
    <details className="relative inline-block">
      <summary
        aria-label="Sobre a taxa de desenvolvimento"
        className="cursor-pointer list-none rounded-full border px-1 text-xs"
      >
        ?
      </summary>
      <span className="absolute right-0 z-10 mt-2 block w-72 rounded-xl bg-ink p-3 text-xs font-normal text-white shadow-soft">
        {feeHelp}
      </span>
    </details>
  );
}
function Item({
  label,
  value,
  strong,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-sm text-stone-500">{label}</dt>
      <dd className={strong ? "font-black" : ""}>{value}</dd>
    </div>
  );
}
function Card({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <article className="rounded-2xl bg-surface p-5">
      <p className="text-sm font-bold text-stone-500">{label}</p>
      <strong className="mt-3 block text-2xl">{value}</strong>
    </article>
  );
}
function date(v: string) {
  return new Date(v).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}
