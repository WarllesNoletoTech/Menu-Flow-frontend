"use client";
import { useCallback, useEffect, useState } from "react";
import { useDashboard } from "../../../../components/dashboard/DashboardContext";
import { getSession } from "../../../../lib/auth";
import { apiUrl } from "../../../../lib/api";
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
  (v / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
      const text = `RELATÓRIO DE SERVIÇOS - MENU FLOW\n\nRelatório: ${r.reportNumber}\nEstabelecimento: ${r.restaurantId.tradeName || r.restaurantId.name}\nPeríodo: ${date(r.periodStart)} a ${date(r.periodEnd)}\nPedidos contabilizados: ${r.orderCount}\n\nTaxas Menu Flow cobradas nos pedidos:\n${money(r.serviceFeeTotalCents)}\n\nMensalidade:\n${money(r.monthlyFeeCents)}\n\nTotal do relatório:\n${money(r.totalCents)}\n\nDados para pagamento via PIX:\nFavorecido: ${r.paymentSnapshot?.pixReceiverName || "Não informado"}\nChave PIX: ${r.paymentSnapshot?.pixKey || "Não informada"}\n\nStatus: ${labels[r.status] ?? r.status}\n\nO PDF do relatório foi baixado e pode ser anexado nesta conversa.\n\nO relatório também está disponível no painel do Menu Flow.\n\nMenu Flow\nCardápios mais simples, clientes mais felizes.`;
      const wa = `https://wa.me/${recipient.reportWhatsapp}?text=${encodeURIComponent(text)}`;
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
  return (
    <section className="mx-auto max-w-7xl">
      <h1 className="text-3xl font-black">Relatórios de serviço</h1>
      <p className="mt-2 text-stone-500">
        Mensalidade manual e repasse das taxas cobradas dos clientes nos pedidos concluídos.
      </p>
      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-xl font-black">Dados para pagamento</h2>
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
          className="mt-4 rounded-xl bg-ink px-5 py-3 font-black text-white"
          onClick={() => void saveSettings()}
        >
          SALVAR DADOS PIX
        </button>
      </section>
      <section className="mt-6 rounded-2xl bg-surface p-5 shadow-soft">
        <h2 className="text-xl font-black">Gerar relatório</h2>
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
          className="mt-4 rounded-xl border px-5 py-3 font-bold disabled:opacity-40"
        >
          CALCULAR PRÉVIA
        </button>
        {preview && (
          <div className="mt-5 rounded-2xl bg-background p-5">
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
              className="mt-4 rounded-xl bg-ink px-6 py-3 font-black text-white disabled:opacity-40"
            >
              {busy ? "GERANDO…" : "GERAR RELATÓRIO"}
            </button>
          </div>
        )}
      </section>
      {message && <p className="mt-4 rounded-xl bg-surface p-4">{message}</p>}
      {error && (
        <p role="alert" className="mt-4 bg-danger/10 p-4 text-danger">
          {error}
        </p>
      )}
      <h2 className="mt-8 text-xl font-black">Histórico</h2>
      <div className="mt-3 overflow-x-auto rounded-2xl bg-surface">
        <table className="w-full min-w-[1050px]">
          <thead>
            <tr>
              {[
                "Relatório",
                "Empresa",
                "Período",
                "Pedidos",
                "Taxa de desenvolvimento",
                "Mensalidade",
                "Total",
                "Status",
                "Ações",
              ].map((x) => (
                <th className="p-4 text-left" key={x}>
                  {x}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr className="border-t" key={r._id}>
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
          confirm="CONFIRMAR PAGAMENTO"
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
          confirm="EXCLUIR RELATÓRIO"
          busy={busy}
          close={() => setDeleting(undefined)}
          action={remove}
        />
      )}
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
    <label className="mt-3 block font-bold">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-surface p-6"
      >
        <h2 className="text-xl font-black">{title}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-2">
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
        <p className="mt-4 rounded-xl bg-warning/10 p-3 font-bold">{text}</p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            disabled={busy}
            className="rounded-xl border px-5 py-3 font-bold"
            onClick={close}
          >
            VOLTAR
          </button>
          <button
            disabled={busy}
            className="rounded-xl bg-ink px-5 py-3 font-bold text-white"
            onClick={() => void action()}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
