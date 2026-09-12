'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { ImageUrlField } from '../../../components/admin/ImageUrlField';
import { LocationSelects } from '../../../components/locations/LocationSelects';
import { useEmpresa } from '../../../components/empresa/EmpresaContext';
import type { Establishment } from '../../../components/empresa/types';
import { legacyEstablishmentLabel } from '../../../lib/public-restaurants';

type EditableKey =
  | 'name' | 'tradeName' | 'cnpj' | 'email' | 'phone' | 'whatsapp' | 'orderWhatsapp'
  | 'instagram' | 'address' | 'state' | 'city' | 'description' | 'logoUrl'
  | 'bannerUrl' | 'bannerDesktopUrl' | 'bannerMobileUrl' | 'mapUrl' | 'pickupInstructions';

const editableKeys: EditableKey[] = [
  'name', 'tradeName', 'cnpj', 'email', 'phone', 'whatsapp', 'orderWhatsapp', 'instagram',
  'address', 'state', 'city', 'description', 'logoUrl', 'bannerUrl', 'bannerDesktopUrl',
  'bannerMobileUrl', 'mapUrl', 'pickupInstructions',
];

function SectionCard({ title, description, children, className = '' }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border border-border bg-surface p-5 shadow-sm sm:p-6 ${className}`}>
      <div className="mb-5 border-b border-border/80 pb-4">
        <h3 className="text-lg font-black tracking-tight text-stone-900">{title}</h3>
        {description && <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function ReadValue({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] font-black uppercase tracking-[.14em] text-stone-400">{label}</dt>
      <dd className="mt-1.5 whitespace-pre-wrap break-words text-[15px] font-semibold leading-6 text-stone-800">{value || 'Não informado'}</dd>
    </div>
  );
}

export default function Page() {
  const { establishment, request, refreshCompany } = useEmpresa();
  const [form, setForm] = useState<Partial<Establishment>>({});
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageKind, setMessageKind] = useState<'success' | 'error' | 'info'>('info');

  const reset = () => {
    if (!establishment) return;
    const next = Object.fromEntries(editableKeys.map((key) => [key, establishment[key] ?? ''])) as Partial<Establishment>;
    next.bannerDesktopUrl = establishment.bannerDesktopUrl || establishment.bannerUrl || '';
    next.bannerMobileUrl = establishment.bannerMobileUrl || '';
    next.bannerUrl = establishment.bannerUrl || establishment.bannerDesktopUrl || '';
    setForm(next);
  };

  useEffect(reset, [establishment]);

  const displayDesktopBanner = useMemo(
    () => establishment?.bannerDesktopUrl || establishment?.bannerUrl || '',
    [establishment],
  );
  const displayMobileBanner = useMemo(
    () => establishment?.bannerMobileUrl || establishment?.bannerDesktopUrl || establishment?.bannerUrl || '',
    [establishment],
  );

  if (!establishment) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessageKind('info');
    setMessage('Salvando alterações…');
    try {
      const bannerDesktopUrl = String(form.bannerDesktopUrl ?? '').trim();
      const payload = {
        ...form,
        bannerDesktopUrl,
        bannerMobileUrl: String(form.bannerMobileUrl ?? '').trim(),
        // Mantém clientes/versões antigas funcionando enquanto todos migram para os dois novos campos.
        bannerUrl: bannerDesktopUrl || String(form.bannerUrl ?? '').trim(),
      };
      await request('/restaurants/me', { method: 'PATCH', body: JSON.stringify(payload) });
      await refreshCompany();
      setEditing(false);
      setMessageKind('success');
      setMessage('Dados salvos com sucesso.');
    } catch (error) {
      setMessageKind('error');
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.');
    } finally {
      setBusy(false);
    }
  }

  const set = (key: EditableKey, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const field = (key: EditableKey, label: string, type = 'text', required = false) => (
    <label className="block font-bold text-stone-800">
      {label}
      <input
        required={required}
        type={type}
        className="field"
        value={String(form[key] ?? '')}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );

  return (
    <section className="mx-auto w-full max-w-6xl pb-8">
      <header className="relative overflow-hidden rounded-[30px] border border-border bg-surface p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.14em] text-primary">Perfil da loja</span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl">Dados da empresa</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">Mantenha seus dados, identidade visual e informações públicas da loja sempre atualizados.</p>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => { reset(); setEditing(true); setMessage(''); }}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm hover:-translate-y-0.5 hover:shadow-soft"
            >
              Editar dados
            </button>
          )}
        </div>
      </header>

      {!editing ? (
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <SectionCard title="Informações básicas" description="Dados exibidos e usados para identificar seu estabelecimento.">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <ReadValue label="Nome" value={establishment.name} />
              <ReadValue label="Nome fantasia" value={establishment.tradeName} />
              <ReadValue label="Tipo" value={establishment.establishmentTypeName ?? legacyEstablishmentLabel(establishment.establishmentType)} />
              <ReadValue label="CNPJ" value={establishment.cnpj} />
              <ReadValue label="Descrição" value={establishment.description} wide />
            </dl>
          </SectionCard>

          <SectionCard title="Contato" description="Canais usados pelo cliente e pela operação da loja.">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <ReadValue label="E-mail" value={establishment.email} />
              <ReadValue label="Telefone" value={establishment.phone} />
              <ReadValue label="WhatsApp administrativo" value={establishment.whatsapp} />
              <ReadValue label="WhatsApp para pedidos" value={establishment.orderWhatsapp} />
              <ReadValue label="Instagram" value={establishment.instagram} wide />
            </dl>
          </SectionCard>

          <SectionCard title="Endereço e retirada" description="Informações que ajudam o cliente a localizar e retirar pedidos.">
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <ReadValue label="Endereço" value={establishment.address} wide />
              <ReadValue label="Estado" value={establishment.state} />
              <ReadValue label="Cidade" value={establishment.city} />
              <div className="sm:col-span-2">
                <dt className="text-[11px] font-black uppercase tracking-[.14em] text-stone-400">Localização no mapa</dt>
                <dd className="mt-1.5 text-[15px] font-semibold">
                  {establishment.mapUrl
                    ? <a href={establishment.mapUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">Abrir localização</a>
                    : 'Não informado'}
                </dd>
              </div>
              <ReadValue label="Instruções de retirada" value={establishment.pickupInstructions} wide />
            </dl>
          </SectionCard>

          <SectionCard title="Identidade visual" description="Logo e banners exibidos para seus clientes." className="xl:col-span-2">
            <div className="grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)_300px]">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.14em] text-stone-400">Logo</p>
                <div className="mt-3 flex min-h-40 items-center justify-center rounded-3xl border border-border bg-background/70 p-4">
                  {establishment.logoUrl
                    ? <img src={establishment.logoUrl} alt="Logo do estabelecimento" className="h-28 w-28 rounded-2xl border border-border bg-white object-cover shadow-sm" />
                    : <span className="text-sm font-semibold text-stone-400">Sem logo</span>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.14em] text-stone-400">Banner para computador</p>
                <div className="mt-3 overflow-hidden rounded-3xl border border-border bg-background/70">
                  {displayDesktopBanner
                    ? <img src={displayDesktopBanner} alt="Banner para computador" className="aspect-[8/3] w-full object-cover" />
                    : <div className="grid aspect-[8/3] place-items-center text-sm font-semibold text-stone-400">Sem banner para computador</div>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[.14em] text-stone-400">Banner para celular</p>
                <div className="mt-3 flex justify-center rounded-3xl border border-border bg-background/70 p-3">
                  {displayMobileBanner
                    ? <img src={displayMobileBanner} alt="Banner para celular" className="aspect-[4/5] w-full max-w-[220px] rounded-2xl object-cover shadow-sm" />
                    : <div className="grid aspect-[4/5] w-full max-w-[220px] place-items-center rounded-2xl text-center text-sm font-semibold text-stone-400">Sem banner para celular</div>}
                </div>
                {!establishment.bannerMobileUrl && displayDesktopBanner && <p className="mt-2 text-center text-xs text-stone-500">Usando o banner de computador como fallback.</p>}
              </div>
            </div>
          </SectionCard>
        </div>
      ) : (
        <form onSubmit={save} className="mt-5 grid gap-5">
          <SectionCard title="Informações básicas" description="Edite os dados principais da sua loja.">
            <div className="grid gap-4 md:grid-cols-2">
              {field('name', 'Nome *', 'text', true)}
              {field('tradeName', 'Nome fantasia')}
              {field('cnpj', 'CNPJ')}
              <label className="block font-bold text-stone-800">Tipo
                <input readOnly className="field" value={establishment.establishmentTypeName ?? legacyEstablishmentLabel(establishment.establishmentType)} />
              </label>
              <label className="block font-bold text-stone-800 md:col-span-2">Descrição
                <textarea className="field min-h-32 resize-y" value={String(form.description ?? '')} onChange={(event) => set('description', event.target.value)} />
              </label>
            </div>
          </SectionCard>

          <SectionCard title="Contato" description="Dados usados no atendimento e comunicação com os clientes.">
            <div className="grid gap-4 md:grid-cols-2">
              {field('email', 'E-mail', 'email')}
              {field('phone', 'Telefone')}
              {field('whatsapp', 'WhatsApp administrativo')}
              {field('orderWhatsapp', 'WhatsApp para pedidos')}
              {field('instagram', 'Instagram')}
            </div>
          </SectionCard>

          <SectionCard title="Endereço e retirada" description="Configure onde sua loja fica e as instruções para retirada.">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">{field('address', 'Endereço')}</div>
              <LocationSelects state={String(form.state ?? '')} city={String(form.city ?? '')} onState={(state) => setForm((current) => ({ ...current, state, city: '' }))} onCity={(city) => set('city', city)} />
              {field('mapUrl', 'Localização no mapa', 'url')}
              <div className="md:col-span-2">{field('pickupInstructions', 'Instruções de retirada')}</div>
            </div>
          </SectionCard>

          <SectionCard title="Identidade visual" description="Use imagens diferentes para computador e celular para preservar a composição e a legibilidade.">
            <div className="grid gap-6 xl:grid-cols-2">
              <div className="xl:col-span-2 xl:max-w-md">
                <ImageUrlField label="URL da logo" type="logo" value={String(form.logoUrl ?? '')} onChange={(logoUrl) => set('logoUrl', logoUrl)} />
              </div>
              <ImageUrlField label="URL do banner para computador" type="bannerDesktop" value={String(form.bannerDesktopUrl ?? '')} onChange={(bannerDesktopUrl) => set('bannerDesktopUrl', bannerDesktopUrl)} />
              <ImageUrlField label="URL do banner para celular" type="bannerMobile" value={String(form.bannerMobileUrl ?? '')} onChange={(bannerMobileUrl) => set('bannerMobileUrl', bannerMobileUrl)} />
            </div>
          </SectionCard>

          <div className="sticky bottom-3 z-20 flex flex-col-reverse gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-soft backdrop-blur sm:flex-row sm:justify-end">
            <button type="button" disabled={busy} onClick={() => { reset(); setEditing(false); setMessage(''); }} className="min-h-11 rounded-xl border border-border bg-white px-6 py-3 text-sm font-black text-stone-700 hover:bg-background disabled:opacity-60">Cancelar</button>
            <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-ink px-6 py-3 text-sm font-black text-white shadow-sm hover:-translate-y-0.5 hover:shadow-soft disabled:translate-y-0 disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar alterações'}</button>
          </div>
        </form>
      )}

      {message && (
        <p
          aria-live="polite"
          className={`mt-4 rounded-2xl border p-3 text-sm font-semibold ${messageKind === 'success' ? 'border-success/20 bg-success/10 text-success' : messageKind === 'error' ? 'border-danger/20 bg-danger/10 text-danger' : 'border-border bg-surface text-stone-600'}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
