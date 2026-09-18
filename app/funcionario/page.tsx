'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '../../components/AuthProvider';

const positionLabel: Record<string, string> = { WAITER: 'Garçom', KITCHEN: 'Cozinha', CASHIER: 'Caixa', MANAGER: 'Gerente', OTHER: 'Funcionário' };

export default function Page() {
  const { user } = useAuth();
  const router = useRouter();
  const salon = Boolean(user?.permissions?.includes('TABLES_VIEW') || ['KITCHEN','CASHIER'].includes(user?.employeePosition??''));

  useEffect(() => {
    if (salon) router.replace('/funcionario/mesas');
  }, [router, salon]);

  if (salon) return <section className="mx-auto max-w-5xl"><div className="h-40 animate-pulse rounded-3xl bg-stone-200" /></section>;

  return <section className="mx-auto max-w-5xl"><div className="rounded-3xl bg-ink p-7 text-white"><p className="text-sm font-bold text-lime">ÁREA OPERACIONAL · {positionLabel[user?.employeePosition??'OTHER']}</p><h2 className="mt-2 text-2xl font-black">Olá, {user?.name.split(' ')[0]}!</h2><p className="mt-2 text-stone-300">Acompanhe os pedidos do seu estabelecimento com segurança.</p></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Link href="/funcionario/pedidos" className="rounded-2xl bg-surface p-6 font-bold shadow-sm">Ver pedidos <span className="float-right">→</span></Link><Link href="/funcionario/conta" className="rounded-2xl bg-surface p-6 font-bold shadow-sm">Minha conta <span className="float-right">→</span></Link></div></section>;
}
