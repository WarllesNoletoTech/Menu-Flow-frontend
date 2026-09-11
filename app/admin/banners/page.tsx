'use client';

import { DragEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { authenticatedRequest } from '../../../lib/authenticated-request';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024;
const safeTargetUrl = (value: string) => !value.trim() || (/^\/(?!\/)/.test(value.trim()) && !/[\\\r\n]/.test(value.trim())) || /^https:\/\/[^\s]+$/i.test(value.trim());

type Banner = { _id: string; name: string; title?: string; description?: string; desktopImageUrl: string; mobileImageUrl: string; targetUrl?: string; active: boolean; sortOrder: number };
type Form = { name: string; title: string; description: string; targetUrl: string; active: boolean; sortOrder: number };
type ImageValue = { file: File | null; savedUrl: string; previewUrl: string; removed: boolean; validationError?: string };
const emptyForm: Form = { name: '', title: '', description: '', targetUrl: '', active: true, sortOrder: 0 };
const emptyImage = (): ImageValue => ({ file: null, savedUrl: '', previewUrl: '', removed: false });

function Preview({ url, mobile = false }: { url: string; mobile?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  if (failed) return <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">Não foi possível carregar esta imagem.</p>;
  return <img src={url} onError={() => setFailed(true)} alt={mobile ? 'Prévia da imagem para celular' : 'Prévia da imagem para computador'} className={`rounded-xl border object-cover ${mobile ? 'aspect-[4/5] w-52' : 'aspect-[3/1] w-full'}`} />;
}

function ImageUpload({ kind, value, onChange, error }: { kind: 'desktop' | 'mobile'; value: ImageValue; onChange: (value: ImageValue) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const mobile = kind === 'mobile';
  const title = mobile ? 'Imagem para celular' : 'Imagem para computador';
  const recommendation = mobile ? '1080 × 1350 px' : '1920 × 640 px';
  const select = (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) return onChange({ ...value, file: null, previewUrl: '', validationError: 'Formato de arquivo não permitido.' });
    if (file.size > MAX_SIZE) return onChange({ ...value, file: null, previewUrl: '', validationError: 'Esta imagem é muito grande. O tamanho máximo permitido é 5 MB.' });
    onChange({ file, savedUrl: value.savedUrl, previewUrl: URL.createObjectURL(file), removed: false, validationError: '' });
  };
  const drop = (event: DragEvent<HTMLFieldSetElement>) => { event.preventDefault(); select(event.dataTransfer.files[0]); };
  const remove = () => onChange({ ...value, file: null, previewUrl: '', removed: Boolean(value.savedUrl), validationError: '' });
  const url = value.previewUrl || (!value.removed ? value.savedUrl : '');
  return <fieldset onDragOver={event => event.preventDefault()} onDrop={drop} className="rounded-2xl border-2 border-dashed border-stone-300 bg-background p-5">
    <legend className="px-2 text-sm font-black uppercase text-ink">{title} *</legend>
    <p className="text-sm font-semibold">Anexe aqui o banner para {mobile ? 'celulares' : 'computadores'}.</p>
    <p className="mt-1 text-sm text-stone-600">Recomendado: {recommendation}.<br />JPG, PNG ou WebP. Máximo de 5 MB.</p>
    {url ? <div className="mt-4">
      <Preview url={url} mobile={mobile} />
      <p className="mt-2 break-all text-sm text-stone-600">{value.file?.name || 'Imagem salva'}</p>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => input.current?.click()} className="rounded-lg border bg-surface px-4 py-2 font-bold">Trocar imagem</button><button type="button" onClick={remove} className="rounded-lg bg-danger/10 px-4 py-2 font-bold text-danger">Remover imagem</button></div>
    </div> : <div className="mt-4"><p className="mb-3 text-sm text-stone-500">Arraste uma imagem aqui ou clique para selecionar.</p><button type="button" onClick={() => input.current?.click()} className="rounded-lg bg-ink px-4 py-2 font-bold text-white">Anexar imagem</button></div>}
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { select(event.target.files?.[0]); event.target.value = ''; }} />
    {error && <p role="alert" className="mt-3 text-sm font-bold text-danger">{error}</p>}
  </fieldset>;
}

