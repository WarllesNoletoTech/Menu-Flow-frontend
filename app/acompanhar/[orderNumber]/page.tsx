'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useOrderSocket } from '../../../lib/order-socket';
import { apiUrl } from '../../../lib/api';
import { paymentMethodLabel } from '../../../lib/payment-methods';

type Order = {
  orderNumber: string;
  status: string;
  rejectionReason?: string;
  cancellationReason?: string;
  fulfillment: string;
  paymentMethod: string;
  needsChange: boolean;
  changeForCents?: number;
  expectedChangeCents?: number;
  subtotalCents: number;
  deliveryFeeCents?: number;
  customerServiceFeeCents?: number;
  discountCents?: number;
  totalCents: number;
  items: Array<{
    productName: string;
    quantity: number;
    addons: Array<{ name: string }>;
  }>;
  restaurantId: {
    name: string;
    tradeName?: string;
    address?: string;
    mapUrl?: string;
  };
  address?: Record<string, string>;
  rappidexDeliveryId?: string;
  rappidexStatus?: string;
  rappidexStatusLabel?: string;
  rappidexMotoboyName?: string;
  rappidexMotoboyPhone?: string;
};

const label: Record<string, string> = {
  PENDING: 'Aguardando aceitação',
  ACCEPTED: 'Aceito',
  PREPARING: 'Em preparo',
  READY: 'Pronto',
  OUT_FOR_DELIVERY: 'Saiu para entrega',
  COMPLETED: 'Concluído',
  REJECTED: 'Recusado',
  CANCELLED: 'Cancelado',
};

const rappidexFallbackLabel: Record<string, string> = {
  AGUARDANDO_LIBERACAO: 'Aguardando liberação',
  PENDENTE: 'Aguardando motoboy',
  ACAMINHO: 'Motoboy indo até o estabelecimento',
  CHEGOU_ESTABELECIMENTO: 'Motoboy chegou ao estabelecimento',
  COLETADO: 'Motoboy a caminho do cliente',
  CHEGOU_DESTINO: 'Motoboy chegou ao destino',
  AGUARDANDO_CODIGO: 'Aguardando código de entrega',
  FINALIZADO: 'Entrega concluída',
  CANCELADO: 'Entrega cancelada',
};

const assignedRappidexStatuses = new Set([
  'ACAMINHO',
  'CHEGOU_ESTABELECIMENTO',
  'COLETADO',
  'CHEGOU_DESTINO',
  'AGUARDANDO_CODIGO',
]);
const visibleRappidexStatuses = new Set([
  ...assignedRappidexStatuses,
  'FINALIZADO',
  'CANCELADO',
]);

