'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../../components/dashboard/DashboardContext';

type Data = { total: number; active: number; blocked: number; types: Record<string, number> };

export default function AdminPage() {
  const { request } = useDashboard();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    request<Data>('/users/dashboard').then(setData).catch((e) => setError(e.message));
  }, [request]);

  const activeRate = useMemo(() => data?.total ? Math.round((data.active / data.total) * 100) : 0, [data]);
  const typeEntries = data ? Object.entries(data.types ?? {}).sort((a, b) => b[1] - a[1]) : [];
  const typeLabel = (value: string) => ({ RESTAURANT: 'Restaurante', PHARMACY: 'Farmácia', CLOTHING: 'Vestuário', OTHER: 'Outros' } as Record<string, string>)[value] ?? value;

  return (
    <section>
      <div className="relative overflow-hidden rounded-[32px] border border-primary/15 bg-[linear-gradient(135deg,#6d292b_0%,#843438_55%,#9a4b3d_100%)] px-6 py-7 text-white shadow-[0_24px_70px_rgba(120,47,49,.20)] sm:px-8 sm:py-9 xl:px-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-[20%] h-32 w-32 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.2em] text-orange-100 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-300" /> Central Menu Flow
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Visão geral da plataforma</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">Acompanhe a saúde da operação, estabelecimentos e acessos administrativos em um só lugar.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/restaurantes" className="inline-flex min-h-11 items-center rounded-[16px] bg-white px-4 text-sm font-black text-primary shadow-sm hover:bg-orange-50">Gerenciar estabelecimentos</Link>
            <Link href="/admin/pedidos" className="inline-flex min-h-11 items-center rounded-[16px] border border-white/20 bg-white/10 px-4 text-sm font-black text-white backdrop-blur hover:bg-white/15">Ver pedidos</Link>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="mt-5 rounded-[18px] border border-danger/20 bg-danger/10 p-4 font-semibold text-danger">{error}</p>}

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Total de estabelecimentos" value={data?.total ?? '—'} icon="store" helper="Cadastrados na plataforma" />
        <MetricCard label="Estabelecimentos ativos" value={data?.active ?? '—'} icon="active" helper={`${activeRate}% da base ativa`} accent />
        <MetricCard label="Estabelecimentos bloqueados" value={data?.blocked ?? '—'} icon="blocked" helper="Requerem atenção" danger={Boolean(data?.blocked)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <article className="rounded-[28px] border border-border/90 bg-white p-5 shadow-[0_14px_40px_rgba(41,37,36,.06)] sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.18em] text-accent">Distribuição</p>
              <h3 className="mt-1 text-xl font-black tracking-tight">Estabelecimentos por tipo</h3>
            </div>
            <Link href="/admin/tipos-estabelecimento" className="text-sm font-black text-primary hover:underline">Gerenciar tipos →</Link>
          </div>

          <div className="mt-5 space-y-4">
            {typeEntries.length ? typeEntries.map(([label, value]) => {
              const width = data?.total ? Math.max(6, Math.round((value / data.total) * 100)) : 0;
              return <div key={label}>
                <div className="flex items-center justify-between gap-3 text-sm"><span className="font-bold text-stone-700">{typeLabel(label)}</span><b>{value}</b></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} /></div>
              </div>;
            }) : <div className="rounded-[22px] bg-background/70 px-5 py-8 text-center text-sm font-semibold text-stone-500">Nenhum tipo com dados disponíveis.</div>}
          </div>
        </article>

        <article className="rounded-[28px] border border-border/90 bg-white p-5 shadow-[0_14px_40px_rgba(41,37,36,.06)] sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[.18em] text-accent">Acesso rápido</p>
          <h3 className="mt-1 text-xl font-black tracking-tight">Administração</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <QuickLink href="/admin/restaurantes" title="Estabelecimentos" description="Cadastros, situação e dados das lojas." />
            <QuickLink href="/admin/usuarios" title="Usuários" description="Contas e permissões da plataforma." />
            <QuickLink href="/admin/banners" title="Banners da página inicial" description="Campanhas e comunicação visual." />
            <QuickLink href="/admin/cobrancas" title="Cobranças" description="Mensalidades e acompanhamento financeiro." />
          </div>
        </article>
      </div>
    </section>
  );
}

function MetricCard({ label, value, icon, helper, accent = false, danger = false }: { label: string; value: number | string; icon: 'store' | 'active' | 'blocked'; helper: string; accent?: boolean; danger?: boolean }) {
  return <article className={`relative overflow-hidden rounded-[26px] border bg-white p-5 shadow-[0_12px_34px_rgba(41,37,36,.055)] ${accent ? 'border-success/20' : danger ? 'border-danger/20' : 'border-border/90'}`}>
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-stone-500">{label}</p>
        <strong className="mt-3 block text-[34px] font-black tracking-tight text-stone-900">{value}</strong>
        <p className={`mt-2 text-xs font-semibold ${accent ? 'text-success' : danger ? 'text-danger' : 'text-stone-400'}`}>{helper}</p>
      </div>
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-[16px] ${accent ? 'bg-success/10 text-success' : danger ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}><MetricIcon type={icon} /></span>
    </div>
  </article>;
}

function QuickLink({ href, title, description }: { href: string; title: string; description: string }) {
  return <Link href={href} className="group flex items-center justify-between gap-4 rounded-[20px] border border-border/90 bg-background/45 p-4 transition hover:border-primary/20 hover:bg-primary/[.045]">
    <span><b className="block text-sm text-stone-800">{title}</b><small className="mt-1 block leading-5 text-stone-500">{description}</small></span>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm transition group-hover:translate-x-0.5">→</span>
  </Link>;
}

function MetricIcon({ type }: { type: 'store' | 'active' | 'blocked' }) {
  if (type === 'active') return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 4 4L19 6"/><circle cx="12" cy="12" r="9"/></svg>;
  if (type === 'blocked') return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="m8 8 8 8"/></svg>;
  return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l2-5h14l2 5M5 9v11h14V9M8 20v-6h8v6"/></svg>;
}
