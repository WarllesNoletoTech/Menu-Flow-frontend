'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { Role } from '../../lib/auth';
import { useAuth } from '../AuthProvider';

const links: Record<Role, Array<{ label: string; href: string }>> = {
  CUSTOMER: [{ label: 'Minha conta', href: '/cliente/conta' }, { label: 'Meus pedidos', href: '/cliente/pedidos' }, { label: 'Meus endereços', href: '/cliente/enderecos' }],
  RESTAURANT_ADMIN: [{ label: 'Minha conta', href: '/empresa#conta' }, { label: 'Painel da loja', href: '/empresa' }, { label: 'Pedidos e catálogo', href: '/empresa#operacao' }, { label: 'Funcionários e configurações', href: '/empresa#configuracoes' }],
  EMPLOYEE: [{ label: 'Minha conta', href: '/funcionario/conta' }, { label: 'Painel do funcionário', href: '/funcionario' }, { label: 'Pedidos permitidos', href: '/funcionario/pedidos' }],
  SUPER_ADMIN: [{ label: 'Minha conta', href: '/admin/conta' }, { label: 'Painel administrativo', href: '/admin' }, { label: 'Estabelecimentos', href: '/admin/restaurantes' }],
};

export function UserMenu({ returnTo = '/', className = '' }: { returnTo?: string; className?: string }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!menu.current?.contains(event.target as Node)) setOpen(false); };
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', keyboard); };
  }, []);

  if (loading) return <span aria-label="Verificando sessão" className={`h-11 w-28 animate-pulse rounded-xl bg-stone-200 ${className}`} />;
  if (!user) return <Link className={`rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5 ${className}`} href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Entrar</Link>;

  return <div className={`relative ${className}`} ref={menu}><button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-black text-white"><span aria-hidden>👤</span><span className="max-w-28 truncate">{user.name.split(' ')[0]}</span><span aria-hidden>⌄</span></button>{open && <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-2xl border bg-white p-2 text-ink shadow-soft">{links[user.role].map((item) => <Link role="menuitem" key={item.label} href={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-bold hover:bg-stone-100">{item.label}</Link>)}<button role="menuitem" className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-50" onClick={() => { logout(); setOpen(false); router.replace(returnTo); }}>Sair</button></div>}</div>;
}