export default function BannersPage() {
  const [items, setItems] = useState<Banner[]>([]);
  const [form, setForm] = useState<Form>(emptyForm);
  const [desktop, setDesktop] = useState<ImageValue>(emptyImage);
  const [mobile, setMobile] = useState<ImageValue>(emptyImage);
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<string | null>(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [deleting, setDeleting] = useState<Banner | null>(null);
  const [imageErrors, setImageErrors] = useState({ desktop: '', mobile: '' });
  const load = useCallback(() => { setLoading(true); return authenticatedRequest<Banner[]>('/admin/home-banners').then(setItems).catch(() => setError('Não foi possível carregar os banners. Tente novamente.')).finally(() => setLoading(false)); }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { if (desktop.previewUrl) URL.revokeObjectURL(desktop.previewUrl); }, [desktop.previewUrl]);
  useEffect(() => () => { if (mobile.previewUrl) URL.revokeObjectURL(mobile.previewUrl); }, [mobile.previewUrl]);

  const begin = (item?: Banner) => {
    setEditing(item?._id || null);
    setForm(item ? { name: item.name, title: item.title || '', description: item.description || '', targetUrl: item.targetUrl || '', active: item.active, sortOrder: item.sortOrder } : emptyForm);
    setDesktop(item ? { ...emptyImage(), savedUrl: item.desktopImageUrl } : emptyImage());
    setMobile(item ? { ...emptyImage(), savedUrl: item.mobileImageUrl } : emptyImage());
    setImageErrors({ desktop: '', mobile: '' }); setError(''); setOpen(true);
  };
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    const desktopMissing = !desktop.file && (!desktop.savedUrl || desktop.removed), mobileMissing = !mobile.file && (!mobile.savedUrl || mobile.removed);
    setImageErrors({ desktop: desktopMissing ? (editing ? 'Adicione uma nova imagem antes de salvar.' : 'Anexe a imagem para computador.') : '', mobile: mobileMissing ? (editing ? 'Adicione uma nova imagem antes de salvar.' : 'Anexe a imagem para celular.') : '' });
    if (desktopMissing || mobileMissing) return;
    if (!safeTargetUrl(form.targetUrl)) return setError('Informe um caminho interno ou uma URL segura iniciada por https://.');
    const data = new FormData(); Object.entries(form).forEach(([key, value]) => data.set(key, String(value))); if (desktop.file) data.set('desktopImage', desktop.file); if (mobile.file) data.set('mobileImage', mobile.file);
    setBusy(true); setError('');
    try { await authenticatedRequest(editing ? `/admin/home-banners/${editing}` : '/admin/home-banners', { method: editing ? 'PATCH' : 'POST', body: data }); setOpen(false); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível enviar a imagem.'); }
    finally { setBusy(false); }
  }
  async function update(item: Banner, changes: Partial<Banner>) { try { await authenticatedRequest(`/admin/home-banners/${item._id}`, { method: 'PATCH', body: JSON.stringify(changes) }); await load(); } catch { setError('Não foi possível atualizar o banner. Tente novamente.'); } }
  async function remove() { if (!deleting || busy) return; setBusy(true); try { await authenticatedRequest(`/admin/home-banners/${deleting._id}`, { method: 'DELETE' }); setDeleting(null); await load(); } catch { setError('Não foi possível excluir o banner. Tente novamente.'); } finally { setBusy(false); } }

  return <section className="mx-auto max-w-6xl"><header className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-3xl font-black">Banners da tela inicial</h1><p className="mt-1 text-stone-500">Gerencie as imagens promocionais exibidas na página inicial do Menu Flow.</p></div><button onClick={() => begin()} className="rounded-xl bg-ink px-5 py-3 font-bold text-white">+ Adicionar banner</button></header>
    {error && !open && <p role="alert" className="mt-5 rounded-xl bg-danger/10 p-3 text-danger">{error}</p>}
    {loading ? <div className="mt-7 h-40 animate-pulse rounded-2xl bg-stone-200" /> : items.length ? <div className="mt-7 grid gap-5">{items.map((item, index) => <article key={item._id} className="rounded-2xl bg-surface p-5 shadow-sm"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black">{item.name}</h2><p className="text-sm text-stone-500">Posição: {item.sortOrder} · <span className={item.active ? 'text-green-700' : 'text-stone-500'}>{item.active ? 'Ativo' : 'Inativo'}</span></p><p className="mt-1 text-sm text-stone-500"><b>Destino:</b> {item.targetUrl || 'Nenhum'}</p></div><div className="flex flex-wrap gap-2"><button disabled={index === 0} onClick={() => void update(item, { sortOrder: Math.max(0, (items[index - 1]?.sortOrder ?? item.sortOrder) - 1) })} className="rounded-lg border px-3 py-2 disabled:opacity-30" aria-label="Mover para cima">↑</button><button disabled={index === items.length - 1} onClick={() => void update(item, { sortOrder: (items[index + 1]?.sortOrder ?? item.sortOrder) + 1 })} className="rounded-lg border px-3 py-2 disabled:opacity-30" aria-label="Mover para baixo">↓</button><button onClick={() => begin(item)} className="rounded-lg border px-3 py-2 font-bold">Editar</button><button onClick={() => void update(item, { active: !item.active })} className="rounded-lg border px-3 py-2 font-bold">{item.active ? 'Desativar' : 'Ativar'}</button><button onClick={() => setDeleting(item)} className="rounded-lg bg-danger/10 px-3 py-2 font-bold text-danger">Excluir</button></div></div><div className="mt-4 grid gap-4 md:grid-cols-[3fr_1fr]"><Preview url={item.desktopImageUrl} /><Preview url={item.mobileImageUrl} mobile /></div></article>)}</div> : <div className="mt-7 rounded-2xl border border-dashed bg-surface p-10 text-center"><h2 className="text-xl font-black">Nenhum banner cadastrado.</h2><p className="mt-2 text-stone-500">Adicione um banner para começar a divulgar campanhas na página inicial.</p><button onClick={() => begin()} className="mt-5 rounded-xl bg-ink px-5 py-3 font-bold text-white">Adicionar banner</button></div>}
    {open && <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 p-4" role="dialog" aria-modal="true" aria-labelledby="banner-form-title"><form onSubmit={save} className="mx-auto my-6 max-w-4xl rounded-3xl bg-surface p-6 shadow-soft"><h2 id="banner-form-title" className="text-2xl font-black">{editing ? 'Editar banner' : 'Adicionar banner'}</h2><div className="mt-5 grid gap-5 md:grid-cols-2"><label className="font-bold md:col-span-2">Nome interno *<input required maxLength={120} className="field" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><small className="font-normal text-stone-500">Esse nome serve apenas para organização do administrador.</small></label><label className="font-bold">Título<input maxLength={160} className="field" value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} /></label><label className="font-bold">Ordem de exibição<input required min="0" type="number" className="field" value={form.sortOrder} onChange={event => setForm({ ...form, sortOrder: Number(event.target.value) })} /><small className="font-normal text-stone-500">Quanto menor, mais cedo aparece.</small></label><label className="font-bold md:col-span-2">Descrição<textarea maxLength={500} className="field min-h-20" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label><div className="md:col-span-2"><ImageUpload kind="desktop" value={desktop} onChange={value => { setDesktop(value); setImageErrors(errors => ({ ...errors, desktop: value.validationError || '' })); }} error={imageErrors.desktop} /></div><div className="md:col-span-2"><ImageUpload kind="mobile" value={mobile} onChange={value => { setMobile(value); setImageErrors(errors => ({ ...errors, mobile: value.validationError || '' })); }} error={imageErrors.mobile} /></div><label className="font-bold md:col-span-2">Link de redirecionamento<input type="text" inputMode="url" maxLength={2048} placeholder="/sabor-da-praca ou https://exemplo.com" className="field" value={form.targetUrl} onChange={event => setForm({ ...form, targetUrl: event.target.value })} /><small className="font-normal text-stone-500">Opcional. Ao clicar no banner, o visitante será direcionado para este endereço.</small></label><label className="flex items-center gap-3 font-bold md:col-span-2"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} /> Exibir este banner</label></div>{error && <p role="alert" className="mt-4 text-danger">{error}</p>}<div className="mt-6 flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-xl border px-5 py-3 font-bold">Cancelar</button><button disabled={busy} className="rounded-xl bg-ink px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Enviando imagem...' : 'Salvar banner'}</button></div></form></div>}
    {deleting && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="max-w-md rounded-2xl bg-surface p-6"><h2 id="delete-title" className="text-2xl font-black">Excluir banner?</h2><p className="mt-3 text-stone-600">Tem certeza de que deseja excluir este banner? As imagens relacionadas também serão removidas.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setDeleting(null)} className="rounded-xl border px-5 py-3 font-bold">Cancelar</button><button disabled={busy} onClick={() => void remove()} className="rounded-xl bg-danger px-5 py-3 font-bold text-white">Excluir banner</button></div></div></div>}
  </section>;
}
