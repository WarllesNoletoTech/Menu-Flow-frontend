'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { roleLabel } from '../../lib/auth';
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

  if (loading) return <span aria-label="Verificando sessão" className="inline-block h-12 w-32 animate-pulse rounded-2xl bg-stone-200" />;
  if (!user) return <Link className="inline-flex min-h-12 items-center rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft" href={`/login?returnTo=${encodeURIComponent(returnTo)}`}>Entrar</Link>;

  const initial = user.name?.trim().charAt(0).toUpperCase() || 'U';
  const firstName = user.name.trim().split(' ')[0];

  return (
    <div className="relative inline-block w-fit" ref={menu}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="group flex min-h-12 max-w-[14rem] items-center gap-2 rounded-[18px] border border-border/90 bg-white px-2.5 py-1.5 text-left shadow-[0_8px_24px_rgba(41,37,36,.07)] transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_12px_30px_rgba(41,37,36,.11)] sm:gap-3 sm:px-3"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(135deg,var(--mf-primary),#a65245)] text-sm font-black text-white shadow-sm">{initial}</span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm text-stone-900">{firstName}</strong>
          <small className="hidden truncate text-[11px] font-semibold text-stone-500 sm:block">{roleLabel[user.role]}</small>
        </span>
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-background text-xs text-stone-500 transition ${open ? 'rotate-180' : ''}`} aria-hidden>⌄</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-full z-[60] mt-2 w-[290px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border border-border bg-white text-ink shadow-[0_24px_70px_rgba(41,37,36,.18)]">
          <div className="border-b border-border bg-[linear-gradient(135deg,rgba(120,47,49,.08),rgba(212,123,75,.05))] p-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[15px] bg-primary text-sm font-black text-white shadow-sm">{initial}</span>
              <div className="min-w-0">
                <b className="block truncate text-sm text-stone-900">{user.name}</b>
                <span className="mt-0.5 block truncate text-xs font-semibold text-stone-500">{user.email || roleLabel[user.role]}</span>
              </div>
            </div>
            <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary shadow-sm">{roleLabel[user.role]}</span>
          </div>

          <div className="p-2.5">
            {userMenuItems(user.role).map((item) => (
              <Link role="menuitem" key={item.href} href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-[16px] px-3 py-3 text-sm font-black text-stone-700 transition hover:bg-background focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-background text-stone-500" aria-hidden>{item.href.includes('conta') ? '◯' : '→'}</span>
                <span>{item.label}</span>
              </Link>
            ))}
            <button role="menuitem" className="mt-1 flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left text-sm font-black text-danger transition hover:bg-danger/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-red-700" onClick={() => { logout(); setOpen(false); router.replace(returnTo); }}>
              <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-danger/10" aria-hidden>⇥</span>
              Sair da conta
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
