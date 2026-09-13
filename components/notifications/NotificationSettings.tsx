'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  defaultNotificationPreferences,
  ensureCurrentDeviceSubscription,
  getNotificationPreferences,
  hasActivePushSubscription,
  notificationPermission,
  sendTestPush,
  subscribeCurrentDevice,
  unsubscribeCurrentDevice,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationSettingsResponse,
} from '../../lib/notifications';

type PermissionState = NotificationPermission | 'unsupported';
const initialSettings: NotificationSettingsResponse = {
  ...defaultNotificationPreferences,
  deviceCount: 0,
  publicKey: null,
  pushAvailable: false,
};

export function NotificationSettings({ audience }: { audience: 'admin' | 'lojista' }) {
  const [settings, setSettings] = useState<NotificationSettingsResponse>(initialSettings);
  const [permission, setPermission] = useState<PermissionState>('default');
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const refreshDevice = useCallback(async () => {
    setPermission(notificationPermission());
    setDeviceSubscribed(await hasActivePushSubscription().catch(() => false));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let saved = await getNotificationPreferences();
      if (saved.enabled && saved.pushAvailable && notificationPermission() === 'granted') {
        await ensureCurrentDeviceSubscription().catch(() => undefined);
        saved = await getNotificationPreferences();
      }
      setSettings(saved);
      await refreshDevice();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar as preferências.');
    } finally { setLoading(false); }
  }, [refreshDevice]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const focus = () => { void refreshDevice(); };
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [refreshDevice]);

  const change = async (key: keyof NotificationPreferences, value: boolean) => {
    const before = settings;
    setSettings({ ...settings, [key]: value });
    setSaving(true); setMessage('');
    try {
      const saved = await updateNotificationPreferences({ [key]: value });
      setSettings(saved);
      window.dispatchEvent(new CustomEvent('menu-flow:notification-preferences', { detail: saved }));
      setMessage('Preferências salvas.');
    } catch (error) {
      setSettings(before);
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally { setSaving(false); }
  };

  const enableDevice = async () => {
    setSaving(true); setMessage('');
    try {
      if (!settings.pushAvailable) throw new Error('O OneSignal ainda não está disponível no servidor.');
      await subscribeCurrentDevice();
      setPermission(notificationPermission());
      setDeviceSubscribed(true);
      let next = await getNotificationPreferences();
      if (!next.enabled) next = await updateNotificationPreferences({ enabled: true });
      setSettings(next);
      window.dispatchEvent(new CustomEvent('menu-flow:notification-preferences', { detail: next }));
      setMessage('Notificações ativadas neste dispositivo. O OneSignal enviará a mensagem de boas-vindas na primeira inscrição.');
    } catch (error) {
      setPermission(notificationPermission());
      setMessage(error instanceof Error ? error.message : 'Não foi possível ativar as notificações.');
    } finally { setSaving(false); }
  };

  const disableDevice = async () => {
    setSaving(true); setMessage('');
    try {
      await unsubscribeCurrentDevice();
      setDeviceSubscribed(false);
      setSettings(await getNotificationPreferences());
      setMessage('Notificações desativadas neste dispositivo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível desativar neste dispositivo.');
    } finally { setSaving(false); }
  };

  const testDevice = async () => {
    setSaving(true); setMessage('');
    try {
      const result = await sendTestPush();
      setMessage(result.sent > 0 ? `Teste enviado para ${result.sent} dispositivo${result.sent === 1 ? '' : 's'}.` : 'Nenhum dispositivo ativo recebeu o teste.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível enviar o teste.');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="h-52 animate-pulse rounded-[28px] bg-stone-200" />;

  return (
    <div className="space-y-5">
      <section className="mf-panel rounded-[30px] p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.18em] text-primary">Central de notificações</p>
            <h2 className="mt-2 text-2xl font-black text-stone-900">Receber avisos do Menu Flow</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Pause ou ative todos os avisos desta conta sem interferir na atualização da tela de pedidos.</p>
          </div>
          <Toggle checked={settings.enabled} disabled={saving} onChange={(value) => void change('enabled', value)} label={settings.enabled ? 'Ativadas' : 'Desativadas'} />
        </div>
      </section>

      <section className="rounded-[30px] border border-border/90 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-stone-900">Notificações no celular ou PC</h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-stone-500">Ative o Push do OneSignal neste celular ou PC. Os avisos são enviados pelo sistema do aparelho, inclusive com o Menu Flow fechado; não usamos aviso interno do painel. A conta de cliente continua separada da conta do lojista.</p>
          </div>
          {settings.pushAvailable && <span className="whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">OneSignal conectado · {settings.deviceCount} {settings.deviceCount === 1 ? 'dispositivo' : 'dispositivos'}</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!settings.pushAvailable ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">O OneSignal ainda não está disponível no backend. Confirme a chave da API no Heroku e publique novamente.</p>
          ) : permission === 'denied' ? (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">O navegador bloqueou as notificações. Libere a permissão nas configurações do site e volte a esta tela.</p>
          ) : permission === 'unsupported' ? (
            <p className="rounded-2xl bg-stone-100 px-4 py-3 text-sm font-semibold text-stone-600">Este navegador ou modo de navegação não oferece notificações push.</p>
          ) : deviceSubscribed ? (
            <>
              <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">✓ Ativadas neste dispositivo</span>
              <button type="button" disabled={saving} onClick={() => void testDevice()} className="rounded-xl border border-border px-4 py-2.5 text-sm font-black text-stone-700 hover:bg-stone-50 disabled:opacity-50">Testar notificação</button>
              <button type="button" disabled={saving} onClick={() => void disableDevice()} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-50 disabled:opacity-50">Desativar neste dispositivo</button>
            </>
          ) : (
            <button type="button" disabled={saving} onClick={() => void enableDevice()} className="rounded-xl bg-primary px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">{saving ? 'Ativando…' : 'Ativar neste dispositivo'}</button>
          )}
        </div>
      </section>

      <section className="rounded-[30px] border border-border/90 bg-white p-5 shadow-sm sm:p-7">
        <h3 className="text-lg font-black text-stone-900">Quais avisos receber</h3>
        <p className="mt-1 text-sm text-stone-500">Escolha os eventos que realmente precisam chamar sua atenção.</p>
        <div className="mt-5 divide-y divide-border rounded-2xl border border-border">
          <PreferenceRow title="Novo pedido" description={audience === 'admin' ? 'Avisa quando qualquer estabelecimento receber um novo pedido.' : 'Avisa imediatamente quando sua loja receber um novo pedido.'} checked={settings.newOrder} disabled={!settings.enabled || saving} onChange={(value) => void change('newOrder', value)} />
          <PreferenceRow title="Pedido cancelado ou recusado" description="Avisa quando um pedido for cancelado ou recusado." checked={settings.orderCancelled} disabled={!settings.enabled || saving} onChange={(value) => void change('orderCancelled', value)} />
          <PreferenceRow title="Mudanças de status" description="Avisa sobre alterações como aceito, em preparo, pronto e finalizado." checked={settings.orderStatus} disabled={!settings.enabled || saving} onChange={(value) => void change('orderStatus', value)} />
        </div>
      </section>
      {message && <p className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-stone-600 shadow-sm" aria-live="polite">{message}</p>}
    </div>
  );
}

function PreferenceRow({title,description,checked,disabled,onChange}:{title:string;description:string;checked:boolean;disabled:boolean;onChange:(value:boolean)=>void}){
  return <label className={`flex cursor-pointer items-center justify-between gap-4 p-4 sm:p-5 ${disabled?'opacity-55':''}`}><span><span className="block font-black text-stone-900">{title}</span><span className="mt-1 block text-sm leading-5 text-stone-500">{description}</span></span><input type="checkbox" className="h-5 w-5 accent-primary" checked={checked} disabled={disabled} onChange={(event)=>onChange(event.target.checked)}/></label>
}
function Toggle({checked,disabled,onChange,label}:{checked:boolean;disabled:boolean;onChange:(value:boolean)=>void;label:string}){
  return <label className="inline-flex cursor-pointer items-center gap-3"><span className="text-sm font-black text-stone-700">{label}</span><input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event)=>onChange(event.target.checked)}/><span className="relative h-7 w-12 rounded-full bg-stone-300 transition peer-checked:bg-primary after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" /></label>
}
