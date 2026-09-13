'use client';
import { NotificationSettings } from '../../../components/notifications/NotificationSettings';
export default function Page(){return <section className="mx-auto max-w-5xl"><h2 className="text-2xl font-black">Notificações</h2><p className="mt-1 mb-5 text-stone-500">Configure os alertas administrativos de novos pedidos e alterações.</p><NotificationSettings audience="admin"/></section>}
