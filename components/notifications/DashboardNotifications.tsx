'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Role } from '../../lib/auth';
import { useOrderSocket } from '../../lib/order-socket';
import { defaultNotificationPreferences, ensureCurrentDeviceSubscription, getNotificationPreferences, hasActivePushSubscription, notificationPermission, showSystemNotification, type NotificationPreferences } from '../../lib/notifications';

type OrderEvent = { orderNumber?: string; totalCents?: number; total?: number; fulfillment?: string; status?: string; restaurantName?: string };

export function DashboardNotifications({ role }: { role: Role }) {
  const preferences = useRef<NotificationPreferences>(defaultNotificationPreferences);
  const [toast, setToast] = useState<{title:string;body:string;url:string}|null>(null);

  useEffect(() => {
    if (role !== 'SUPER_ADMIN' && role !== 'RESTAURANT_ADMIN') return;
    const refresh = () => {
      void getNotificationPreferences().then(async (value) => {
        preferences.current = value;
        if (value.enabled && value.pushAvailable && value.publicKey && notificationPermission() === 'granted') {
          await ensureCurrentDeviceSubscription(value.publicKey).catch(() => undefined);
        }
      }).catch(() => undefined);
    };
    refresh();
    const changed = (event: Event) => { preferences.current = (event as CustomEvent<NotificationPreferences>).detail; };
    window.addEventListener('menu-flow:notification-preferences', changed);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('menu-flow:notification-preferences', changed);
      window.removeEventListener('focus', refresh);
    };
  }, [role]);

  const notify = useCallback((title:string,body:string,url:string,tag:string) => {
    setToast({title,body,url});
    window.setTimeout(() => setToast((current) => current?.body === body ? null : current), 6500);
    void hasActivePushSubscription()
      .then((active) => {
        if (!active) return showSystemNotification(title, { body, tag, icon: '/assets/branding/menu-flow-icon-192.png', badge: '/assets/branding/menu-flow-symbol.png', url });
        return false;
      })
      .catch(() => undefined);
  }, []);

  useOrderSocket(useCallback((event, raw) => {
    if (role !== 'SUPER_ADMIN' && role !== 'RESTAURANT_ADMIN') return;
    const prefs = preferences.current;
    if (!prefs.enabled) return;
    const order = (raw || {}) as OrderEvent;
    const urlBase = role === 'SUPER_ADMIN' ? '/admin/pedidos' : '/empresa/pedidos';
    const number = order.orderNumber || 'Novo pedido';
    if (event === 'created' && prefs.newOrder) {
      const cents = Number.isFinite(order.totalCents) ? Number(order.totalCents) : Math.round(Number(order.total || 0) * 100);
      const total = (cents / 100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
      const service = order.fulfillment === 'DELIVERY' ? 'Entrega' : 'Retirada';
      const title = role === 'SUPER_ADMIN' && order.restaurantName ? `Novo pedido • ${order.restaurantName}` : 'Novo pedido recebido';
      notify(title, `${number} • ${total} • ${service}`, `${urlBase}?status=pending`, `new-${number}`);
      return;
    }
    if (event === 'updated') {
      if ((order.status === 'CANCELLED' || order.status === 'REJECTED') && prefs.orderCancelled) notify('Pedido cancelado', `${number} foi cancelado ou recusado.`, `${urlBase}?status=cancelled`, `cancelled-${number}`);
      else if (prefs.orderStatus) notify('Pedido atualizado', `${number} teve o status atualizado.`, urlBase, `status-${number}-${order.status || ''}`);
    }
  }, [notify, role]));

  if (!toast) return null;
  return <a href={toast.url} className="fixed bottom-5 right-5 z-[90] w-[min(390px,calc(100vw-2rem))] rounded-[22px] border border-border bg-white p-4 shadow-[0_18px_60px_rgba(0,0,0,.18)]"><div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-xl">🔔</span><span className="min-w-0"><strong className="block text-sm font-black text-stone-900">{toast.title}</strong><span className="mt-1 block text-sm leading-5 text-stone-600">{toast.body}</span><span className="mt-2 block text-xs font-black text-primary">Abrir pedidos →</span></span></div></a>;
}
