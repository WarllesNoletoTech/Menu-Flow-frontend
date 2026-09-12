'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { authenticatedRequest } from '../../../lib/authenticated-request';

const safeTargetUrl = (value: string) =>
  !value.trim() ||
  (/^\/(?!\/)/.test(value.trim()) && !/[\\\r\n]/.test(value.trim())) ||
  /^https:\/\/[^\s]+$/i.test(value.trim());

type Banner = {
  _id: string;
  id?: string;
  name: string;
  title?: string;
  description?: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  targetUrl?: string;
  active: boolean;
  sortOrder: number;
};

type Form = {
  name: string;
  title: string;
  description: string;
  desktopImageUrl: string;
  mobileImageUrl: string;
  targetUrl: string;
  active: boolean;
  sortOrder: number;
};

const empty: Form = {
  name: '',
  title: '',
  description: '',
  desktopImageUrl: '',
  mobileImageUrl: '',
  targetUrl: '',
  active: true,
  sortOrder: 0,
};

function Preview({ url, mobile }: { url: string; mobile?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);

  if (!url) {
    return (
      <div className={`grid place-items-center rounded-[22px] border border-dashed border-border bg-background text-center text-sm text-stone-500 ${mobile ? 'aspect-[4/5] max-w-[240px] px-4' : 'aspect-[3/1] w-full px-6'}`}>
        A prévia aparecerá aqui.
      </div>
    );
  }

  if (failed) {
    return <p role="alert" className="rounded-[22px] border border-danger/20 bg-danger/10 p-3 text-sm text-danger">Não foi possível carregar esta imagem.</p>;
  }

  return (
    <img
      src={url}
      onError={() => setFailed(true)}
      alt={mobile ? 'Prévia para celular' : 'Prévia para computador'}
      className={`rounded-[22px] border border-border bg-white object-cover shadow-sm ${mobile ? 'aspect-[4/5] w-[240px]' : 'aspect-[3/1] w-full'}`}
    />
  );
}

