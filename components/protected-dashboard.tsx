'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthSession, clearSession, dashboardForRole, getSession, Role } from '../lib/auth';
import { apiUrl } from '../lib/api';

const content: Record<Role, { eyebrow: string; title: string; description: string }> = {
  SUPER_ADMIN: { eyebrow: 'ADMINISTRAÇÃO DA PLATAFORMA', title: 'Painel do administrador', description: 'Gerencie estabelecimentos, usuários e a operação da plataforma Menu Flow.' },
  RESTAURANT_ADMIN: { eyebrow: 'GESTÃO DO ESTABELECIMENTO', title: 'Painel da empresa', description: 'Acesse os recursos e dados exclusivos do seu estabelecimento.' },
  EMPLOYEE: { eyebrow: 'OPERAÇÃO DO ESTABELECIMENTO', title: 'Painel do funcionário', description: 'Acompanhe as tarefas e pedidos permitidos para o seu perfil.' },
  CUSTOMER: { eyebrow: 'MINHA CONTA', title: 'Área do cliente', description: 'Consulte seus pedidos, endereços e dados da sua conta.' },
};

export function ProtectedDashboard({ role }: { role: Role }) {
  const router = useRouter();
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace(`/login?returnTo=${encodeURIComponent(dashboardForRole[role])}`);
      return;
    }
    void (async () => {
      try {
        const response = await fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${current.accessToken}` } });
        const user = await response.json() as AuthSession['user'];
        if (!response.ok || !(user.role in dashboardForRole)) throw new Error('Invalid session');
        if (user.role !== role) { router.replace(dashboardForRole[user.role]); return; }
        setSession({ ...current, user });
      } catch { clearSession(); router.replace(`/login?returnTo=${encodeURIComponent(dashboardForRole[role])}`); }
    })();
  }, [role, router]);

  function logout() {
    clearSession();
    router.replace('/');
  }

  if (!session) return <main className="flex min-h-screen items-center justify-center p-6 text-stone-500">Verificando acesso…</main>;
  const panel = content[role];
  return <main className="min-h-screen bg-stone-100 p-5 sm:p-10"><section className="mx-auto max-w-5xl rounded-3xl bg-white p-7 shadow-soft sm:p-10"><header className="flex flex-col gap-5 border-b border-stone-200 pb-6 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black tracking-[0.2em] text-stone-500">MENU FLOW · {panel.eyebrow}</p><h1 className="mt-3 text-3xl font-black text-ink sm:text-4xl">{panel.title}</h1><p className="mt-3 max-w-xl leading-6 text-stone-600">{panel.description}</p></div><button type="button" onClick={logout} className="rounded-xl border border-stone-300 px-4 py-3 font-bold text-stone-700 hover:bg-stone-50">Sair</button></header>{role === 'SUPER_ADMIN' && <a href="/admin/restaurantes" className="mt-8 inline-block rounded-xl bg-ink px-5 py-3 font-black text-white">Gerenciar estabelecimentos</a>}<div className="mt-8 rounded-2xl bg-stone-50 p-6"><p className="font-bold">Olá, {session.user.name}.</p><p className="mt-2 text-sm leading-6 text-stone-600">Seu acesso está autenticado como <strong>{session.user.role}</strong>. As operações protegidas continuam sendo validadas pela API com JWT, papéis e isolamento por restaurante.</p></div></section></main>;
}
