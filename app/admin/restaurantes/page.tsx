'use client';

import Link from 'next/link';
import type { FormEvent, InvalidEvent, ReactNode } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PasswordField } from '../../../components/auth/PasswordField';
import { ImageUrlField } from '../../../components/admin/ImageUrlField';
import { LocationSelects } from '../../../components/locations/LocationSelects';
import { apiUrl } from '../../../lib/api';
import { clearSession, getSession } from '../../../lib/auth';
import { legacyEstablishmentLabel, type EstablishmentTypeOption } from '../../../lib/public-restaurants';

type Owner = { id: string; name: string; email: string; phone?: string; reportWhatsapp?: string; active: boolean };
type StoreUser = Owner & { role: 'RESTAURANT_ADMIN' | 'EMPLOYEE' };
type Restaurant = {
  _id: string;
  name: string;
  slug: string;
  tradeName?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  orderWhatsapp?: string;
  instagram?: string;
  address?: string;
  state?: string;
  city?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  bannerDesktopUrl?: string;
  bannerMobileUrl?: string;
  mapUrl?: string;
  pickupInstructions?: string;
  establishmentType?: string;
  establishmentTypeId?: string;
  establishmentTypeName?: string;
  restaurantCategories: string[];
  open: boolean;
  blocked: boolean;
  owner?: Owner | null;
  employeeCount: number;
};
type RestaurantForm = {
  name: string;
  slug: string;
  tradeName: string;
  establishmentTypeId: string;
  cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  orderWhatsapp: string;
  instagram: string;
  address: string;
  state: string;
  city: string;
  description: string;
  logoUrl: string;
  bannerUrl: string;
  bannerDesktopUrl: string;
  bannerMobileUrl: string;
  mapUrl: string;
  pickupInstructions: string;
};
type UserForm = { name: string; email: string; phone: string; reportWhatsapp: string; active: boolean; password: string; confirmPassword: string };

const blankRestaurant: RestaurantForm = {
  name: '', slug: '', tradeName: '', establishmentTypeId: '', cnpj: '', email: '', phone: '', whatsapp: '', orderWhatsapp: '', instagram: '', address: '', state: '', city: '', description: '', logoUrl: '', bannerUrl: '', bannerDesktopUrl: '', bannerMobileUrl: '', mapUrl: '', pickupInstructions: '',
};
const blankUser: UserForm = { name: '', email: '', phone: '', reportWhatsapp: '', active: true, password: '', confirmPassword: '' };

