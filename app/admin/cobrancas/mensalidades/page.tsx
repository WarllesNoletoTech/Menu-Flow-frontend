"use client";
import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../../../../components/dashboard/DashboardContext";
import { getSession } from "../../../../lib/auth";
import { apiUrl } from "../../../../lib/api";
import { buildWhatsAppUrl, normalizeWhatsAppText } from "../../../../lib/whatsapp";
type Restaurant = { _id: string; name: string; tradeName?: string };
type Settings = { pixReceiverName?: string; pixKey?: string };
type Preview = {
  restaurant: { name: string };
  orderCount: number;
  serviceFeeTotalCents: number;
  alreadyBilledCount: number;
  monthlyFeeAlreadyIncluded: boolean;
  suggestMonthlyFee: boolean;
};
type Report = {
  _id: string;
  reportNumber: string;
  restaurantId: Restaurant;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  orderCount: number;
  serviceFeeTotalCents: number;
  includeMonthlyFee: boolean;
  monthlyFeeCents: number;
  totalCents: number;
  status: string;
  paymentSnapshot?: Settings;
  reportRecipient?: { name: string; reportWhatsapp?: string } | null;
};
const money = (v: number) =>
  normalizeWhatsAppText((v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
const labels: Record<string, string> = {
  DRAFT: "Rascunho",
  GENERATED: "Gerado",
  PAID: "Pago",
  CANCELLED: "Cancelado",
};
const feeHelp =
  "Este valor corresponde às taxas de serviço Menu Flow cobradas dos clientes nos pedidos concluídos deste relatório.";
const iso = (d: Date) => d.toISOString().slice(0, 10);
const date = (v: string) =>
  new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
export default function Page() {
  const { request } = useDashboard();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]),
    [items, setItems] = useState<Report[]>([]),
    [restaurantId, setRestaurantId] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [monthly, setMonthly] = useState(false),
    [monthlyValue, setMonthlyValue] = useState(""),
    [preview, setPreview] = useState<Preview>(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [paying, setPaying] = useState<Report>(),
    [deleting, setDeleting] = useState<Report>(),
    [settings, setSettings] = useState<Settings>({});
  const load = useCallback(async () => {
    setError("");
    try {
      const [r, reports, pix] = await Promise.all([
        request<Restaurant[]>("/restaurants"),
        request<Report[]>("/billing/reports", { cache: "no-store" }),
        request<Settings | null>("/billing/settings/payment", {
          cache: "no-store",
        }),
      ]);
      setRestaurants(r);
      setItems(reports);
      setSettings(pix ?? {});
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível carregar as cobranças.",
      );
    }
  }, [request]);
  useEffect(() => {
    void load();
    const now = new Date(),
      day = now.getDay(),
      lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - ((day + 6) % 7));
    const previousTuesday = new Date(lastMonday);
    previousTuesday.setDate(lastMonday.getDate() - 6);
    setStart(iso(previousTuesday));
    setEnd(iso(lastMonday));
  }, [load]);
  async function saveSettings() {
    try {
      await request("/billing/settings/payment", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setMessage("Dados PIX salvos. Novos relatórios usarão estes dados.");
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível salvar os dados PIX.",
      );
    }
  }
  async function calculate() {
    setError("");
    try {
      const p = await request<Preview>(
        `/billing/reports/preview?restaurantId=${restaurantId}&start=${encodeURIComponent(start + "T00:00:00-03:00")}&end=${encodeURIComponent(end + "T23:59:59.999-03:00")}`,
      );
      setPreview(p);
      setMonthly(p.suggestMonthlyFee && !p.monthlyFeeAlreadyIncluded);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao calcular.");
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    try {
      await request("/billing/reports", {
        method: "POST",
        body: JSON.stringify({
          restaurantId,
          periodStart: start + "T00:00:00-03:00",
          periodEnd: end + "T23:59:59.999-03:00",
          includeMonthlyFee: monthly,
          monthlyFeeCents: monthly
            ? Math.round(Number(monthlyValue.replace(",", ".")) * 100)
            : 0,
        }),
      });
      setPreview(undefined);
      await load();
      setMessage("Relatório gerado e valores congelados com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar.");
    } finally {
      setBusy(false);
    }
  }
  async function pay() {
    if (!paying) return;
    setBusy(true);
    try {
      await request(`/billing/reports/${paying._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PAID" }),
      });
      setPaying(undefined);
      await load();
      setMessage("Relatório marcado como pago.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível confirmar o pagamento.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await request(`/billing/reports/${deleting._id}`, { method: "DELETE" });
      setDeleting(undefined);
      await load();
      setMessage(
        "Relatório excluído. Os pedidos voltaram a ficar disponíveis.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível excluir o relatório.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function pdf(r: Report) {
    const popup = r.reportRecipient?.reportWhatsapp
      ? window.open("about:blank", "_blank")
      : null;
    try {
      const response = await fetch(apiUrl(`/billing/reports/${r._id}/pdf`), {
        headers: { Authorization: `Bearer ${getSession()?.accessToken}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Não foi possível gerar o PDF.");
      const url = URL.createObjectURL(await response.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = `${r.reportNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const recipient = r.reportRecipient;
      if (!recipient?.reportWhatsapp) {
        popup?.close();
        setMessage("PDF baixado. WhatsApp para relatórios não cadastrado.");
        return;
      }
      const text = normalizeWhatsAppText(`RELATÓRIO DE SERVIÇOS - MENU FLOW

Olá, ${recipient.name}!

Segue o relatório de serviços do Menu Flow referente ao período informado.

Relatório: ${r.reportNumber}
Estabelecimento: ${r.restaurantId.tradeName || r.restaurantId.name}
Período: ${date(r.periodStart)} a ${date(r.periodEnd)}
Pedidos contabilizados: ${r.orderCount}

Taxas de serviço Menu Flow: ${money(r.serviceFeeTotalCents)}
Mensalidade: ${r.includeMonthlyFee ? money(r.monthlyFeeCents) : "Não incluída"}
Total do relatório: ${money(r.totalCents)}

DADOS PARA PAGAMENTO VIA PIX
Favorecido: ${r.paymentSnapshot?.pixReceiverName || "Não informado"}
Chave PIX: ${r.paymentSnapshot?.pixKey || "Não informada"}

Status: ${labels[r.status] ?? r.status}

O PDF do relatório foi baixado e pode ser anexado nesta conversa. O mesmo relatório também permanece disponível no painel do Menu Flow.

Atenciosamente,
Menu Flow
Cardápios mais simples, clientes mais felizes.`);
      const wa = buildWhatsAppUrl(recipient.reportWhatsapp, text);
      if (popup) popup.location.href = wa;
      else window.open(wa, "_blank", "noopener,noreferrer");
      setMessage(
        "PDF baixado. O WhatsApp foi aberto; anexe o arquivo manualmente.",
      );
    } catch (e) {
      popup?.close();
      setError(
        e instanceof Error ? e.message : "Não foi possível baixar o PDF.",
      );
    }
  }
  const monthlyCents =
    Math.round(Number(monthlyValue.replace(",", ".")) * 100) || 0;
  const paidCount = items.filter((item) => item.status === "PAID").length;
  const pendingCount = items.filter((item) => item.status === "GENERATED" || item.status === "DRAFT").length;
  const reportsTotal = items.reduce((total, item) => total + item.totalCents, 0);
  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="mf-panel rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.18em] text-primary">Financeiro da plataforma</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-[2.35rem]">Cobranças e relatórios de serviço</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500 sm:text-base">Gerencie os dados de pagamento, gere relatórios de cobrança e acompanhe o histórico de mensalidades e taxas de serviço do Menu Flow.</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard label="Relatórios emitidos" value={String(items.length)} />
          <SummaryCard label="Pagos" value={String(paidCount)} tone="success" />
          <SummaryCard label="Pendentes" value={String(pendingCount)} tone="warning" helper={money(reportsTotal)} />
        </div>
      </header>
      <section className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
        <div className="border-b border-border pb-4"><span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-accent">Pagamento</span><h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Dados para pagamento via PIX</h2><p className="mt-1 text-sm text-stone-500">Esses dados serão registrados nos novos relatórios emitidos.</p></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Nome do recebedor">
            <input
              className="field"
              value={settings.pixReceiverName ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, pixReceiverName: e.target.value })
              }
            />
          </Field>
          <Field label="Chave PIX">
            <input
              className="field"
              value={settings.pixKey ?? ""}
              onChange={(e) =>
                setSettings({ ...settings, pixKey: e.target.value })
              }
            />
          </Field>
        </div>
        <button
          className="mt-5 min-h-11 rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm"
          onClick={() => void saveSettings()}
        >
          Salvar dados PIX
        </button>
      </section>
      <section className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
        <div className="border-b border-border pb-4"><span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary">Novo relatório</span><h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Gerar relatório de serviço</h2><p className="mt-1 text-sm text-stone-500">Selecione a empresa e o período que será consolidado.</p></div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Empresa">
            <select
              className="field"
              value={restaurantId}
              onChange={(e) => setRestaurantId(e.target.value)}
            >
              <option value="">Selecione</option>
              {restaurants.map((r) => (
                <option value={r._id} key={r._id}>
                  {r.tradeName || r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Período inicial">
            <input
              type="date"
              className="field"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Período final">
            <input
              type="date"
              className="field"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
        <button
          disabled={!restaurantId || !start || !end}
          onClick={() => void calculate()}
          className="mt-5 min-h-11 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-black text-stone-700 shadow-sm disabled:opacity-40"
        >
          Calcular prévia
        </button>
        {preview && (
          <div className="mt-5 rounded-[24px] border border-border bg-background/55 p-5">
            <h3 className="font-black">Prévia — {preview.restaurant.name}</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p>
                Pedidos concluídos disponíveis: <b>{preview.orderCount}</b>
              </p>
              <p>
                Taxas Menu Flow cobradas nos pedidos:{" "}
                <b>{money(preview.serviceFeeTotalCents)}</b> <Help />
              </p>
              <p>
                Já cobrados: <b>{preview.alreadyBilledCount}</b>
              </p>
            </div>
            <label className="mt-4 flex gap-2 font-bold">
              <input
                type="checkbox"
                checked={monthly}
                disabled={preview.monthlyFeeAlreadyIncluded}
                onChange={(e) => setMonthly(e.target.checked)}
              />{" "}
              Incluir mensalidade
            </label>
            {preview.monthlyFeeAlreadyIncluded && (
              <p role="alert" className="mt-2 font-bold text-danger">
                A mensalidade deste mês já está incluída em outro relatório.
              </p>
            )}
            {monthly && (
              <Field label="Valor da mensalidade (R$)">
                <input
                  className="field max-w-xs"
                  inputMode="decimal"
                  placeholder="150,00"
                  value={monthlyValue}
                  onChange={(e) => setMonthlyValue(e.target.value)}
                />
              </Field>
            )}
            <p className="mt-5 text-xl font-black">
              TOTAL:{" "}
              {money(
                preview.serviceFeeTotalCents + (monthly ? monthlyCents : 0),
              )}
            </p>
            <button
              disabled={
                busy ||
                (!preview.orderCount && !monthly) ||
                (monthly && monthlyCents <= 0)
              }
              onClick={() => void generate()}
              className="mt-4 min-h-11 rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white shadow-sm disabled:opacity-40"
            >
              {busy ? "Gerando…" : "Gerar relatório"}
            </button>
          </div>
        )}
      </section>
      {message && <p className="rounded-[22px] border border-border bg-surface px-4 py-3 text-sm font-semibold text-stone-700">{message}</p>}
      {error && (
        <p role="alert" className="rounded-[22px] border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-end sm:justify-between"><div><span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-accent">Histórico financeiro</span><h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">Relatórios emitidos</h2></div><span className="text-sm font-semibold text-stone-500">{items.length} {items.length === 1 ? "relatório" : "relatórios"}</span></div>
      <div className="overflow-x-auto rounded-[30px] border border-border/90 bg-white shadow-[0_14px_36px_rgba(41,37,36,.05)]">
        <table className="w-full min-w-[1050px]">
          <thead className="bg-background/70">
            <tr>
              {[
                "Relatório",
                "Empresa",
                "Período",
                "Pedidos",
                "Taxa de serviço Menu Flow",
                "Mensalidade",
                "Total",
                "Status",
                "Ações",
              ].map((x) => (
                <th className="p-4 text-left text-[11px] font-black uppercase tracking-[.1em] text-stone-500" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr className="border-t border-border transition hover:bg-background/35" key={r._id}>
                <td className="p-4 font-bold">{r.reportNumber}</td>
                <td className="p-4">
                  {r.restaurantId.tradeName || r.restaurantId.name}
                </td>
                <td className="p-4">
                  {date(r.periodStart)} – {date(r.periodEnd)}
                </td>
                <td className="p-4">{r.orderCount}</td>
                <td className="p-4">
                  {money(r.serviceFeeTotalCents)} <Help />
                </td>
                <td className="p-4">{money(r.monthlyFeeCents)}</td>
                <td className="p-4 font-black">{money(r.totalCents)}</td>
                <td className="p-4">{labels[r.status] ?? r.status}</td>
                <td className="p-4">
                  <div className="flex gap-3">
                    <button
                      className="font-bold underline"
                      onClick={() => void pdf(r)}
                    >
                      Baixar PDF e enviar
                    </button>
                    {r.status === "GENERATED" && (
                      <button className="font-bold underline" onClick={() => setPaying(r)}>
                        Marcar como pago
                      </button>
                    )}
                    {(r.status === "GENERATED" || r.status === "DRAFT") && (
                      <button className="font-bold text-danger underline" onClick={() => setDeleting(r)}>
                        Excluir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && !error && (
          <p className="p-4 text-stone-500">Nenhum relatório emitido.</p>
        )}
      </div>
      {paying && (
        <Modal
          title="Confirmar pagamento"
          report={paying}
          text="Confirma que este relatório foi pago?"
          confirm="Confirmar pagamento"
          busy={busy}
          close={() => setPaying(undefined)}
          action={pay}
        />
      )}{" "}
      {deleting && (
        <Modal
          title="Excluir relatório?"
          report={deleting}
          text="Os pedidos vinculados a este relatório voltarão a ficar disponíveis para uma nova cobrança."
          confirm="Excluir relatório"
          busy={busy}
          close={() => setDeleting(undefined)}
          action={remove}
        />
      )}
    </section>
  );
}
function SummaryCard({ label, value, tone = "primary", helper }: { label: string; value: string; tone?: "primary" | "success" | "warning"; helper?: string }) {
  const toneClass = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary";
  return <article className="rounded-[24px] border border-border/90 bg-white p-5 shadow-[0_12px_30px_rgba(41,37,36,.05)]"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-stone-500">{label}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] ${toneClass}`}>Resumo</span></div><strong className="mt-3 block text-[30px] font-black tracking-tight text-stone-900">{value}</strong>{helper && <p className="mt-1 text-xs font-semibold text-stone-400">Total emitido: {helper}</p>}</article>;
}

function Help() {
  return (
    <details className="relative inline-block">
      <summary
        aria-label="Sobre a taxa de serviço Menu Flow"
        className="cursor-pointer list-none rounded-full border px-1 text-xs"
      >
        ?
      </summary>
      <span className="absolute right-0 z-10 mt-2 block w-72 rounded-xl bg-ink p-3 text-xs font-normal text-white">
        {feeHelp}
      </span>
    </details>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block font-bold text-stone-800">
      {label}
      {children}
    </label>
  );
}
function Modal({
  title,
  report,
  text,
  confirm,
  busy,
  close,
  action,
}: {
  title: string;
  report: Report;
  text: string;
  confirm: string;
  busy: boolean;
  close: () => void;
  action: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-[30px] border border-white/10 bg-surface p-6 shadow-2xl"
      >
        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary">Cobrança</span><h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">{title}</h2>
        <dl className="mt-5 grid grid-cols-2 gap-3 rounded-[22px] border border-border bg-background/55 p-4 text-sm">
          <dt>Relatório:</dt>
          <dd className="font-bold">{report.reportNumber}</dd>
          <dt>Empresa:</dt>
          <dd>{report.restaurantId.tradeName || report.restaurantId.name}</dd>
          <dt>Período:</dt>
          <dd>
            {date(report.periodStart)} a {date(report.periodEnd)}
          </dd>
          <dt>Total:</dt>
          <dd className="font-black">{money(report.totalCents)}</dd>
        </dl>
        <p className="mt-4 rounded-[20px] border border-warning/20 bg-warning/10 p-4 text-sm font-bold text-stone-700">{text}</p>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            disabled={busy}
            className="min-h-11 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-black text-stone-700"
            onClick={close}
          >
            Voltar
          </button>
          <button
            disabled={busy}
            className="min-h-11 rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm"
            onClick={() => void action()}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
