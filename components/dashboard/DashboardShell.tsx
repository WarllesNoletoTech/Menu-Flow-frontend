'use client';

import Link from 'next/link';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Role } from '../../lib/auth';
import { roleLabel } from '../../lib/auth';
import { useAuth } from '../AuthProvider';
import { DashboardProvider } from './DashboardContext';
import { dashboardMenus, panelNames, type DashboardItem } from './config';
import { BrandLogo } from '../BrandLogo';

type Props = {
  role: Role;
  children: ReactNode;
  establishment?: { name: string; slug?: string } | null;
  extraItems?: DashboardItem[];
  pendingOrders?: number;
  unreadBillingReports?: number;
};

export function DashboardShell({
  role,
  children,
  establishment,
  extraItems = [],
  pendingOrders = 0,
  unreadBillingReports = 0,
}: Props) {
  const [mobile, setMobile] = useState(false);
  const close = useCallback(() => setMobile(false), []);

  return (
    <DashboardProvider>
      <div className="min-h-[100dvh] min-w-0 bg-[radial-gradient(circle_at_top_right,rgba(212,123,75,.10),transparent_25%),radial-gradient(circle_at_bottom_left,rgba(120,47,49,.055),transparent_24%),var(--mf-background)] lg:pl-[286px]">
        <DashboardSidebar
          role={role}
          open={mobile}
          close={close}
          establishment={establishment}
          extraItems={extraItems}
          pendingOrders={pendingOrders}
          unreadBillingReports={unreadBillingReports}
        />
        <DashboardHeader role={role} open={mobile} toggle={() => setMobile((value) => !value)} establishment={establishment} />
        <main className="min-w-0 px-4 pb-8 pt-4 sm:px-6 sm:pb-10 sm:pt-5 xl:px-8 xl:pb-12">
          <div className="mx-auto w-full max-w-[1540px]">{children}</div>
        </main>
      </div>
    </DashboardProvider>
  );
}