export default function AdminRestaurantsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Restaurant[]>([]);
  const [establishmentTypes, setEstablishmentTypes] = useState<EstablishmentTypeOption[]>([]);
  const [message, setMessage] = useState('Carregando…');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState<RestaurantForm>(blankRestaurant);
  const [ownerForm, setOwnerForm] = useState<UserForm>(blankUser);
  const [sameEmail, setSameEmail] = useState(false);
  const [employeeForm, setEmployeeForm] = useState<UserForm>(blankUser);
  const [userEditForm, setUserEditForm] = useState<UserForm>(blankUser);
  const [editing, setEditing] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingOwnerId, setEditingOwnerId] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formError, setFormError] = useState('');
  const [addingOwner, setAddingOwner] = useState<Restaurant>();
  const [addingEmployee, setAddingEmployee] = useState<Restaurant>();
  const [expanded, setExpanded] = useState<string>();
  const [storeUsers, setStoreUsers] = useState<Record<string, StoreUser[]>>({});
  const [editingUser, setEditingUser] = useState<{ restaurant: Restaurant; user: StoreUser }>();

  function sessionOrRedirect() {
    const session = getSession();
    if (!session || session.user.role !== 'SUPER_ADMIN') {
      clearSession();
      router.replace('/login?returnTo=/admin/restaurantes');
      return null;
    }
    return session;
  }

  async function request(path: string, init?: RequestInit) {
    const session = sessionOrRedirect();
    if (!session) throw new Error('Sua sessão expirou. Faça login novamente.');
    let response: Response;
    try {
      response = await fetch(apiUrl(path), {
        ...init,
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
          ...init?.headers,
        },
      });
    } catch {
      throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
    }
    const result = (await response.json().catch(() => null)) as { message?: string | string[] } | null;
    if (response.status === 401) {
      clearSession();
      router.replace('/login?returnTo=/admin/restaurantes');
      throw new Error('Sua sessão expirou. Faça login novamente.');
    }
    if (!response.ok) {
      const apiMessage = Array.isArray(result?.message) ? result.message[0] : result?.message;
      const fallback: Record<number, string> = {
        400: 'Verifique os dados informados.',
        403: 'Você não possui permissão para esta ação.',
        404: 'Registro ou endpoint não encontrado.',
        409: 'Há um conflito com dados já cadastrados.',
        429: 'Muitas tentativas. Aguarde e tente novamente.',
        500: 'O servidor encontrou um problema.',
        503: 'O servidor está temporariamente indisponível.',
      };
      throw new Error(apiMessage || fallback[response.status] || `Não foi possível concluir a operação (HTTP ${response.status}).`);
    }
    return result;
  }

  async function load() {
    try {
      const [result, typeResult] = await Promise.all([request('/restaurants'), request('/establishment-types')]);
      setItems(result as unknown as Restaurant[]);
      setEstablishmentTypes((typeResult as unknown as Array<EstablishmentTypeOption & { active: boolean }>).filter((item) => item.active));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os estabelecimentos.');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(
    () => items.filter((item) =>
      (!search || `${item.name} ${item.slug} ${item.tradeName ?? ''}`.toLowerCase().includes(search.toLowerCase())) &&
      (!type || item.establishmentTypeId === type) &&
      (status === 'all' || (status === 'blocked' ? item.blocked : status === 'active' ? !item.blocked : status === 'open' ? item.open : !item.open))),
    [items, search, type, status],
  );

  function invalid(event: InvalidEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.target as HTMLInputElement;
    setFormError(`Revise o campo “${field.labels?.[0]?.childNodes[0]?.textContent?.trim() || field.name || 'obrigatório'}”.`);
    field.focus();
  }

  function validatePasswords(value: UserForm, target: (message: string) => void) {
    if (value.password !== value.confirmPassword) {
      target('As senhas não coincidem.');
      return false;
    }
    return true;
  }

  function fillRestaurant(item: Restaurant) {
    setForm({
      ...blankRestaurant,
      ...Object.fromEntries(Object.keys(blankRestaurant).map((key) => [key, item[key as keyof Restaurant] ?? blankRestaurant[key as keyof RestaurantForm]])),
    } as RestaurantForm);
  }

  async function edit(item: Restaurant) {
    setLoadingDetail(true);
    setFormError('');
    setMessage('');
    try {
      const result = await request(`/restaurants/${item._id}/admin-detail`) as unknown as { establishment: Restaurant; owner: Owner | null };
      fillRestaurant(result.establishment);
      setOwnerForm(result.owner ? { ...blankUser, ...result.owner } : blankUser);
      setEditingOwnerId(result.owner?.id);
      setEditing(item._id);
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o estabelecimento.');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting || !validatePasswords(ownerForm, setFormError)) return;
    setSubmitting(true);
    setFormError('');
    setMessage('');
    const owner = {
      name: ownerForm.name,
      email: ownerForm.email,
      phone: ownerForm.phone,
      reportWhatsapp: ownerForm.reportWhatsapp,
      active: ownerForm.active,
      ...(ownerForm.password ? { password: ownerForm.password } : {}),
    };
    try {
      if (editing) {
        await request(`/restaurants/${editing}/with-owner`, { method: 'PATCH', body: JSON.stringify({ establishment: form, ...(editingOwnerId ? { owner: { userId: editingOwnerId, ...owner } } : {}) }) });
        setMessage(editingOwnerId ? 'Lojista atualizado com sucesso. Estabelecimento salvo com sucesso.' : 'Estabelecimento salvo com sucesso.');
      } else {
        await request('/restaurants/with-admin', { method: 'POST', body: JSON.stringify({ establishment: form, owner: { name: ownerForm.name, email: ownerForm.email, phone: ownerForm.phone, reportWhatsapp: ownerForm.reportWhatsapp, password: ownerForm.password } }) });
        setMessage('Estabelecimento salvo com sucesso.');
      }
      setShowForm(false);
      setEditing(undefined);
      setEditingOwnerId(undefined);
      setSameEmail(false);
      setForm(blankRestaurant);
      setOwnerForm(blankUser);
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o estabelecimento.');
    } finally {
      setSubmitting(false);
    }
  }

  async function addOwner(event: FormEvent) {
    event.preventDefault();
    if (!addingOwner || submitting || !validatePasswords(ownerForm, setModalError)) return;
    setSubmitting(true);
    setModalError('');
    try {
      await request(`/restaurants/${addingOwner._id}/owners`, { method: 'POST', body: JSON.stringify({ name: ownerForm.name, email: ownerForm.email, phone: ownerForm.phone, reportWhatsapp: ownerForm.reportWhatsapp, password: ownerForm.password }) });
      setAddingOwner(undefined);
      setOwnerForm(blankUser);
      setMessage('Lojista criado com sucesso.');
      await load();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Não foi possível criar o lojista.');
    } finally {
      setSubmitting(false);
    }
  }

  async function addEmployee(event: FormEvent) {
    event.preventDefault();
    if (!addingEmployee || submitting || !validatePasswords(employeeForm, setModalError)) return;
    setSubmitting(true);
    setModalError('');
    try {
      await request(`/restaurants/${addingEmployee._id}/employees`, { method: 'POST', body: JSON.stringify({ name: employeeForm.name, email: employeeForm.email, phone: employeeForm.phone, password: employeeForm.password }) });
      setAddingEmployee(undefined);
      setEmployeeForm(blankUser);
      setMessage('Funcionário criado com sucesso.');
      await showUsers(addingEmployee, true);
      await load();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Não foi possível criar o funcionário.');
    } finally {
      setSubmitting(false);
    }
  }

  async function updateUser(event: FormEvent) {
    event.preventDefault();
    if (!editingUser || submitting || !validatePasswords(userEditForm, setModalError)) return;
    setSubmitting(true);
    setModalError('');
    const restaurant = editingUser.restaurant;
    try {
      await request(`/restaurants/${restaurant._id}/users/${editingUser.user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: userEditForm.name,
          email: userEditForm.email,
          phone: userEditForm.phone,
          ...(editingUser.user.role === 'RESTAURANT_ADMIN' ? { reportWhatsapp: userEditForm.reportWhatsapp } : {}),
          active: userEditForm.active,
          ...(userEditForm.password ? { password: userEditForm.password } : {}),
        }),
      });
      setEditingUser(undefined);
      setUserEditForm(blankUser);
      setMessage('Usuário atualizado com sucesso.');
      await showUsers(restaurant, true);
      await load();
    } catch (error) {
      setModalError(error instanceof Error ? error.message : 'Não foi possível atualizar o usuário.');
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteEmployee(restaurant: Restaurant, user: StoreUser) {
    if (!window.confirm(`Excluir ${user.name}? O histórico será preservado.`)) return;
    try {
      await request(`/restaurants/${restaurant._id}/employees/${user.id}`, { method: 'DELETE' });
      setMessage('Funcionário excluído com sucesso.');
      await showUsers(restaurant, true);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível excluir o funcionário.');
    }
  }

  async function showUsers(item: Restaurant, refresh = false) {
    if (!refresh && expanded === item._id) {
      setExpanded(undefined);
      return;
    }
    try {
      const users = await request(`/restaurants/${item._id}/users`) as unknown as StoreUser[];
      setStoreUsers((current) => ({ ...current, [item._id]: users }));
      setExpanded(item._id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os usuários.');
    }
  }

  async function toggle(item: Restaurant) {
    try {
      await request(`/restaurants/${item._id}`, { method: 'PATCH', body: JSON.stringify({ blocked: !item.blocked }) });
      setItems((current) => current.map((value) => (value._id === item._id ? { ...value, blocked: !value.blocked } : value)));
      setMessage('Estabelecimento salvo com sucesso.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o estabelecimento.');
    }
  }

  function closeModals() {
    setAddingOwner(undefined);
    setAddingEmployee(undefined);
    setEditingUser(undefined);
    setModalError('');
  }

  function userFields(value: UserForm, change: (value: UserForm) => void, optionalPassword = false, reportWhatsapp = false) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <label className="font-bold text-stone-800">Nome *
          <input required className="field" value={value.name} onChange={(event) => change({ ...value, name: event.target.value })} />
        </label>
        <label className="font-bold text-stone-800">E-mail de login *
          <input required type="email" className="field" value={value.email} onChange={(event) => change({ ...value, email: event.target.value })} />
        </label>
        <label className="font-bold text-stone-800">Telefone
          <input className="field" value={value.phone} onChange={(event) => change({ ...value, phone: event.target.value })} />
        </label>
        {reportWhatsapp && (
          <label className="font-bold text-stone-800">WhatsApp para relatórios *
            <input required className="field" placeholder="(94) 99999-9999" value={value.reportWhatsapp} onChange={(event) => change({ ...value, reportWhatsapp: event.target.value })} />
          </label>
        )}
        {optionalPassword && (
          <label className="font-bold text-stone-800">Status
            <select className="field" value={value.active ? 'active' : 'inactive'} onChange={(event) => change({ ...value, active: event.target.value === 'active' })}>
              <option value="active">Ativo</option>
              <option value="inactive">Inativo</option>
            </select>
          </label>
        )}
        <label className="font-bold text-stone-800">{optionalPassword ? 'Nova senha (opcional)' : 'Senha *'}
          <PasswordField required={!optionalPassword} minLength={8} autoComplete="new-password" className="field" value={value.password} onChange={(event) => change({ ...value, password: event.target.value })} />
        </label>
        <label className="font-bold text-stone-800">{optionalPassword ? 'Confirmar nova senha' : 'Confirmar senha *'}
          <PasswordField required={!optionalPassword} minLength={8} autoComplete="new-password" className="field" value={value.confirmPassword} onChange={(event) => change({ ...value, confirmPassword: event.target.value })} />
        </label>
      </div>
    );
  }

  const stats = [
    { label: 'Total de estabelecimentos', value: items.length, tone: 'primary' as const },
    { label: 'Ativos', value: items.filter((item) => !item.blocked).length, tone: 'success' as const },
    { label: 'Bloqueados', value: items.filter((item) => item.blocked).length, tone: 'danger' as const },
    { label: 'Abertos agora', value: items.filter((item) => item.open && !item.blocked).length, tone: 'gold' as const },
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-6">
      <header className="mf-panel overflow-hidden rounded-[32px] px-5 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-black text-stone-500 transition hover:text-primary">← Voltar ao painel</Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-900 sm:text-[2.35rem]">Estabelecimentos</h1>
            <p className="mt-2 text-sm leading-6 text-stone-500 sm:text-base">Gerencie lojistas, identidade visual, status da operação e equipe com uma visão mais clara e sofisticada da base cadastrada.</p>
          </div>
          <button
            type="button"
            className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-ink px-5 py-3 text-sm font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
            onClick={() => {
              setForm(blankRestaurant);
              setOwnerForm(blankUser);
              setEditing(undefined);
              setEditingOwnerId(undefined);
              setFormError('');
              setSameEmail(false);
              setShowForm(!showForm);
            }}
          >
            {showForm ? 'Cancelar cadastro' : 'Novo estabelecimento'}
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item) => <MetricCard key={item.label} {...item} />)}
        </div>
      </header>

      {showForm && (
        <form onSubmit={submit} onInvalid={invalid} className="rounded-[32px] border border-border/90 bg-white p-5 shadow-[0_14px_40px_rgba(41,37,36,.06)] sm:p-6 lg:p-7">
          <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-primary">Cadastro e edição</span>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">{editing ? 'Editar estabelecimento' : 'Novo estabelecimento'}</h2>
              <p className="mt-1 text-sm text-stone-500">Preencha os dados da loja, do responsável e da identidade visual.</p>
            </div>
            {loadingDetail && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-black uppercase tracking-[.14em] text-stone-600">Carregando detalhes…</span>}
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.4fr_.9fr]">
            <SectionCard title="Dados do estabelecimento" description="Informações públicas, contato e localização da loja.">
              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ['name', 'Nome *'], ['tradeName', 'Nome fantasia'], ['slug', 'Slug *'], ['cnpj', 'CNPJ'], ['email', 'E-mail comercial'], ['phone', 'Telefone'], ['whatsapp', 'WhatsApp administrativo'], ['orderWhatsapp', 'WhatsApp para pedidos'], ['instagram', 'Instagram'], ['address', 'Endereço'], ['mapUrl', 'Localização no mapa'], ['pickupInstructions', 'Instruções de retirada'],
                ] as Array<[keyof RestaurantForm, string]>).map(([key, label]) => (
                  <label className="font-bold text-stone-800" key={key}>
                    {label}
                    <input
                      required={key === 'name' || key === 'slug'}
                      pattern={key === 'slug' ? '[a-z0-9-]+' : undefined}
                      type={key === 'email' ? 'email' : 'text'}
                      className="field"
                      value={String(form[key])}
                      onChange={(event) => {
                        setForm({ ...form, [key]: event.target.value });
                        if (key === 'email' && sameEmail) setOwnerForm({ ...ownerForm, email: event.target.value });
                      }}
                    />
                  </label>
                ))}
                <ImageUrlField label="URL do logo" value={form.logoUrl} onChange={(logoUrl) => setForm({ ...form, logoUrl })} type="logo" />
                <ImageUrlField label="URL do banner para computador" value={form.bannerDesktopUrl || form.bannerUrl} onChange={(bannerDesktopUrl) => setForm({ ...form, bannerDesktopUrl, bannerUrl: bannerDesktopUrl })} type="bannerDesktop" />
                <ImageUrlField label="URL do banner para celular" value={form.bannerMobileUrl} onChange={(bannerMobileUrl) => setForm({ ...form, bannerMobileUrl })} type="bannerMobile" />
                <label className="font-bold text-stone-800">Tipo *
                  <select required className="field" value={form.establishmentTypeId} onChange={(event) => setForm({ ...form, establishmentTypeId: event.target.value })}>
                    <option value="">Selecione</option>
                    {establishmentTypes.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
                  </select>
                </label>
                <LocationSelects state={form.state} city={form.city} onState={(state) => setForm({ ...form, state, city: '' })} onCity={(city) => setForm({ ...form, city })} />
                <label className="font-bold text-stone-800 md:col-span-2">Descrição
                  <textarea className="field min-h-28 resize-y" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
                </label>
              </div>
            </SectionCard>

            <SectionCard title="Lojista responsável" description="Conta principal com acesso ao painel da empresa.">
              {(!editing || editingOwnerId) ? (
                <>
                  {userFields(ownerForm, setOwnerForm, !!editing, true)}
                  {!editing && (
                    <label className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-background/60 p-3 text-sm font-semibold text-stone-700">
                      <input
                        type="checkbox"
                        checked={sameEmail}
                        onChange={(event) => {
                          setSameEmail(event.target.checked);
                          setOwnerForm({ ...ownerForm, email: event.target.checked ? form.email : '' });
                        }}
                      />
                      Usar o mesmo e-mail do estabelecimento
                    </label>
                  )}
                </>
              ) : (
                <div className="rounded-[24px] border border-dashed border-border bg-background/55 p-5">
                  <p className="font-bold text-stone-800">Sem lojista vinculado</p>
                  <p className="mt-1 text-sm text-stone-500">Crie a conta do responsável principal para liberar o acesso ao painel da loja.</p>
                  <button
                    type="button"
                    className="mt-4 rounded-2xl bg-ink px-4 py-2.5 text-sm font-black text-white shadow-sm"
                    onClick={() => {
                      const item = items.find((value) => value._id === editing);
                      if (item) {
                        setOwnerForm(blankUser);
                        setModalError('');
                        setAddingOwner(item);
                      }
                    }}
                  >
                    Criar lojista responsável
                  </button>
                </div>
              )}

              <div className="mt-5 rounded-[24px] border border-border bg-background/55 p-4 text-sm text-stone-500">
                <b className="block text-stone-800">Dica de estrutura</b>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>Cadastre logo e banners separados para desktop e mobile.</li>
                  <li>Utilize um slug curto e fácil de memorizar.</li>
                  <li>Informe o WhatsApp correto para pedidos e relatórios.</li>
                </ul>
              </div>
            </SectionCard>
          </div>

          {formError && <p role="alert" className="mt-5 rounded-[20px] border border-danger/20 bg-danger/10 p-4 text-sm font-semibold text-danger">{formError}</p>}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => { setShowForm(false); setEditing(undefined); setEditingOwnerId(undefined); setFormError(''); setSameEmail(false); }} className="min-h-11 rounded-2xl border border-border bg-white px-5 py-3 text-sm font-black text-stone-700">Fechar</button>
            <button type="submit" disabled={submitting} className="min-h-11 rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">{submitting ? (editing ? 'Salvando...' : 'Cadastrando...') : editing ? 'Salvar edição' : 'Cadastrar estabelecimento e usuário'}</button>
          </div>
        </form>
      )}

      <div className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.16em] text-accent">Filtros e busca</span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">Visualizar base de estabelecimentos</h2>
            <p className="mt-1 text-sm text-stone-500">Busque por nome ou slug e refine por tipo ou status operacional.</p>
          </div>
          <div className="rounded-2xl border border-border bg-background/55 px-4 py-3 text-sm font-semibold text-stone-600">{filtered.length} {filtered.length === 1 ? 'resultado' : 'resultados'}</div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(220px,.6fr)_minmax(220px,.6fr)]">
          <input className="field !mt-0" placeholder="Buscar por nome, slug ou nome fantasia" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="field !mt-0" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos os tipos</option>
            {establishmentTypes.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}
          </select>
          <select className="field !mt-0" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="blocked">Bloqueados</option>
            <option value="open">Abertos</option>
            <option value="closed">Fechados</option>
          </select>
        </div>
      </div>

      {message && <p aria-live="polite" className="rounded-[22px] border border-border bg-surface px-4 py-3 text-sm font-semibold text-stone-700">{message}</p>}

      <div className="space-y-5">
        {filtered.length ? filtered.map((item) => {
          const users = storeUsers[item._id] || [];
          return (
            <article key={item._id} className="rounded-[30px] border border-border/90 bg-white p-5 shadow-[0_14px_36px_rgba(41,37,36,.05)] sm:p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex min-w-0 items-start gap-4 sm:gap-5">
                  {item.logoUrl ? (
                    <img src={item.logoUrl} alt={`Logo de ${item.tradeName || item.name}`} className="h-16 w-16 shrink-0 rounded-[18px] border border-border bg-white object-cover shadow-sm sm:h-20 sm:w-20" />
                  ) : (
                    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[18px] bg-primary text-xl font-black text-white shadow-sm sm:h-20 sm:w-20 sm:text-2xl">{(item.tradeName || item.name).charAt(0)}</span>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[.14em] ${item.blocked ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>{item.blocked ? 'Bloqueado' : 'Ativo'}</span>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[.14em] ${item.open && !item.blocked ? 'bg-gold/20 text-amber-700' : 'bg-stone-100 text-stone-600'}`}>{item.open && !item.blocked ? 'Aberto agora' : 'Fechado'}</span>
                    </div>
                    <h3 className="mt-3 break-words text-2xl font-black tracking-tight text-stone-900">{item.tradeName || item.name}</h3>
                    <p className="mt-1 text-sm font-semibold text-stone-500">/{item.slug}</p>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-500">{item.description || 'Sem descrição cadastrada.'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 xl:max-w-[420px] xl:justify-end">
                  <ActionLink href={`/admin/restaurantes/${item._id}`} primary>Gerenciar</ActionLink>
                  <ActionButton disabled={loadingDetail} onClick={() => void edit(item)}>{item.owner ? 'Editar estabelecimento / lojista' : 'Editar estabelecimento'}</ActionButton>
                  {!item.owner && <ActionButton onClick={() => { setOwnerForm(blankUser); setModalError(''); setAddingOwner(item); }}>Criar lojista responsável</ActionButton>}
                  <ActionButton onClick={() => void toggle(item)} danger={item.blocked}>{item.blocked ? 'Desbloquear estabelecimento' : 'Bloquear estabelecimento'}</ActionButton>
                  <ActionButton onClick={() => { setEmployeeForm(blankUser); setModalError(''); setAddingEmployee(item); }}>Adicionar funcionário</ActionButton>
                  <ActionButton onClick={() => void showUsers(item)}>{expanded === item._id ? 'Ocultar usuários' : 'Ver funcionários / usuários'}</ActionButton>
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <InfoTile label="Tipo" value={item.establishmentTypeName ?? legacyEstablishmentLabel(item.establishmentType)} />
                <InfoTile label="Cidade / UF" value={[item.city || '—', item.state || '—'].join(' / ')} />
                <InfoTile label="Lojista responsável" value={item.owner?.name ?? 'Sem lojista vinculado'} />
                <InfoTile label="E-mail" value={item.owner?.email ?? item.email ?? '—'} />
                <InfoTile label="Funcionários" value={String(item.employeeCount)} />
              </div>

              {expanded === item._id && (
                <div className="mt-5 rounded-[26px] border border-border bg-background/50 p-4 sm:p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-lg font-black tracking-tight text-stone-900">Usuários do estabelecimento</h4>
                      <p className="text-sm text-stone-500">Gerencie lojista responsável e funcionários vinculados a esta loja.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[.14em] text-stone-600 shadow-sm">{users.length} {users.length === 1 ? 'usuário' : 'usuários'}</span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {users.length ? users.map((user) => (
                      <div key={user.id} className="rounded-[22px] border border-border bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <b className="text-base text-stone-900">{user.name}</b>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] ${user.role === 'RESTAURANT_ADMIN' ? 'bg-primary/10 text-primary' : 'bg-accent/10 text-accent'}`}>{user.role === 'RESTAURANT_ADMIN' ? 'Lojista' : 'Funcionário'}</span>
                              <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.14em] ${user.active ? 'bg-success/10 text-success' : 'bg-stone-100 text-stone-600'}`}>{user.active ? 'Ativo' : 'Inativo'}</span>
                            </div>
                            <p className="mt-1 break-all text-sm text-stone-500">{user.email}</p>
                            {user.phone && <p className="mt-1 text-sm text-stone-500">Telefone: {user.phone}</p>}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <ActionButton onClick={() => { setModalError(''); setUserEditForm({ ...blankUser, ...user }); setEditingUser({ restaurant: item, user }); }}>Editar</ActionButton>
                            {user.role === 'EMPLOYEE' && <ActionButton danger onClick={() => void deleteEmployee(item, user)}>Excluir</ActionButton>}
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-[22px] border border-dashed border-border bg-white p-6 text-center text-sm font-semibold text-stone-500">Nenhum usuário encontrado para este estabelecimento.</div>
                    )}
                  </div>
                </div>
              )}
            </article>
          );
        }) : (
          <div className="rounded-[30px] border border-dashed border-border bg-white px-6 py-12 text-center shadow-sm">
            <h3 className="text-2xl font-black tracking-tight text-stone-900">Nenhum estabelecimento encontrado</h3>
            <p className="mt-2 text-stone-500">Ajuste os filtros ou revise a base cadastrada.</p>
          </div>
        )}
      </div>

      {addingOwner && (
        <Modal title="Criar lojista responsável" error={modalError} close={closeModals}>
          <form onSubmit={addOwner} onInvalid={invalid}>{userFields(ownerForm, setOwnerForm, false, true)}<Submit loading={submitting} idle="Criar lojista responsável" busy="Criando lojista..." /></form>
        </Modal>
      )}
      {addingEmployee && (
        <Modal title="Adicionar funcionário" error={modalError} close={closeModals}>
          <form onSubmit={addEmployee} onInvalid={invalid}>{userFields(employeeForm, setEmployeeForm)}<Submit loading={submitting} idle="Adicionar funcionário" busy="Adicionando..." /></form>
        </Modal>
      )}
      {editingUser && (
        <Modal title={`Editar ${editingUser.user.role === 'RESTAURANT_ADMIN' ? 'lojista' : 'funcionário'}`} error={modalError} close={closeModals}>
          <form onSubmit={updateUser} onInvalid={invalid}>{userFields(userEditForm, setUserEditForm, true, editingUser.user.role === 'RESTAURANT_ADMIN')}<Submit loading={submitting} idle="Salvar usuário" busy="Salvando..." /></form>
        </Modal>
      )}
    </section>
  );
}

function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-border bg-background/45 p-4 sm:p-5">
      <h3 className="text-lg font-black tracking-tight text-stone-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-stone-500">{description}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number | string; tone: 'primary' | 'success' | 'danger' | 'gold' }) {
  const toneClass = tone === 'success' ? 'bg-success/10 text-success' : tone === 'danger' ? 'bg-danger/10 text-danger' : tone === 'gold' ? 'bg-gold/20 text-amber-700' : 'bg-primary/10 text-primary';
  return (
    <article className="rounded-[24px] border border-border/90 bg-white p-5 shadow-[0_12px_30px_rgba(41,37,36,.05)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold text-stone-500">{label}</p>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[.16em] ${toneClass}`}>Indicador</span>
      </div>
      <strong className="mt-3 block text-[30px] font-black tracking-tight text-stone-900">{value}</strong>
    </article>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-border bg-background/45 px-4 py-3">
      <span className="block text-[11px] font-black uppercase tracking-[.14em] text-stone-400">{label}</span>
      <span className="mt-1 block break-words text-sm font-semibold text-stone-700">{value}</span>
    </div>
  );
}

function Modal({ title, error, close, children }: { title: string; error: string; close: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[30px] border border-white/10 bg-surface p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-[.14em] text-primary">Gestão de acesso</span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-stone-900">{title}</h2>
          </div>
          <button type="button" onClick={close} aria-label="Fechar" className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-white font-bold text-stone-700">✕</button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-2xl border border-danger/20 bg-danger/10 p-3 text-sm font-semibold text-danger">{error}</p>}
        {children}
      </div>
    </div>
  );
}

function Submit({ loading, idle, busy }: { loading: boolean; idle: string; busy: string }) {
  return <button type="submit" disabled={loading} className="mt-6 min-h-11 rounded-2xl bg-ink px-6 py-3 text-sm font-black text-white shadow-sm disabled:opacity-60">{loading ? busy : idle}</button>;
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

function ActionLink({ href, children, primary = false }: { href: string; children: string; primary?: boolean }) {
  return (
    <Link href={href} className={`inline-flex min-h-10 items-center rounded-2xl border px-4 py-2 text-sm font-black transition ${primary ? 'border-transparent bg-ink text-white shadow-sm hover:bg-primary-hover' : 'border-border bg-white text-stone-700 hover:border-primary/20 hover:bg-primary/5'}`}>
      {children}
    </Link>
  );
}
