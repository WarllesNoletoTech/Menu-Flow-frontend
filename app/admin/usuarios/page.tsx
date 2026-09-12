'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useState } from 'react';
import { PasswordField } from '../../../components/auth/PasswordField';
import type { Role } from '../../../lib/auth';
import { roleLabel } from '../../../lib/auth';
import { useDashboard } from '../../../components/dashboard/DashboardContext';

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  reportWhatsapp?: string;
  role: Role;
  active: boolean;
  deletedAt?: string | null;
  establishment?: string;
  createdAt: string;
};
type Result = { items: User[]; pagination: { page: number; pages: number; total: number } };
type UserForm = { name: string; email: string; phone: string; reportWhatsapp?: string; password: string; confirm: string };
type ModalType = 'edit' | 'password' | 'block' | 'delete' | 'detail';

export default function UsersPage() {
  const { request } = useDashboard();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState('Carregando usuários…');
  const [selected, setSelected] = useState<User>();
  const [modal, setModal] = useState<ModalType>();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<UserForm>({ name: '', email: '', phone: '', reportWhatsapp: '', password: '', confirm: '' });

  const load = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: '20', status });
    if (search) query.set('search', search);
    if (role) query.set('role', role);
    try {
      const value = await request<Result>(`/users?${query}`);
      setUsers(value.items);
      setPages(value.pagination.pages || 1);
      setTotal(value.pagination.total || 0);
      setMessage(value.items.length ? '' : 'Nenhum usuário encontrado com os filtros atuais.');
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Erro ao carregar usuários.');
    }
  }, [page, request, role, search, status]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  function open(user: User, next: ModalType) {
    setSelected(user);
    setModal(next);
    setError('');
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || '',
      reportWhatsapp: user.role === 'RESTAURANT_ADMIN' ? (user.reportWhatsapp || '') : undefined,
      password: '',
      confirm: '',
    });
  }

  async function action(path: string, method = 'PATCH', body?: unknown, label = 'Processando...') {
    setBusy(label);
    setError('');
    try {
      await request(path, { method, body: body ? JSON.stringify(body) : undefined });
      setModal(undefined);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir a operação.');
    } finally {
      setBusy('');
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    await action(`/users/${selected.id}`, 'PATCH', {
      name: form.name,
      email: form.email,
      phone: form.phone,
      ...(selected.role === 'RESTAURANT_ADMIN' ? { reportWhatsapp: form.reportWhatsapp } : {}),
    }, 'Salvando...');
  }

  async function password(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (form.password !== form.confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    await action(`/users/${selected.id}/password`, 'PATCH', { password: form.password }, 'Redefinindo...');
  }

  const activeVisible = users.filter((user) => !user.deletedAt && user.active).length;
  const blockedVisible = users.filter((user) => !user.deletedAt && !user.active).length;
  const deletedVisible = users.filter((user) => Boolean(user.deletedAt)).length;

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="mf-panel overflow-hidden rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.18em] text-primary">Acessos da plataforma</span>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-[2.35rem]">Usuários</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500 sm:text-base">Gerencie dados de acesso, situação da conta e redefinição de senha. O tipo de usuário e o estabelecimento vinculado permanecem protegidos.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Usuários encontrados" value={total} tone="primary" />
          <Metric label="Ativos nesta página" value={activeVisible} tone="success" />
          <Metric label="Bloqueados nesta página" value={blockedVisible} tone="warning" />
          <Metric label="Excluídos nesta página" value={deletedVisible} tone="neutral" />
        </div>
      </header>

      <div className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-accent">Busca e filtros</span>
            <h2 className="mt-3 text-xl font-black tracking-tight text-stone-900">Localizar usuários</h2>
          </div>
          <span className="rounded-2xl border border-border bg-background/55 px-4 py-2.5 text-sm font-semibold text-stone-600">Página {page} de {pages}</span>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(210px,.6fr)_minmax(210px,.6fr)]">
          <input aria-label="Buscar usuários" className="field !mt-0" placeholder="Buscar por nome ou e-mail" value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} />
          <select aria-label="Filtrar por tipo de usuário" className="field !mt-0" value={role} onChange={(event) => { setPage(1); setRole(event.target.value); }}>
            <option value="">Todos os tipos de usuário</option>
            {Object.entries(roleLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Filtrar por situação" className="field !mt-0" value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }}>
            <option value="all">Todas as situações</option>
            <option value="active">Ativos</option>
            <option value="blocked">Bloqueados</option>
            <option value="deleted">Excluídos</option>
          </select>
        </div>
      </div>

      {message && <p className="rounded-[22px] border border-border bg-surface px-4 py-3 text-sm font-semibold text-stone-700">{message}</p>}
      <div className="grid gap-4">
        {users.map((user) => (
          <article key={user.id} className="overflow-hidden rounded-[28px] border border-border/90 bg-white shadow-[0_12px_32px_rgba(41,37,36,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(41,37,36,.08)]">
            <div className="grid min-w-0 gap-5 p-5 sm:p-6 xl:grid-cols-[minmax(230px,1.25fr)_minmax(210px,1fr)_minmax(150px,.7fr)_minmax(180px,.8fr)_minmax(140px,.65fr)_auto] xl:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar user={user} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="break-words text-base font-black text-stone-900">{user.name}</h2>
                    <Status user={user} />
                  </div>
                  <p className="mt-1 break-all text-sm font-medium text-stone-500">{user.email}</p>
                  <p className="mt-2 text-xs text-stone-400">Cadastro em {new Date(user.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              <Info label="Contato" value={user.phone || 'Telefone não informado'} />
              <Info label="Tipo" value={roleLabel[user.role]} />
              <Info label="Estabelecimento" value={user.establishment || 'Não vinculado'} />
              <Info label="Situação" value={user.deletedAt ? 'Excluído' : user.active ? 'Ativo' : 'Bloqueado'} />

              <div className="flex flex-wrap gap-2 xl:max-w-[310px] xl:justify-end">
                {user.deletedAt ? (
                  <ActionButton primary onClick={() => void action(`/users/${user.id}/restore`, 'PATCH', undefined, 'Restaurando...')}>{busy ? 'Aguarde...' : 'Restaurar'}</ActionButton>
                ) : (
                  <>
                    <ActionButton onClick={() => open(user, 'edit')}>Editar</ActionButton>
                    <ActionButton onClick={() => open(user, 'block')}>{user.active ? 'Bloquear' : 'Desbloquear'}</ActionButton>
                    <ActionButton onClick={() => open(user, 'password')}>Redefinir senha</ActionButton>
                    <ActionButton danger onClick={() => open(user, 'delete')}>Excluir</ActionButton>
                  </>
                )}
                <ActionButton primary onClick={() => open(user, 'detail')}>Detalhes</ActionButton>
              </div>
            </div>
          </article>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-2xl border border-border bg-white px-4 text-sm font-black text-stone-700 shadow-sm disabled:opacity-40">← Anterior</button>
        <span className="text-center text-sm font-semibold text-stone-500">Página {page} de {pages}</span>
        <button disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-2xl border border-border bg-white px-4 text-sm font-black text-stone-700 shadow-sm disabled:opacity-40">Próxima →</button>
      </div>

      {modal && selected && (
        <Modal
          title={modal === 'edit' ? 'Editar usuário' : modal === 'password' ? 'Redefinir senha' : modal === 'detail' ? 'Detalhes do usuário' : modal === 'delete' ? `Excluir ${selected.name}?` : `${selected.active ? 'Bloquear' : 'Desbloquear'} ${selected.name}?`}
          close={() => setModal(undefined)}
          error={error}
        >
          {modal === 'edit' ? (
            <form onSubmit={save}><Fields form={form} set={setForm} /><Submit busy={busy} label="Salvar alterações" /></form>
          ) : modal === 'password' ? (
            <form onSubmit={password}>
              <label className="font-bold text-stone-800">Nova senha<PasswordField required minLength={8} autoComplete="new-password" className="field" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
              <label className="mt-4 block font-bold text-stone-800">Confirmar nova senha<PasswordField required minLength={8} autoComplete="new-password" className="field" value={form.confirm} onChange={(event) => setForm({ ...form, confirm: event.target.value })} /></label>
              <Submit busy={busy} label="Redefinir senha" />
            </form>
          ) : modal === 'detail' ? (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Info label="Nome" value={selected.name} />
              <Info label="E-mail" value={selected.email} />
              <Info label="Tipo" value={roleLabel[selected.role]} />
              <Info label="Estabelecimento" value={selected.establishment || 'Não vinculado'} />
              <Info label="Telefone" value={selected.phone || 'Não informado'} />
              <Info label="Situação" value={selected.deletedAt ? 'Excluído' : selected.active ? 'Ativo' : 'Bloqueado'} />
            </dl>
          ) : (
            <>
              <p className="text-sm leading-6 text-stone-600">{modal === 'delete' ? 'O acesso será removido, mas o histórico será preservado.' : selected.active ? 'O acesso deste usuário será interrompido até que ele seja desbloqueado.' : 'O usuário poderá entrar novamente após o desbloqueio.'}</p>
              <button disabled={!!busy} className={`mt-5 min-h-11 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-sm ${modal === 'delete' || selected.active ? 'bg-danger' : 'bg-ink'}`} onClick={() => void action(`/users/${selected.id}/${modal === 'delete' ? 'delete' : 'status'}`, 'PATCH', modal === 'block' ? { active: !selected.active } : undefined, modal === 'delete' ? 'Excluindo...' : selected.active ? 'Bloqueando...' : 'Desbloqueando...')}>{busy || 'Confirmar'}</button>
            </>
          )}
        </Modal>
      )}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'success' | 'warning' | 'neutral' }) {
  const toneClass = tone === 'success' ? 'bg-success/10 text-success' : tone === 'warning' ? 'bg-warning/10 text-warning' : tone === 'neutral' ? 'bg-stone-100 text-stone-600' : 'bg-primary/10 text-primary';
  return <article className="rounded-[24px] border border-border/90 bg-white p-5 shadow-[0_12px_30px_rgba(41,37,36,.05)]"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-stone-500">{label}</p><span className={`h-2.5 w-2.5 rounded-full ${toneClass.split(' ')[0]}`} /></div><strong className="mt-3 block text-[30px] font-black tracking-tight text-stone-900">{value}</strong></article>;
}

function Avatar({ user, small = false }: { user: User; small?: boolean }) {
  return <span className={`grid shrink-0 place-items-center bg-[linear-gradient(135deg,var(--mf-primary),#a65245)] font-black text-white shadow-sm ${small ? 'h-10 w-10 rounded-[13px] text-xs' : 'h-12 w-12 rounded-[16px] text-sm'}`}>{user.name.trim().charAt(0).toUpperCase() || 'U'}</span>;
}

function Status({ user }: { user: User }) {
  const config = user.deletedAt ? ['Excluído', 'bg-danger/10 text-danger'] : user.active ? ['Ativo', 'bg-success/10 text-success'] : ['Bloqueado', 'bg-warning/10 text-warning'];
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] ${config[1]}`}>{config[0]}</span>;
}

function RoleBadge({ role }: { role: Role }) {
  return <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[.12em] text-primary">{roleLabel[role]}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-[18px] border border-border bg-background/45 px-4 py-3 xl:border-transparent xl:bg-transparent xl:px-0 xl:py-0"><dt className="text-[10px] font-black uppercase tracking-[.13em] text-stone-400">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-stone-700">{value}</dd></div>;
}

function Fields({ form, set }: { form: UserForm; set: (value: UserForm) => void }) {
  return <div className="grid gap-4"><label className="font-bold text-stone-800">Nome<input required className="field" value={form.name} onChange={(event) => set({ ...form, name: event.target.value })} /></label><label className="font-bold text-stone-800">E-mail<input required type="email" className="field" value={form.email} onChange={(event) => set({ ...form, email: event.target.value })} /></label><label className="font-bold text-stone-800">Telefone<input className="field" value={form.phone} onChange={(event) => set({ ...form, phone: event.target.value })} /></label>{form.reportWhatsapp !== undefined && <label className="font-bold text-stone-800">WhatsApp para relatórios<input className="field" placeholder="(94) 99999-9999" value={form.reportWhatsapp} onChange={(event) => set({ ...form, reportWhatsapp: event.target.value })} /></label>}</div>;
}

function Submit({ busy, label }: { busy: string; label: string }) {
  return <button disabled={!!busy} className="mt-5 min-h-11 rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">{busy || label}</button>;
}

function Modal({ title, close, error, children }: { title: string; close: () => void; error: string; children: ReactNode }) {
  return <div className="fixed inset-0 z-[70] overflow-y-auto bg-stone-950/60 p-3 backdrop-blur-sm sm:p-6"><div role="dialog" aria-modal="true" className="mx-auto my-3 max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-[30px] border border-white/10 bg-surface p-5 shadow-2xl sm:my-8 sm:p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary">Gestão de acesso</span><h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">{title}</h2></div><button onClick={close} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-white font-bold text-stone-700">✕</button></div>{error && <p className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">{error}</p>}{children}</div></div>;
}

function ActionButton({ children, onClick, primary = false, danger = false }: { children: ReactNode; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return <button type="button" onClick={onClick} className={`min-h-10 rounded-2xl border px-3.5 py-2 text-xs font-black transition ${primary ? 'border-transparent bg-ink text-white hover:bg-primary-hover' : danger ? 'border-danger/15 bg-danger/10 text-danger hover:bg-danger/15' : 'border-border bg-white text-stone-700 hover:border-primary/20 hover:bg-primary/5'}`}>{children}</button>;
}