const money = (value = 0) =>
  (value / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

export default function Page() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const search = useSearchParams();
  const token = search.get('token') || '';
  const confirmed = search.get('confirmed') === '1';
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const [order, setOrder] = useState<Order>();
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      fetch(
        apiUrl(
          `/track/orders/${encodeURIComponent(orderNumber)}/${encodeURIComponent(token)}`,
        ),
        { cache: 'no-store' },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error('Pedido não encontrado.');
          setOrder(await response.json());
          setError('');
        })
        .catch((loadError) => setError(loadError.message)),
    [orderNumber, token],
  );

  useEffect(() => {
    setWhatsappUrl(
      sessionStorage.getItem(`menu-flow-whatsapp:${orderNumber}`) ?? '',
    );
  }, [orderNumber]);

  useOrderSocket(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-5">
        <p className="rounded-2xl bg-danger/10 p-6 font-bold text-danger">
          {error}
        </p>
      </main>
    );
  }

  if (!order) return <main className="p-8 text-center">Carregando pedido…</main>;

  const steps =
    order.fulfillment === 'DELIVERY'
      ? ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'COMPLETED']
      : ['PENDING', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED'];
  const current = steps.indexOf(order.status);
  const rappidexLabel = order.rappidexStatus
    ? order.rappidexStatusLabel ||
      rappidexFallbackLabel[order.rappidexStatus] ||
      order.rappidexStatus
    : '';
  const showRappidexAsPrimary = Boolean(
    order.rappidexStatus && visibleRappidexStatuses.has(order.rappidexStatus),
  );
  const visibleStatus = showRappidexAsPrimary
    ? rappidexLabel
    : label[order.status] || order.status;

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-4 sm:p-8">
      {confirmed && (
        <section className="mb-5 rounded-3xl border border-success/30 bg-surface p-6 shadow-soft">
          <p className="font-black text-success">✓ Pedido realizado com sucesso!</p>
          <h1 className="mt-2 text-2xl font-black">Pedido #{order.orderNumber}</h1>
          <p className="mt-2">
            Seu pedido foi enviado ao estabelecimento e está aguardando aceitação.
          </p>
          <p className="mt-2 font-bold">
            Você pode acompanhar a aceitação e todas as atualizações pelo Menu Flow.
          </p>
          <p className="mt-3 rounded-xl bg-background p-3 text-sm">
            <b>Importante:</b> acompanhe o status do pedido pelo Menu Flow. O
            WhatsApp é utilizado apenas como canal adicional de comunicação com o
            estabelecimento.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="#status"
              className="rounded-xl bg-ink px-5 py-3 font-black text-white"
            >
              ACOMPANHAR PEDIDO
            </a>
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-success px-5 py-3 font-black text-white"
              >
                ENVIAR NO WHATSAPP
              </a>
            )}
          </div>
          {!whatsappUrl && (
            <p className="mt-3 text-sm text-stone-500">
              WhatsApp do estabelecimento não disponível.
            </p>
          )}
        </section>
      )}

      <header id="status" className="rounded-3xl bg-ink p-6 text-white">
        <p className="text-sm text-lime">
          {order.restaurantId.tradeName || order.restaurantId.name}
        </p>
        <h1 className="mt-1 text-2xl font-black">Pedido #{order.orderNumber}</h1>
        <p className="mt-2 font-bold">{visibleStatus}</p>
      </header>

      {order.status === 'REJECTED' ? (
        <section className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 p-6">
          <h2 className="text-xl font-black text-danger">PEDIDO RECUSADO</h2>
          <p className="mt-2">
            <b>Motivo:</b> {order.rejectionReason}
          </p>
        </section>
      ) : order.status === 'CANCELLED' ? (
        <section className="mt-5 rounded-2xl border border-danger/30 bg-danger/10 p-6">
          <h2 className="text-xl font-black text-danger">PEDIDO CANCELADO</h2>
          {order.cancellationReason && (
            <p className="mt-2">
              <b>Motivo:</b> {order.cancellationReason}
            </p>
          )}
        </section>
      ) : (
        <ol className="mt-5 space-y-2 rounded-2xl bg-surface p-5 shadow-sm">
          {steps.map((step, index) => (
            <li
              key={step}
              className={`flex gap-3 rounded-xl p-3 ${
                index === current
                  ? 'bg-lime/30 font-black'
                  : index < current
                    ? 'font-bold text-success'
                    : 'text-stone-400'
              }`}
            >
              <span>{index < current ? '✓' : index === current ? '●' : '○'}</span>
              {step === 'READY' && order.fulfillment === 'PICKUP'
                ? 'Pronto para retirada'
                : step === 'OUT_FOR_DELIVERY' && showRappidexAsPrimary && rappidexLabel
                  ? rappidexLabel
                  : label[step]}
            </li>
          ))}
        </ol>
      )}

      {order.fulfillment === 'DELIVERY' &&
        (order.rappidexDeliveryId || order.rappidexStatus) && (
          <section className="mt-5 rounded-2xl border bg-surface p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black">Entrega Rappidex</h2>
              {rappidexLabel && (
                <span className="rounded-full bg-ink px-3 py-2 text-xs font-black text-white">
                  {rappidexLabel}
                </span>
              )}
            </div>
            {order.rappidexMotoboyName && (
              <p className="mt-3">
                Motoboy: <b>{order.rappidexMotoboyName}</b>
              </p>
            )}
          </section>
        )}

      <section className="mt-5 rounded-2xl bg-surface p-5 shadow-sm">
        <h2 className="text-lg font-black">Detalhes</h2>
        {order.items.map((item, index) => (
          <div key={index} className="mt-3 border-t pt-3">
            <b>
              {item.quantity}x {item.productName}
            </b>
            {item.addons.length > 0 && (
              <p className="text-sm text-stone-500">
                + {item.addons.map((addon) => addon.name).join(', ')}
              </p>
            )}
          </div>
        ))}
        <div className="mt-4 space-y-1 border-t pt-4 text-sm">
          <p className="flex justify-between">
            <span>Subtotal</span>
            <b>{money(order.subtotalCents)}</b>
          </p>
          <p className="flex justify-between">
            <span>Taxa de entrega</span>
            <b>{money(order.deliveryFeeCents)}</b>
          </p>
          <p className="flex justify-between">
            <span>Taxa de serviço Menu Flow</span>
            <b>{money(order.customerServiceFeeCents)}</b>
          </p>
          {Boolean(order.discountCents) && (
            <p className="flex justify-between">
              <span>Desconto</span>
              <b>-{money(order.discountCents)}</b>
            </p>
          )}
          <p className="flex justify-between border-t pt-2 text-lg font-black">
            <span>Total pago pelo cliente</span>
            <span>{money(order.totalCents)}</span>
          </p>
        </div>
        <p className="mt-2">
          Modalidade:{' '}
          <b>{order.fulfillment === 'DELIVERY' ? 'Entrega' : 'Retirada no local'}</b>
        </p>
        <p>
          Pagamento: <b>{paymentMethodLabel(order.paymentMethod)}</b>
        </p>
        {order.paymentMethod === 'CASH' && (
          <p>
            Troco:{' '}
            <b>
              {order.needsChange
                ? `para ${money(order.changeForCents)} (estimado ${money(order.expectedChangeCents)})`
                : 'não precisa'}
            </b>
          </p>
        )}
        {order.fulfillment === 'DELIVERY' && order.address && (
          <div className="mt-4 rounded-xl bg-background p-4">
            <b>Endereço de entrega</b>
            <p>
              {order.address.street}, {order.address.number}
            </p>
            <p>{order.address.neighborhood}</p>
            <p>
              {order.address.city} - {order.address.state} · CEP {order.address.zipCode}
            </p>
            {order.address.complement && <p>Complemento: {order.address.complement}</p>}
            {order.address.reference && <p>Referência: {order.address.reference}</p>}
            <p className="mt-2">
              Taxa de entrega: <b>{money(order.deliveryFeeCents)}</b>
            </p>
          </div>
        )}
        {order.fulfillment === 'PICKUP' && (
          <div className="mt-4 rounded-xl bg-background p-4">
            <b>{order.restaurantId.address}</b>
            {order.restaurantId.mapUrl && (
              <a
                className="ml-3 font-bold text-accent underline"
                href={order.restaurantId.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver localização
              </a>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
