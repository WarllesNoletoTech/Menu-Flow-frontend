'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../AuthProvider';
import { userMenuItems } from '../dashboard/config';

export function UserMenu({ returnTo = '/' }: { returnTo?: string }) {
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

  if (loading) return <span aria-label="Verificando sessão" className="inline-block h-11 w-28 animate-pulse rounded-xl bg-stone-200" />;
  if (!user) return <Link className="inline-block rounded-xl bg-ink px-5 py-3 text-sm font-black text-white transition hover:-translate-y-0.5" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Entrar</Link>;

  return <div className="relative inline-block w-fit" ref={menu}><button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-h-11 max-w-[11rem] items-center gap-2 rounded-xl bg-ink px-3 py-2 text-sm font-black text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:max-w-none sm:px-4 sm:py-3"><span aria-hidden>👤</span><span className="max-w-28 truncate">{user.name.split(' ')[0]}</span><span aria-hidden>⌄</span></button>{open && <div role="menu" className="absolute right-0 top-full z-[60] mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border bg-white p-2 text-ink shadow-soft">{userMenuItems(user.role).map((item) => <Link role="menuitem" key={item.href} href={item.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-bold hover:bg-stone-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink">{item.label}</Link>)}<button role="menuitem" className="w-full rounded-xl px-4 py-3 text-left text-sm font-bold text-red-700 hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700" onClick={() => { logout(); setOpen(false); router.replace(returnTo); }}>Sair</button></div>}</div>;
}
