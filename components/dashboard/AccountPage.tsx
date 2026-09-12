'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { Role, User } from '../../lib/auth';
import { roleLabel } from '../../lib/auth';
import { useAuth } from '../AuthProvider';
import { useDashboard } from './DashboardContext';

export function AccountPage({ role, customer = false }: { role: Role; customer?: boolean }) {
  const { user, login } = useAuth();
  const { request } = useDashboard();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '', reportWhatsapp: user?.reportWhatsapp || '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => setForm({ name: user?.name || '', phone: user?.phone || '', reportWhatsapp: user?.reportWhatsapp || '' }), [user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage('Salvando alterações…');
    try {
      const updated = await request<User>(customer ? '/customer/me' : '/auth/me', { method: 'PATCH', body: JSON.stringify(form) });
      const session = (await import('../../lib/auth')).getSession();
      if (session) login({ ...session, user: { ...session.user, ...updated, role } });
      setMessage('Dados salvos com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  const initial = user?.name?.trim().charAt(0).toUpperCase() || 'U';

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="mf-panel rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-[linear-gradient(135deg,var(--mf-primary),#a65245)] text-xl font-black text-white shadow-sm">{initial}</span>
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-primary">Perfil e acesso</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-stone-900">Minha conta</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">Atualize seus dados pessoais usados no Menu Flow. E-mail e tipo de acesso são protegidos pelo sistema.</p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <form onSubmit={submit} className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
          <div className="border-b border-border pb-5">
            <h3 className="text-xl font-black tracking-tight text-stone-900">Dados pessoais</h3>
            <p className="mt-1 text-sm text-stone-500">Mantenha nome e telefone atualizados para facilitar o contato.</p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="font-bold text-stone-800">Nome
              <input required className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="font-bold text-stone-800">E-mail
              <input disabled className="field disabled:bg-background/80 disabled:text-stone-500" value={user?.email || ''} />
              <small className="mt-1 block font-normal text-stone-400">O e-mail de acesso não pode ser alterado nesta tela.</small>
            </label>
            <label className="font-bold text-stone-800">Telefone
              <input className="field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
            {role === 'RESTAURANT_ADMIN' && (
              <label className="font-bold text-stone-800">WhatsApp para relatórios
                <input required className="field" placeholder="(94) 99999-9999" value={form.reportWhatsapp} onChange={(event) => setForm({ ...form, reportWhatsapp: event.target.value })} />
              </label>
            )}
            <label className="font-bold text-stone-800">Tipo de acesso
              <input disabled className="field disabled:bg-background/80 disabled:text-stone-500" value={roleLabel[role]} />
            </label>
          </div>

          {message && <p aria-live="polite" className="mt-5 rounded-[20px] border border-border bg-background/55 p-3 text-sm font-semibold text-stone-700">{message}</p>}

          <div className="mt-6 flex justify-end border-t border-border pt-5">
            <button type="submit" disabled={saving} className="min-h-11 rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft disabled:translate-y-0 disabled:opacity-50">{saving ? 'Salvando…' : 'Salvar alterações'}</button>
          </div>
        </form>

        <aside className="space-y-5">
          <article className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
            <span className="inline-flex rounded-full bg-success/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-success">Conta ativa</span>
            <h3 className="mt-4 text-xl font-black tracking-tight text-stone-900">Resumo do acesso</h3>
            <dl className="mt-5 grid gap-3">
              <Info label="Nome" value={user?.name || '—'} />
              <Info label="Perfil" value={roleLabel[role]} />
              <Info label="E-mail" value={user?.email || '—'} />
            </dl>
          </article>

          <article className="rounded-[30px] border border-primary/10 bg-[linear-gradient(135deg,rgba(120,47,49,.08),rgba(212,123,75,.06))] p-5 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-primary">Segurança</p>
            <h3 className="mt-2 text-lg font-black tracking-tight text-stone-900">Proteja seu acesso</h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">Não compartilhe sua senha. Alterações de e-mail, perfil ou permissões devem ser feitas pela administração responsável.</p>
          </article>
        </aside>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[18px] border border-border bg-background/45 px-4 py-3"><dt className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">{label}</dt><dd className="mt-1 break-all text-sm font-semibold text-stone-700">{value}</dd></div>;
}