export default function BannersPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Banner | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    return authenticatedRequest<Banner[]>('/admin/home-banners')
      .then(setItems)
      .catch(() => setError('Não foi possível carregar os banners. Tente novamente.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const begin = (item?: Banner) => {
    setEditing(item?._id || null);
    setForm(
      item
        ? {
            name: item.name,
            title: item.title || '',
            description: item.description || '',
            desktopImageUrl: item.desktopImageUrl,
            mobileImageUrl: item.mobileImageUrl,
            targetUrl: item.targetUrl || '',
            active: item.active,
            sortOrder: item.sortOrder,
          }
        : empty,
    );
    setError('');
    setOpen(true);
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!safeTargetUrl(form.targetUrl)) {
      setError('Informe um caminho interno ou uma URL segura iniciada por https://.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authenticatedRequest(editing ? `/admin/home-banners/${editing}` : '/admin/home-banners', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
      setOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar o banner. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function update(item: Banner, changes: Partial<Banner>) {
    try {
      await authenticatedRequest(`/admin/home-banners/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      await load();
    } catch {
      setError('Não foi possível atualizar o banner. Tente novamente.');
    }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await authenticatedRequest(`/admin/home-banners/${deleting._id}`, { method: 'DELETE' });
      setDeleting(null);
      await load();
    } catch {
      setError('Não foi possível excluir o banner. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  const metrics = useMemo(() => {
    const active = items.filter((item) => item.active).length;
    const inactive = items.length - active;
    return [
      { label: 'Total de banners', value: items.length, tone: 'primary' },
      { label: 'Ativos na home', value: active, tone: 'success' },
      { label: 'Inativos', value: inactive, tone: 'neutral' },
      { label: 'Com destino configurado', value: items.filter((item) => Boolean(item.targetUrl)).length, tone: 'gold' },
    ] as const;
  }, [items]);

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="mf-panel overflow-hidden rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.18em] text-primary">Home · Gestão visual</span>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-[2.3rem]">Banners da tela inicial</h1>
            <p className="mt-2 text-sm leading-6 text-stone-500 sm:text-base">Gerencie os banners do portal público com uma visualização mais clara de desktop, mobile, ordem de exibição e destino dos cliques.</p>
          </div>
          <button onClick={() => begin()} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
            + Adicionar banner
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item) => (
            <StatCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
          ))}
        </div>
      </header>

      {error && <Alert text={error} />}

      {loading ? (
        <div className="grid gap-5">
          {Array.from({ length: 2 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-[30px] bg-stone-200" />)}
        </div>
      ) : items.length ? (
        <div className="grid gap-5">
          {items.map((item, index) => (
            <article key={item._id} className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.06)] sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.15em] text-primary">Banner #{index + 1}</span>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[.15em] ${item.active ? 'bg-success/10 text-success' : 'bg-stone-100 text-stone-600'}`}>{item.active ? 'Ativo' : 'Inativo'}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">{item.name}</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <InfoChip label="Posição" value={String(item.sortOrder)} />
                    <InfoChip label="Título" value={item.title || 'Sem título'} />
                    <InfoChip label="Destino" value={item.targetUrl || 'Nenhum destino configurado'} breakAll />
                  </div>
                  {item.description && <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-500">{item.description}</p>}
                </div>

                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <ActionButton disabled={index === 0} onClick={() => void update(item, { sortOrder: Math.max(0, (items[index - 1]?.sortOrder ?? item.sortOrder) - 1) })}>↑ Subir</ActionButton>
                  <ActionButton disabled={index === items.length - 1} onClick={() => void update(item, { sortOrder: (items[index + 1]?.sortOrder ?? item.sortOrder) + 1 })}>↓ Descer</ActionButton>
                  <ActionButton onClick={() => begin(item)}>Editar</ActionButton>
                  <ActionButton onClick={() => void update(item, { active: !item.active })}>{item.active ? 'Desativar' : 'Ativar'}</ActionButton>
                  <ActionButton danger onClick={() => setDeleting(item)}>Excluir</ActionButton>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(260px,.7fr)]">
                <div className="rounded-[26px] border border-border bg-background/45 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[.16em] text-stone-400">Preview desktop</p>
                      <p className="text-sm font-semibold text-stone-500">Recomendado para computador</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-stone-600 shadow-sm">3:1</span>
                  </div>
                  <Preview url={item.desktopImageUrl} />
                </div>

                <div className="rounded-[26px] border border-border bg-background/45 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[.16em] text-stone-400">Preview mobile</p>
                      <p className="text-sm font-semibold text-stone-500">Recomendado para celular</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-stone-600 shadow-sm">4:5</span>
                  </div>
                  <div className="flex justify-center">
                    <Preview url={item.mobileImageUrl} mobile />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[32px] border border-dashed border-border bg-white px-6 py-14 text-center shadow-sm">
          <h2 className="text-2xl font-black tracking-tight text-stone-900">Nenhum banner cadastrado</h2>
          <p className="mt-2 text-stone-500">Adicione banners para divulgar campanhas, planos ou destaques do Menu Flow na página inicial.</p>
          <button onClick={() => begin()} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white shadow-sm">Adicionar banner</button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/60 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="banner-form-title">
          <form onSubmit={save} className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border border-white/10 bg-surface shadow-2xl sm:max-h-[90dvh]">
            <header className="sticky top-0 z-10 flex shrink-0 items-start justify-between gap-4 border-b border-border bg-surface px-5 py-4 sm:px-7">
              <div>
                <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.15em] text-primary">Configuração do banner</span>
                <h2 id="banner-form-title" className="mt-3 text-2xl font-black tracking-tight">{editing ? 'Editar banner' : 'Adicionar banner'}</h2>
                <p className="mt-1 text-sm text-stone-500">Configure textos, imagens, destino e publicação.</p>
              </div>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Fechar formulário" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-white text-lg font-bold text-stone-700 disabled:opacity-50">✕</button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
              {error && <p role="alert" className="mb-5 rounded-2xl border border-danger/20 bg-danger/10 p-3 font-medium text-danger">{error}</p>}

              <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
                <section className="rounded-[28px] border border-border bg-background/40 p-4 sm:p-5">
                  <h3 className="text-xs font-black uppercase tracking-[.18em] text-accent">Identificação</h3>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="font-bold text-stone-800">Nome interno *
                      <input required maxLength={120} className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                      <small className="mt-1 block font-normal text-stone-500">Usado apenas na organização administrativa.</small>
                    </label>
                    <label className="font-bold text-stone-800">Título
                      <input maxLength={160} className="field" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
                    </label>
                    <label className="font-bold text-stone-800 md:col-span-2">Descrição
                      <textarea maxLength={500} className="field min-h-24 resize-y" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                    </label>
                  </div>
                </section>

                <section className="rounded-[28px] border border-border bg-background/40 p-4 sm:p-5">
                  <h3 className="text-xs font-black uppercase tracking-[.18em] text-accent">Publicação</h3>
                  <label className="mt-4 block font-bold text-stone-800">Ordem de exibição
                    <input required min="0" type="number" className="field" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} />
                    <small className="mt-1 block font-normal text-stone-500">Quanto menor o número, mais cedo o banner aparece.</small>
                  </label>
                  <label className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-white p-4 font-bold text-stone-800">
                    <input className="h-5 w-5 accent-primary" type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
                    Exibir este banner
                  </label>
                  <div className="mt-4 rounded-2xl border border-border bg-white p-4 text-sm text-stone-500">
                    <b className="block text-stone-800">Boas práticas</b>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      <li>Use títulos curtos e imagens com foco central.</li>
                      <li>Prefira contraste alto para textos promocionais.</li>
                      <li>Mantenha versões separadas para desktop e mobile.</li>
                    </ul>
                  </div>
                </section>
              </div>

              <section className="mt-5 rounded-[28px] border border-border bg-background/40 p-4 sm:p-5">
                <h3 className="text-xs font-black uppercase tracking-[.18em] text-accent">Imagens do banner</h3>
                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <div className="min-w-0 rounded-[24px] border border-border bg-white p-4">
                    <label className="font-bold text-stone-800">Imagem para computador *
                      <input required type="url" pattern="https://.*" placeholder="https://..." className="field" value={form.desktopImageUrl} onChange={(event) => setForm({ ...form, desktopImageUrl: event.target.value })} />
                    </label>
                    <p className="mt-2 text-sm text-stone-500">Recomendado: 1920 × 640 px · proporção 3:1.</p>
                    <p className="mb-2 mt-4 text-xs font-black uppercase tracking-[.14em] text-stone-500">Prévia desktop</p>
                    <Preview url={form.desktopImageUrl} />
                  </div>

                  <div className="min-w-0 rounded-[24px] border border-border bg-white p-4">
                    <label className="font-bold text-stone-800">Imagem para celular *
                      <input required type="url" pattern="https://.*" placeholder="https://..." className="field" value={form.mobileImageUrl} onChange={(event) => setForm({ ...form, mobileImageUrl: event.target.value })} />
                    </label>
                    <p className="mt-2 text-sm text-stone-500">Recomendado: 1080 × 1350 px · proporção 4:5.</p>
                    <p className="mb-2 mt-4 text-xs font-black uppercase tracking-[.14em] text-stone-500">Prévia mobile</p>
                    <div className="flex justify-center"><Preview url={form.mobileImageUrl} mobile /></div>
                  </div>
                </div>
              </section>

              <section className="mt-5 rounded-[28px] border border-border bg-background/40 p-4 sm:p-5">
                <h3 className="text-xs font-black uppercase tracking-[.18em] text-accent">Ação do banner</h3>
                <label className="mt-4 block font-bold text-stone-800">Link de redirecionamento
                  <input type="text" inputMode="url" maxLength={2048} placeholder="/sabor-da-praca ou https://exemplo.com/promocao" className="field" value={form.targetUrl} onChange={(event) => setForm({ ...form, targetUrl: event.target.value })} />
                  <small className="mt-1 block font-normal text-stone-500">Opcional. Pode ser um caminho interno ou uma URL externa segura iniciada por https://.</small>
                  {form.targetUrl.trim() && <span className="mt-2 block break-all text-sm font-normal text-stone-600"><b>Destino:</b> {form.targetUrl.trim()}</span>}
                </label>
              </section>
            </div>

            <footer className="sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="min-h-11 rounded-2xl border border-border bg-white px-5 py-3 font-bold text-stone-700 disabled:opacity-50">Cancelar</button>
              <button disabled={busy} className="min-h-11 rounded-2xl bg-ink px-5 py-3 font-bold text-white shadow-sm disabled:opacity-50">{busy ? 'Salvando...' : 'Salvar banner'}</button>
            </footer>
          </form>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-stone-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-surface p-6 shadow-2xl">
            <h2 id="delete-title" className="text-2xl font-black tracking-tight text-stone-900">Excluir banner?</h2>
            <p className="mt-3 text-sm leading-6 text-stone-600">Tem certeza de que deseja excluir este banner? Esta ação não poderá ser desfeita.</p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => setDeleting(null)} className="min-h-11 rounded-2xl border border-border bg-white px-5 py-3 font-bold text-stone-700">Cancelar</button>
              <button disabled={busy} onClick={() => void remove()} className="min-h-11 rounded-2xl bg-danger px-5 py-3 font-bold text-white shadow-sm">Excluir banner</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number | string; tone: 'primary' | 'success' | 'neutral' | 'gold' }) {
  const toneClass = tone === 'success' ? 'bg-success/10 text-success' : tone === 'gold' ? 'bg-gold/20 text-amber-700' : tone === 'neutral' ? 'bg-stone-100 text-stone-600' : 'bg-primary/10 text-primary';
  return (
    <article className="rounded-[24px] border border-border/90 bg-white p-5 shadow-[0_12px_30px_rgba(41,37,36,.05)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-stone-500">{label}</p>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.16em] ${toneClass}`}>Resumo</span>
      </div>
      <strong className="mt-3 block text-[30px] font-black tracking-tight text-stone-900">{value}</strong>
    </article>
  );
}

function InfoChip({ label, value, breakAll = false }: { label: string; value: string; breakAll?: boolean }) {
  return (
    <div className="rounded-[20px] border border-border bg-background/50 px-4 py-3">
      <span className="block text-[11px] font-black uppercase tracking-[.14em] text-stone-400">{label}</span>
      <span className={`mt-1 block text-sm font-semibold text-stone-700 ${breakAll ? 'break-all' : ''}`}>{value}</span>
    </div>
  );
}

function ActionButton({ children, danger = false, disabled = false, onClick }: { children: string; danger?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-10 rounded-2xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${danger ? 'border-danger/15 bg-danger/10 text-danger hover:bg-danger/15' : 'border-border bg-white text-stone-700 hover:border-primary/20 hover:bg-primary/5'}`}
    >
      {children}
    </button>
  );
}

function Alert({ text }: { text: string }) {
  return <p role="alert" className="rounded-[24px] border border-danger/20 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{text}</p>;
}
