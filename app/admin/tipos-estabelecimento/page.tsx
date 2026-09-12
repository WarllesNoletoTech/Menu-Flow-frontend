'use client';

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../../../lib/api';
import { clearSession, getSession } from '../../../lib/auth';

type Item = { id: string; name: string; slug: string; active: boolean; sortOrder: number; usageCount: number };

type FormState = { name: string; active: boolean; sortOrder: number };

export default function EstablishmentTypesPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>();
  const [deleting, setDeleting] = useState<Item | null>();
  const [form, setForm] = useState<FormState>({ name: '', active: true, sortOrder: 0 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const session = getSession();
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      clearSession();
      router.replace('/login?returnTo=/admin/tipos-estabelecimento');
      throw new Error('Sua sessão expirou.');
    }
    const response = await fetch(apiUrl(path), {
      ...init,
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
    const data = await response.json().catch(() => null) as { message?: string | string[] } | null;
    if (response.status === 401) {
      clearSession();
      router.replace('/login?returnTo=/admin/tipos-estabelecimento');
    }
    if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message[0] : data?.message || 'Não foi possível concluir a operação.');
    return data;
  }, [router]);

  const load = useCallback(() => request('/establishment-types')
    .then((data) => setItems(data as unknown as Item[]))
    .catch((cause) => setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os tipos.')), [request]);

  useEffect(() => { void load(); }, [load]);

  function open(item?: Item) {
    setEditing(item ?? null);
    setForm(item ? { name: item.name, active: item.active, sortOrder: item.sortOrder } : { name: '', active: true, sortOrder: 0 });
    setError('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await request(editing ? `/establishment-types/${editing.id}` : '/establishment-types', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setEditing(undefined);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: Item) {
    setError('');
    try {
      await request(`/establishment-types/${item.id}`, { method: 'PATCH', body: JSON.stringify({ active: !item.active }) });
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar.');
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await request(`/establishment-types/${deleting.id}`, { method: 'DELETE' });
      setDeleting(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível excluir.');
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((item) => item.active).length,
    inactive: items.filter((item) => !item.active).length,
    inUse: items.filter((item) => item.usageCount > 0).length,
  }), [items]);

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="mf-panel rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.18em] text-primary">Configurações da plataforma</span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-[2.35rem]">Tipos de estabelecimento</h1>
            <p className="mt-2 text-sm leading-6 text-stone-500 sm:text-base">Defina os tipos exibidos no cadastro de novas empresas e também nos filtros do portal público.</p>
          </div>
          <button onClick={() => open()} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">+ Novo tipo</button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Tipos cadastrados" value={stats.total} tone="primary" />
          <Metric label="Ativos" value={stats.active} tone="success" />
          <Metric label="Inativos" value={stats.inactive} tone="neutral" />
          <Metric label="Em uso" value={stats.inUse} tone="gold" />
        </div>
      </header>

      {error && <p role="alert" className="rounded-[22px] border border-danger/20 bg-danger/10 p-4 text-sm font-bold text-danger">{error}</p>}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_42px_rgba(41,37,36,.08)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.15em] text-accent">Categoria pública</span>
                <h2 className="mt-3 break-words text-xl font-black tracking-tight text-stone-900">{item.name}</h2>
                <p className="mt-1 text-sm font-semibold text-stone-400">/{item.slug}</p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] ${item.active ? 'bg-success/10 text-success' : 'bg-stone-100 text-stone-600'}`}>{item.active ? 'Ativo' : 'Inativo'}</span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <Info label="Estabelecimentos" value={String(item.usageCount)} />
              <Info label="Ordem" value={String(item.sortOrder)} />
            </div>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
              <ActionButton onClick={() => open(item)}>Editar</ActionButton>
              <ActionButton onClick={() => void toggle(item)}>{item.active ? 'Desativar' : 'Ativar'}</ActionButton>
              <ActionButton
                danger={!item.usageCount}
                muted={Boolean(item.usageCount)}
                onClick={() => item.usageCount ? setError(`Este tipo está sendo utilizado por ${item.usageCount} estabelecimentos e não pode ser excluído. Desative-o em vez disso.`) : setDeleting(item)}
              >
                Excluir
              </ActionButton>
            </div>
          </article>
        ))}
      </div>

      {!items.length && !error && (
        <div className="rounded-[30px] border border-dashed border-border bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-2xl font-black tracking-tight text-stone-900">Nenhum tipo cadastrado</h2>
          <p className="mt-2 text-stone-500">Crie o primeiro tipo para organizar os estabelecimentos da plataforma.</p>
        </div>
      )}

      {editing !== undefined && (
        <Modal close={() => setEditing(undefined)} title={editing ? 'Editar tipo de estabelecimento' : 'Novo tipo de estabelecimento'}>
          <form onSubmit={save}>
            <label className="font-bold text-stone-800">Nome
              <input autoFocus required className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="font-bold text-stone-800">Situação
                <select className="field" value={form.active ? 'active' : 'inactive'} onChange={(event) => setForm({ ...form, active: event.target.value === 'active' })}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </label>
              <label className="font-bold text-stone-800">Ordem de exibição
                <input type="number" min="0" required className="field" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setEditing(undefined)} className="min-h-11 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-black text-stone-700">Cancelar</button>
              <button disabled={busy} className="min-h-11 rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">{busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar tipo'}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal close={() => setDeleting(null)} title="Excluir tipo de estabelecimento?">
          <div className="rounded-[22px] border border-border bg-background/55 p-4">
            <p className="text-lg font-black text-stone-900">{deleting.name}</p>
            <p className="mt-2 text-sm leading-6 text-stone-600">Tem certeza de que deseja excluir este tipo? Esta ação não poderá ser desfeita.</p>
          </div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button onClick={() => setDeleting(null)} className="min-h-11 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-black text-stone-700">Voltar</button>
            <button disabled={busy} onClick={() => void remove()} className="min-h-11 rounded-2xl bg-danger px-5 py-3 text-sm font-black text-white shadow-sm disabled:opacity-50">Excluir tipo</button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'success' | 'neutral' | 'gold' }) {
  const toneClass = tone === 'success' ? 'bg-success/10 text-success' : tone === 'gold' ? 'bg-gold/20 text-amber-700' : tone === 'neutral' ? 'bg-stone-100 text-stone-600' : 'bg-primary/10 text-primary';
  return <article className="rounded-[24px] border border-border/90 bg-white p-5 shadow-[0_12px_30px_rgba(41,37,36,.05)]"><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold text-stone-500">{label}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.15em] ${toneClass}`}>Resumo</span></div><strong className="mt-3 block text-[30px] font-black tracking-tight text-stone-900">{value}</strong></article>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[18px] border border-border bg-background/45 px-4 py-3"><span className="block text-[10px] font-black uppercase tracking-[.13em] text-stone-400">{label}</span><b className="mt-1 block text-lg text-stone-800">{value}</b></div>;
}

function ActionButton({ children, onClick, danger = false, muted = false }: { children: ReactNode; onClick: () => void; danger?: boolean; muted?: boolean }) {
  return <button type="button" onClick={onClick} className={`min-h-10 rounded-2xl border px-4 py-2 text-xs font-black transition ${danger ? 'border-danger/15 bg-danger/10 text-danger hover:bg-danger/15' : muted ? 'border-border bg-stone-50 text-stone-400' : 'border-border bg-white text-stone-700 hover:border-primary/20 hover:bg-primary/5'}`}>{children}</button>;
}

function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && close()}><section role="dialog" aria-modal="true" aria-label={title} className="mx-auto my-8 w-full max-w-lg rounded-[30px] border border-white/10 bg-surface p-6 shadow-2xl"><header className="mb-5 flex items-start justify-between gap-4"><div><span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.14em] text-primary">Configuração</span><h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">{title}</h2></div><button aria-label="Fechar" onClick={close} className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-white font-bold text-stone-700">✕</button></header>{children}</section></div>;
}