function DashboardSidebar({
  role,
  open,
  close,
  establishment,
  extraItems,
  pendingOrders,
  unreadBillingReports,
}: {
  role: Role;
  open: boolean;
  close: () => void;
  establishment?: { name: string; slug?: string } | null;
  extraItems: DashboardItem[];
  pendingOrders: number;
  unreadBillingReports: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [close]);

  const items = [...dashboardMenus[role], ...extraItems];
  const active = (href: string) =>
    href === '/' ? false : href === dashboardFor(role) ? pathname === href : pathname.startsWith(href);

  const workspaceLabel = role === 'SUPER_ADMIN'
    ? 'Central de gestão'
    : role === 'CUSTOMER'
      ? 'Área do cliente'
      : 'Área da operação';
  const workspaceDescription = role === 'SUPER_ADMIN'
    ? 'Administre toda a plataforma Menu Flow.'
    : role === 'CUSTOMER'
      ? 'Pedidos, endereços e dados da sua conta.'
      : 'Gerencie sua operação em um só lugar.';

  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu"
        className={`fixed inset-0 z-40 bg-stone-950/55 backdrop-blur-sm lg:hidden ${open ? 'block' : 'hidden'}`}
        onClick={close}
      />
      <aside
        aria-label={`Navegação: ${panelNames[role]}`}
        className={`fixed inset-y-0 left-0 z-50 flex w-[286px] max-w-[88vw] flex-col overflow-y-auto border-r border-white/5 bg-[linear-gradient(180deg,#211a18_0%,#171210_100%)] px-4 py-5 text-white shadow-[18px_0_55px_rgba(0,0,0,.18)] transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-2">
          <Link href={dashboardFor(role)} onClick={close} aria-label="Menu Flow — início do painel" className="inline-flex rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent">
            <BrandLogo variant="wordmark" priority className="w-[178px]" />
          </Link>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10 bg-white/[.055] p-4 shadow-inner shadow-black/10">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-accent">{workspaceLabel}</p>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,.08)]" />
            </div>
            <p className="mt-2 truncate text-sm font-black text-white">{establishment?.name || panelNames[role]}</p>
            <p className="mt-1 text-xs leading-5 text-stone-400">{workspaceDescription}</p>
          </div>
        </div>

        <div className="mt-6 px-3 text-[10px] font-black uppercase tracking-[.2em] text-stone-500">Menu principal</div>
        <nav className="mt-2 flex-1 space-y-1.5">
          {items.map((item) => {
            const badgeCount = item.label === 'Pedidos'
              ? pendingOrders
              : item.label === 'Faturamento'
                ? unreadBillingReports
                : 0;
            const badgeLabel = item.label === 'Pedidos'
              ? `${badgeCount} pedidos aguardando`
              : `${badgeCount} relatórios novos`;
            const isActive = active(item.href);

            return (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                onClick={close}
                target={item.external ? '_blank' : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative flex min-h-11 items-center gap-3 rounded-[16px] px-3 py-2.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${isActive ? 'bg-white/[.11] text-white shadow-sm ring-1 ring-white/10' : 'text-stone-300 hover:bg-white/[.065] hover:text-white'}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] transition ${isActive ? 'bg-accent text-white shadow-sm' : 'bg-white/[.055] text-stone-400 group-hover:bg-white/[.09] group-hover:text-accent'}`} aria-hidden>
                  <NavigationIcon label={item.label} fallback={item.icon} />
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badgeCount > 0 && (
                  <span className="grid min-h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[10px] font-black text-white shadow-sm" aria-label={badgeLabel}>
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-5 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => { logout(); router.replace('/'); }}
            className="group flex min-h-11 w-full items-center gap-3 rounded-[16px] px-3 text-sm font-bold text-stone-300 transition hover:bg-danger/10 hover:text-white"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-white/[.055] text-stone-400 group-hover:bg-danger/15 group-hover:text-red-300" aria-hidden>⇥</span>
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

function DashboardHeader({
  role,
  open,
  toggle,
  establishment,
}: {
  role: Role;
  open: boolean;
  toggle: () => void;
  establishment?: { name: string; slug?: string } | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setMenu(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false);
    };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', click);
      document.removeEventListener('keydown', key);
    };
  }, []);

  if (!user) return null;
  const items = dashboardMenus[role];
  const title = items
    .filter((item) => !item.external && (item.href === dashboardFor(role) ? pathname === item.href : pathname.startsWith(item.href)))
    .sort((a, b) => b.href.length - a.href.length)[0]?.label || panelNames[role];
  const publicLabel = role === 'SUPER_ADMIN' ? 'Abrir portal público' : role === 'CUSTOMER' ? 'Explorar estabelecimentos' : 'Abrir minha loja';
  const account = `${dashboardFor(role)}/conta`;
  const initial = user.name?.trim().charAt(0).toUpperCase() || 'U';

  return (
    <header className="relative z-30 border-b border-border/70 bg-surface/55">
      <div className="mx-auto flex min-h-[86px] w-full max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={toggle}
            className="grid h-11 w-11 place-items-center rounded-[15px] border border-border bg-white text-lg text-stone-700 shadow-sm lg:hidden"
          >
            ☰
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-stone-400">
              <span>{panelNames[role]}</span>
              <span className="h-1 w-1 rounded-full bg-stone-300" />
              <span className="hidden truncate sm:inline">{establishment?.name || (role === 'SUPER_ADMIN' ? 'Menu Flow' : roleLabel[user.role])}</span>
            </div>
            <h1 className="mt-1 truncate text-xl font-black tracking-tight text-stone-900 sm:text-[24px]">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {role === 'RESTAURANT_ADMIN' && establishment?.slug && (
            <Link href={`/${establishment.slug}`} className="hidden min-h-11 items-center gap-2 rounded-[16px] border border-border bg-white px-4 text-sm font-black text-stone-700 shadow-sm transition hover:border-primary/20 hover:bg-primary/5 md:inline-flex">
              Ver loja <span aria-hidden>↗</span>
            </Link>
          )}
          {role === 'SUPER_ADMIN' && (
            <Link href="/" className="hidden min-h-11 items-center gap-2 rounded-[16px] border border-border bg-white px-4 text-sm font-black text-stone-700 shadow-sm transition hover:border-primary/20 hover:bg-primary/5 md:inline-flex">
              Portal público <span aria-hidden>↗</span>
            </Link>
          )}

          <div className="relative" ref={ref}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
              className="group flex min-h-12 items-center gap-2 rounded-[18px] border border-border/90 bg-white px-2.5 py-1.5 text-left shadow-[0_8px_24px_rgba(41,37,36,.06)] transition hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_12px_28px_rgba(41,37,36,.10)] sm:gap-3 sm:px-3"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[linear-gradient(135deg,var(--mf-primary),#a65245)] text-sm font-black text-white shadow-sm">{initial}</span>
              <span className="hidden max-w-48 sm:block">
                <strong className="block truncate text-sm text-stone-900">{user.name}</strong>
                <small className="mt-0.5 block truncate text-[11px] font-semibold text-stone-500">{roleLabel[user.role]}</small>
              </span>
              <span className={`grid h-7 w-7 place-items-center rounded-lg bg-background text-xs text-stone-500 transition ${menu ? 'rotate-180' : ''}`} aria-hidden>⌄</span>
            </button>

            {menu && (
              <div role="menu" className="absolute right-0 z-40 mt-2 w-[290px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[24px] border border-border bg-white shadow-[0_24px_70px_rgba(41,37,36,.18)]">
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
                  <MenuItem href={account} onClick={() => setMenu(false)} icon="user">Minha conta</MenuItem>
                  <MenuItem href={establishment?.slug ? `/${establishment.slug}` : '/'} onClick={() => setMenu(false)} icon="external">{publicLabel}</MenuItem>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { logout(); router.replace('/'); }}
                    className="mt-1 flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left text-sm font-black text-danger transition hover:bg-danger/10"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-danger/10" aria-hidden>⇥</span>
                    Sair da conta
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function MenuItem({ href, onClick, icon, children }: { href: string; onClick: () => void; icon: 'user' | 'external'; children: ReactNode }) {
  return (
    <Link role="menuitem" href={href} onClick={onClick} className="flex items-center gap-3 rounded-[16px] px-3 py-3 text-sm font-black text-stone-700 transition hover:bg-background">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-background text-stone-500" aria-hidden>
        {icon === 'external' ? '↗' : '◯'}
      </span>
      <span>{children}</span>
    </Link>
  );
}

function NavigationIcon({ label, fallback }: { label: string; fallback: string }) {
  const common = 'h-[17px] w-[17px]';
  if (/visão/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 13h6V4H4v9Zm10 7h6V11h-6v9ZM4 20h6v-3H4v3Zm10-13h6V4h-6v3Z" /></svg>;
  if (/pedido/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>;
  if (/cardápio|produto/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="7" cy="5" r="1" fill="currentColor"/><circle cx="7" cy="12" r="1" fill="currentColor"/><circle cx="7" cy="19" r="1" fill="currentColor"/></svg>;
  if (/estabelecimento|empresa|loja/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l2-5h14l2 5"/><path d="M5 9v11h14V9M8 20v-6h8v6"/><path d="M3 9c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0"/></svg>;
  if (/banner/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 15 3-3 3 3 2-2 3 3"/><circle cx="8" cy="9" r="1"/></svg>;
  if (/usuário|funcionário|conta/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-5 4-7 8-7s7 2 8 7"/></svg>;
  if (/horário/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
  if (/faturamento|cobrança/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></svg>;
  if (/configura|tipo/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.3 3.1a7 7 0 0 0-1.8 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2L3 14.5l2 3.4 2.4-1a7 7 0 0 0 1.8 1l.3 3.1h4.8l.3-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/></svg>;
  if (/integra/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 7H5a2 2 0 0 0-2 2v10h10a2 2 0 0 0 2-2v-3M16 17h3a2 2 0 0 0 2-2V5H11a2 2 0 0 0-2 2v3"/><path d="m8 12 8-8M13 4h3v3"/></svg>;
  if (/portal|ver loja/i.test(label)) return <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 5h5v5M10 14 19 5"/><path d="M19 13v6H5V5h6"/></svg>;
  return <span className="text-xs font-black">{fallback}</span>;
}

function dashboardFor(role: Role) {
  return role === 'SUPER_ADMIN' ? '/admin' : role === 'EMPLOYEE' ? '/funcionario' : role === 'CUSTOMER' ? '/cliente' : '/empresa';
}
