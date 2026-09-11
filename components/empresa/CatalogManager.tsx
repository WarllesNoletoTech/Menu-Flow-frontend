'use client';

import Link from 'next/link';
import {
  createContext,
  Dispatch,
  FormEvent,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useEmpresa } from './EmpresaContext';
import type { Category, Product } from './types';
import { RequestSequencer } from '../../lib/request-sequencer';

type CatalogContextValue = {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  base: string;
  establishment?: { slug?: string };
  categories: Category[];
  products: Product[];
  loading: boolean;
  loadError: string | null;
  refresh: () => Promise<void>;
  invalidateLoads: () => void;
  setCategories: Dispatch<SetStateAction<Category[]>>;
  setProducts: Dispatch<SetStateAction<Product[]>>;
};

type Addon = { _id?: string; name: string; price: string };
type Group = { _id?: string; name: string; required: boolean; min: string; max: string; addons: Addon[] };
type ProductForm = {
  name: string;
  categoryId: string;
  price: string;
  promotionalPrice: string;
  description: string;
  imageUrl: string;
  available: boolean;
  featured: boolean;
  addonGroups: Group[];
};

type NoticeKind = 'success' | 'error' | 'info';
type NoticeState = { text: string; kind: NoticeKind } | null;

const blankProduct: ProductForm = {
  name: '',
  categoryId: '',
  price: '',
  promotionalPrice: '',
  description: '',
  imageUrl: '',
  available: true,
  featured: false,
  addonGroups: [],
};

const CatalogContext = createContext<CatalogContextValue | null>(null);

function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('CatalogManager requer contexto');
  return value;
}

export function CatalogManager({
  request,
  base,
  establishment,
}: {
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  base: string;
  establishment?: { slug?: string };
}) {
  const [tab, setTab] = useState<'products' | 'categories' | 'preview'>('products');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSequence = useRef(new RequestSequencer());

  const invalidateLoads = useCallback(() => {
    requestSequence.current.invalidate();
  }, []);

  const refresh = useCallback(async () => {
    const sequence = requestSequence.current.begin();
    setLoading(true);
    setLoadError(null);
    try {
      const [categoryResult, productResult] = await Promise.all([
        request<unknown>(`${base}/categories`, { cache: 'no-store' }),
        request<unknown>(`${base}/products`, { cache: 'no-store' }),
      ]);
      if (!requestSequence.current.isCurrent(sequence)) return;
      setCategories(sortByOrder(expectArray<Category>(categoryResult, 'categorias')));
      setProducts(expectArray<Product>(productResult, 'produtos'));
    } catch (error) {
      if (requestSequence.current.isCurrent(sequence)) setLoadError(msg(error));
    } finally {
      if (requestSequence.current.isCurrent(sequence)) setLoading(false);
    }
  }, [base, request]);

  useEffect(() => {
    void refresh();
    return invalidateLoads;
  }, [invalidateLoads, refresh]);

  return (
    <CatalogContext.Provider value={{ request, base, establishment, categories, products, loading, loadError, refresh, invalidateLoads, setCategories, setProducts }}>
      <section className="mx-auto max-w-7xl">
        <div>
          <h2 className="text-3xl font-black">Cardápio</h2>
          <p className="text-stone-500">Gerencie categorias, produtos, preços, disponibilidade e adicionais.</p>
        </div>

        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Seções do cardápio">
          {([
            ['products', 'Produtos'],
            ['categories', 'Categorias'],
            ['preview', 'Prévia'],
          ] as const).map(([id, label]) => (
            <button
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
              key={id}
              className={`rounded-xl px-5 py-3 font-bold ${tab === id ? 'bg-ink text-white' : 'border bg-surface hover:bg-background'}`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === 'products' ? (
          <ProductsManager onCreateCategory={() => setTab('categories')} />
        ) : tab === 'categories' ? (
          <CategoriesManager />
        ) : (
          <Preview />
        )}
      </section>
    </CatalogContext.Provider>
  );
}

export function MerchantCatalogManager() {
  const { request, establishment } = useEmpresa();
  return <CatalogManager request={request} base="/restaurants/me/catalog" establishment={establishment ?? undefined} />;
}

export function CategoriesManager() {
  const { request, base, categories: items, products, loading, loadError, refresh, invalidateLoads, setCategories: setItems } = useCatalog();
  const [name, setName] = useState('');
  const [notice, setNotice] = useState<NoticeState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  async function add(event: FormEvent) {
    event.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setNotice({ text: 'Informe o nome da categoria.', kind: 'error' });
      return;
    }
    if (items.some((item) => item.name.trim().toLocaleLowerCase('pt-BR') === cleanName.toLocaleLowerCase('pt-BR'))) {
      setNotice({ text: 'Já existe uma categoria com esse nome.', kind: 'error' });
      return;
    }

    setBusyId('create');
    setNotice(null);
    try {
      const created = await request<Category>(`${base}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: cleanName, order: items.length }),
      });
      assertEntity(created, 'categoria');
      invalidateLoads();
      setItems((current) => sortByOrder([...current.filter((item) => item._id !== created._id), created]));
      await refresh();
      setName('');
      setNotice({ text: 'Categoria criada com sucesso.', kind: 'success' });
    } catch (error) {
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function update(item: Category, changes: Partial<Category>) {
    setBusyId(item._id);
    try {
      const updated = await request<Category>(`${base}/categories/${item._id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      assertEntity(updated, 'categoria');
      invalidateLoads();
      setItems((current) => current.map((entry) => (entry._id === updated._id ? updated : entry)));
      await refresh();
      setNotice({ text: 'Categoria atualizada.', kind: 'success' });
    } catch (error) {
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function archive(item: Category) {
    const count = products.filter((product) => categoryId(product) === item._id && !product.archivedAt).length;
    if (count > 0) {
      setNotice({ text: `A categoria possui ${count} produto(s). Arquive ou mova esses produtos primeiro.`, kind: 'error' });
      return;
    }
    if (!window.confirm(`Arquivar a categoria “${item.name}”?`)) return;
    setBusyId(item._id);
    try {
      await request(`${base}/categories/${item._id}/archive`, { method: 'PATCH' });
      invalidateLoads();
      setItems((current) => current.filter((entry) => entry._id !== item._id));
      await refresh();
      setNotice({ text: 'Categoria arquivada com segurança.', kind: 'success' });
    } catch (error) {
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function move(index: number, delta: number) {
    const other = index + delta;
    if (other < 0 || other >= items.length) return;

    const before = items;
    const reordered = [...items];
    [reordered[index], reordered[other]] = [reordered[other], reordered[index]];
    const withOrder = reordered.map((item, order) => ({ ...item, order }));
    setItems(withOrder);
    setBusyId('reorder');

    try {
      await request(`${base}/categories/reorder`, {
        method: 'PATCH',
        body: JSON.stringify(withOrder.map((item) => ({ id: item._id, order: item.order }))),
      });
      setNotice({ text: 'Ordem das categorias atualizada.', kind: 'success' });
    } catch (error) {
      setItems(before);
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <form onSubmit={add} className="flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-sm sm:flex-row">
        <input
          required
          maxLength={80}
          className="field !mt-0"
          placeholder="Ex.: Pizzas, Hambúrgueres, Bebidas"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="submit"
          disabled={busyId !== null || !name.trim()}
          className="rounded-xl bg-ink px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyId === 'create' ? 'Criando…' : 'Criar categoria'}
        </button>
      </form>

      {(notice || loadError) && <Notice state={notice ?? { text: loadError!, kind: 'error' }} />}

      {loading ? (
        <LoadingCard text="Carregando categorias…" />
      ) : !items.length ? (
        <Empty text="Crie sua primeira categoria para começar a montar o cardápio." />
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item, index) => (
            <CategoryRow
              key={item._id}
              item={item}
              index={index}
              total={items.length}
              busy={busyId !== null}
              saving={busyId === item._id}
              onUpdate={update}
              onMove={move}
              onArchive={archive}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryRow({
  item,
  index,
  total,
  busy,
  saving,
  onUpdate,
  onMove,
  onArchive,
}: {
  item: Category;
  index: number;
  total: number;
  busy: boolean;
  saving: boolean;
  onUpdate: (item: Category, changes: Partial<Category>) => Promise<void>;
  onMove: (index: number, delta: number) => Promise<void>;
  onArchive: (item: Category) => Promise<void>;
}) {
  const [draftName, setDraftName] = useState(item.name);
  useEffect(() => setDraftName(item.name), [item.name]);
  const cleanName = draftName.trim();
  const changed = Boolean(cleanName) && cleanName !== item.name;

  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-surface p-4 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label className="text-xs font-bold uppercase tracking-wide text-stone-500">Nome</label>
        <input
          aria-label={`Nome da categoria ${item.name}`}
          maxLength={80}
          className="field !mt-1 font-bold"
          value={draftName}
          disabled={saving}
          onChange={(event) => setDraftName(event.target.value)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !changed}
          onClick={() => void onUpdate(item, { name: cleanName })}
          className="rounded-xl border px-4 py-2 text-sm font-bold disabled:opacity-40"
        >
          {saving ? 'Salvando…' : 'Salvar nome'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onUpdate(item, { active: !item.active })}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${item.active ? 'bg-success/15 text-success' : 'bg-stone-200 text-stone-600'}`}
        >
          {item.active ? 'Ativa' : 'Inativa'}
        </button>
        <button
          type="button"
          disabled={busy || index === 0}
          aria-label={`Mover ${item.name} para cima`}
          title="Mover para cima"
          onClick={() => void onMove(index, -1)}
          className="rounded-xl border bg-surface px-3 py-2 font-bold disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          disabled={busy || index === total - 1}
          aria-label={`Mover ${item.name} para baixo`}
          title="Mover para baixo"
          onClick={() => void onMove(index, 1)}
          className="rounded-xl border bg-surface px-3 py-2 font-bold disabled:opacity-30"
        >
          ↓
        </button>
        <button type="button" disabled={busy} onClick={() => void onArchive(item)} className="rounded-xl border px-4 py-2 text-sm font-bold text-danger disabled:opacity-40">
          Arquivar
        </button>
      </div>
    </article>
  );
}

export function ProductsManager({ onCreateCategory }: { onCreateCategory: () => void }) {
  const { request, base, products, categories, loading, loadError, refresh, invalidateLoads, setProducts } = useCatalog();
  const [form, setForm] = useState<ProductForm>(blankProduct);
  const [editing, setEditing] = useState<string>();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'all' | 'available' | 'unavailable'>('all');
  const [featured, setFeatured] = useState(false);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && busyId !== 'save') setOpen(false);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [busyId]);

  const shown = useMemo(
    () =>
      products.filter(
        (product) =>
          (!search || product.name.toLowerCase().includes(search.toLowerCase())) &&
          (!category || categoryId(product) === category) &&
          (status === 'all' || product.available === (status === 'available')) &&
          (!featured || product.featured),
      ),
    [products, search, category, status, featured],
  );

  const productGroups = useMemo(() => sortByOrder(categories).flatMap((categoryItem) => {
    const categoryProducts = shown
      .filter((product) => categoryId(product) === categoryItem._id)
      .sort(compareProducts);
    return categoryProducts.length ? [{ category: categoryItem, products: categoryProducts }] : [];
  }), [categories, shown]);

  const catalogStats = useMemo(() => ({
    total: products.length,
    available: products.filter((product) => product.available).length,
    featured: products.filter((product) => product.featured).length,
    promotions: products.filter((product) => product.promotionalPrice !== undefined && product.promotionalPrice < product.price).length,
  }), [products]);

  function startCreate() {
    if (!categories.length) {
      setNotice({ text: 'Crie pelo menos uma categoria antes de adicionar produtos.', kind: 'info' });
      onCreateCategory();
      return;
    }
    setEditing(undefined);
    setForm({ ...blankProduct, categoryId: categories[0]._id });
    setOpen(true);
  }

  function edit(product: Product) {
    setEditing(product._id);
    setForm({
      name: product.name,
      categoryId: categoryId(product),
      price: String(product.price),
      promotionalPrice: product.promotionalPrice === undefined ? '' : String(product.promotionalPrice),
      description: product.description ?? '',
      imageUrl: product.imageUrl ?? '',
      available: product.available,
      featured: product.featured,
      addonGroups: (product.addonGroups ?? []).map((group) => ({
        ...group,
        required: Boolean(group.required),
        min: String(group.min ?? 0),
        max: String(group.max ?? 1),
        addons: group.addons.map((addon) => ({ ...addon, price: String(addon.price) })),
      })),
    });
    setOpen(true);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const cleanName = form.name.trim();
    if (!cleanName) {
      setNotice({ text: 'Informe o nome do produto.', kind: 'error' });
      return;
    }
    if (!/^[a-f\d]{24}$/i.test(form.categoryId)) {
      setNotice({ text: 'Selecione uma categoria válida para o produto.', kind: 'error' });
      return;
    }

    const price = Number(form.price);
    const promo = form.promotionalPrice === '' ? undefined : Number(form.promotionalPrice);
    if (!Number.isFinite(price) || price < 0) {
      setNotice({ text: 'Informe um preço válido.', kind: 'error' });
      return;
    }
    if (promo !== undefined && (!Number.isFinite(promo) || promo < 0 || promo > price)) {
      setNotice({ text: 'O preço promocional deve ser válido e não pode superar o preço normal.', kind: 'error' });
      return;
    }

    const addonError = validateAddonGroups(form.addonGroups);
    if (addonError) {
      setNotice({ text: addonError, kind: 'error' });
      return;
    }

    setBusyId('save');
    setNotice(null);
    try {
      const description = form.description.trim();
      const imageUrl = form.imageUrl.trim();
      const body = {
        categoryId: form.categoryId,
        name: cleanName,
        price,
        ...(editing ? { promotionalPrice: promo ?? null } : promo !== undefined ? { promotionalPrice: promo } : {}),
        ...(editing ? { description: description || null } : description ? { description } : {}),
        ...(editing ? { imageUrl: imageUrl || null } : imageUrl ? { imageUrl } : {}),
        available: form.available,
        featured: form.featured,
        addonGroups: form.addonGroups.map((group) => ({
          ...(group._id ? { _id: group._id } : {}),
          name: group.name.trim(),
          required: group.required,
          min: Number(group.min),
          max: Number(group.max),
          addons: group.addons.map((addon) => ({ ...(addon._id ? { _id: addon._id } : {}), name: addon.name.trim(), price: Number(addon.price) })),
        })),
      };

      const saved = await request<Product>(`${base}/products${editing ? `/${editing}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      assertEntity(saved, 'produto');
      invalidateLoads();
      setProducts((current) => {
        if (editing) return current.map((product) => (product._id === saved._id ? saved : product));
        return [...current, saved];
      });
      await refresh();
      setOpen(false);
      setForm(blankProduct);
      setEditing(undefined);
      setNotice({ text: 'Produto salvo com sucesso.', kind: 'success' });
    } catch (error) {
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function quick(product: Product, changes: Partial<Product>) {
    setBusyId(product._id);
    try {
      const updated = await request<Product>(`${base}/products/${product._id}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      });
      assertEntity(updated, 'produto');
      invalidateLoads();
      setProducts((current) => current.map((entry) => (entry._id === updated._id ? updated : entry)));
      await refresh();
      setNotice({ text: 'Produto atualizado.', kind: 'success' });
    } catch (error) {
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function moveProduct(product: Product, delta: number) {
    const productCategoryId = categoryId(product);
    const siblings = products.filter((item) => categoryId(item) === productCategoryId).sort(compareProducts);
    const index = siblings.findIndex((item) => item._id === product._id);
    const other = index + delta;
    if (other < 0 || other >= siblings.length) return;
    const before = [...products];
    const reorderedSiblings = [...siblings];
    [reorderedSiblings[index], reorderedSiblings[other]] = [reorderedSiblings[other], reorderedSiblings[index]];
    const reordered = reorderedSiblings.map((item, order) => ({ ...item, order }));
    setProducts((current) => current.map((item) => reordered.find((entry) => entry._id === item._id) ?? item));
    setBusyId(`reorder:${productCategoryId}`);
    try {
      await request(`${base}/products/reorder`, { method: 'PATCH', body: JSON.stringify(reordered.map((item) => ({ id: item._id, order: item.order }))) });
      invalidateLoads();
      await refresh();
      setNotice({ text: 'Ordem dos produtos atualizada.', kind: 'success' });
    } catch (error) {
      setProducts(before);
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  async function archive(product: Product) {
    if (!window.confirm(`Arquivar o produto “${product.name}”?`)) return;
    setBusyId(product._id);
    try {
      await request(`${base}/products/${product._id}/archive`, { method: 'PATCH' });
      invalidateLoads();
      setProducts((current) => current.filter((entry) => entry._id !== product._id));
      await refresh();
      setNotice({ text: 'Produto arquivado com segurança.', kind: 'success' });
    } catch (error) {
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="grid gap-3 rounded-2xl border bg-surface p-4 lg:grid-cols-[minmax(220px,1.3fr)_minmax(190px,1fr)_minmax(170px,.8fr)_auto_auto] lg:items-center">
        <input className="field !mt-0" placeholder="Buscar produto…" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="field !mt-0" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((item) => (
            <option key={item._id} value={item._id}>{item.name}</option>
          ))}
        </select>
        <select className="field !mt-0" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="all">Todos</option>
          <option value="available">Disponíveis</option>
          <option value="unavailable">Indisponíveis</option>
        </select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl px-2 font-bold">
          <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /> Destaques
        </label>
        <button type="button" onClick={startCreate} className="rounded-xl bg-ink px-5 py-3 font-bold text-white">
          + Novo produto
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CatalogStat label="Produtos" value={catalogStats.total} />
        <CatalogStat label="Disponíveis" value={catalogStats.available} />
        <CatalogStat label="Em destaque" value={catalogStats.featured} accent />
        <CatalogStat label="Em promoção" value={catalogStats.promotions} danger />
      </div>

      {(notice || loadError) && <Notice state={notice ?? { text: loadError!, kind: 'error' }} />}

      {loading ? (
        <LoadingCard text="Carregando produtos…" />
      ) : !categories.length ? (
        <EmptyAction
          text="Antes de adicionar produtos, crie a primeira categoria do seu cardápio."
          action="Criar categoria"
          onClick={onCreateCategory}
        />
      ) : !products.length ? (
        <EmptyAction text="Seu cardápio ainda não possui produtos." action="Adicionar primeiro produto" onClick={startCreate} />
      ) : !shown.length ? (
        <Empty text="Nenhum produto corresponde aos filtros atuais." />
      ) : (
        <div className="mt-5 space-y-7">
          {productGroups.map(({ category: categoryItem, products: categoryProducts }) => (
            <section key={categoryItem._id} aria-labelledby={`product-category-${categoryItem._id}`}>
              <header className="mb-3 flex flex-wrap items-end justify-between gap-2 border-b border-accent/20 pb-2">
                <div><h2 id={`product-category-${categoryItem._id}`} className="text-lg font-black text-ink">{categoryItem.name}</h2><p className="text-xs font-semibold text-stone-500">{categoryProducts.filter((product) => product.available).length} disponíveis · {categoryProducts.filter((product) => product.featured).length} em destaque</p></div>
                <span className="text-sm font-bold text-stone-500">{categoryProducts.length} {categoryProducts.length === 1 ? 'produto' : 'produtos'}</span>
              </header>
              <div className="grid gap-4 lg:grid-cols-2">
          {categoryProducts.map((product, productIndex) => (
            <article key={product._id} className={`relative flex gap-4 overflow-hidden rounded-2xl border bg-surface p-4 shadow-sm transition hover:shadow-soft ${product.featured ? 'border-accent/50 ring-1 ring-accent/20' : 'border-border'}`}>
              {product.imageUrl ? (
                <img src={product.imageUrl} alt={product.name} className="h-24 w-24 shrink-0 rounded-xl object-cover" />
              ) : (
                <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed bg-background text-stone-500"><span className="text-2xl" aria-hidden="true">🍽</span><span className="mt-1 text-[10px] font-bold">Sem imagem</span></div>
              )}
              <div className="min-w-0 flex-1">
                {product.featured && <span className="mb-2 inline-flex rounded-full bg-accent px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">★ Destaque</span>}
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <strong className="break-words text-lg">{product.name}</strong>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${product.available ? 'bg-success/15 text-success' : 'bg-stone-200 text-stone-600'}`}>
                    {product.available ? 'Disponível' : 'Indisponível'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-500">{categories.find((item) => item._id === categoryId(product))?.name ?? 'Sem categoria'}</p>
                <p className="mt-2 font-bold">
                  {product.promotionalPrice !== undefined && <><span className="mr-2 rounded-full bg-danger/10 px-2 py-1 text-[10px] font-black uppercase text-danger">Oferta</span><s className="mr-2 font-bold text-danger decoration-2">{money(product.price)}</s></>}
                  <span className="text-lg text-ink">{money(product.promotionalPrice ?? product.price)}</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => edit(product)} className="rounded-lg border px-3 py-2 text-sm font-bold">Editar</button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void quick(product, { available: !product.available })}
                    className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {busyId === product._id ? 'Salvando…' : product.available ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void quick(product, { featured: !product.featured })}
                    className="rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    {product.featured ? 'Remover destaque' : 'Destacar'}
                  </button>
                  <button type="button" disabled={busyId !== null} onClick={() => void archive(product)} className="rounded-lg border px-3 py-2 text-sm font-bold text-danger disabled:opacity-50">
                    Arquivar
                  </button>
                  <button type="button" aria-label={`Mover ${product.name} para cima`} disabled={busyId !== null || productIndex === 0} onClick={() => void moveProduct(product, -1)} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-30">↑</button>
                  <button type="button" aria-label={`Mover ${product.name} para baixo`} disabled={busyId !== null || productIndex === categoryProducts.length - 1} onClick={() => void moveProduct(product, 1)} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-30">↓</button>
                </div>
              </div>
            </article>
          ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {open && (
        <ProductModal
          form={form}
          setForm={setForm}
          categories={categories}
          editing={Boolean(editing)}
          busy={busyId === 'save'}
          close={() => {
            if (busyId !== 'save') setOpen(false);
          }}
          save={save}
        />
      )}
    </div>
  );
}

function ProductModal({
  form,
  setForm,
  categories,
  editing,
  busy,
  close,
  save,
}: {
  form: ProductForm;
  setForm: (value: ProductForm) => void;
  categories: Category[];
  editing: boolean;
  busy: boolean;
  close: () => void;
  save: (event: FormEvent) => void;
}) {
  const setGroup = (index: number, group: Group) => {
    setForm({ ...form, addonGroups: form.addonGroups.map((entry, position) => (position === index ? group : entry)) });
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={editing ? 'Editar produto' : 'Novo produto'} className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 p-3 sm:p-8">
      <form onSubmit={save} className="mx-auto my-3 max-w-4xl rounded-2xl bg-surface p-5 shadow-2xl sm:my-0 sm:p-7">
        <header className="flex items-start justify-between gap-4 border-b pb-4">
          <div>
            <h3 className="text-2xl font-black">{editing ? 'Editar produto' : 'Novo produto'}</h3>
            <p className="mt-1 text-sm text-stone-500">Preencha os dados principais e, se quiser, adicione opções ao produto.</p>
          </div>
          <button type="button" disabled={busy} aria-label="Fechar" onClick={close} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-50">✕</button>
        </header>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Nome *"><input required maxLength={120} className="field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Categoria *">
            <select required className="field" value={form.categoryId} onChange={(event) => setForm({ ...form, categoryId: event.target.value })}>
              {categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
            </select>
          </Field>
          <Field label="Preço *"><input required min="0" step="0.01" inputMode="decimal" type="number" className="field" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} /></Field>
          <Field label="Preço promocional"><input min="0" step="0.01" inputMode="decimal" type="number" className="field" value={form.promotionalPrice} onChange={(event) => setForm({ ...form, promotionalPrice: event.target.value })} /></Field>
          <Field label="URL da imagem (HTTPS)">
            <input pattern="https://.*" type="url" className="field" placeholder="https://..." value={form.imageUrl} onChange={(event) => setForm({ ...form, imageUrl: event.target.value })} />
            {form.imageUrl && <img src={form.imageUrl} alt="Prévia do produto" className="mt-2 h-28 w-28 rounded-xl object-cover" />}
          </Field>
          <label className="font-bold sm:col-span-2">Descrição<textarea maxLength={600} rows={4} className="field resize-y" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <label className="flex items-center gap-2 rounded-xl border p-3 font-bold"><input type="checkbox" checked={form.available} onChange={(event) => setForm({ ...form, available: event.target.checked })} /> Disponível para venda</label>
          <label className="flex items-center gap-2 rounded-xl border p-3 font-bold"><input type="checkbox" checked={form.featured} onChange={(event) => setForm({ ...form, featured: event.target.checked })} /> Destacar no cardápio</label>
        </div>

        <div className="mt-7 border-t pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-black">Adicionais / opções</h4>
              <p className="text-sm text-stone-500">Ex.: tamanho, ponto da carne, adicionais ou acompanhamentos.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, addonGroups: [...form.addonGroups, { name: '', required: false, min: '0', max: '1', addons: [{ name: '', price: '0' }] }] })}
              className="rounded-xl border px-4 py-2 font-bold"
            >
              + Adicionar grupo
            </button>
          </div>

          {form.addonGroups.map((group, index) => (
            <div key={index} className="mt-4 rounded-2xl border bg-background/40 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input required className="field !mt-0" placeholder="Nome do grupo" value={group.name} onChange={(event) => setGroup(index, { ...group, name: event.target.value })} />
                <input required min="0" type="number" className="field !mt-0" aria-label="Quantidade mínima" placeholder="Mínimo" value={group.min} onChange={(event) => setGroup(index, { ...group, min: event.target.value })} />
                <input required min="1" type="number" className="field !mt-0" aria-label="Quantidade máxima" placeholder="Máximo" value={group.max} onChange={(event) => setGroup(index, { ...group, max: event.target.value })} />
                <label className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 font-bold"><input type="checkbox" checked={group.required} onChange={(event) => setGroup(index, { ...group, required: event.target.checked, min: event.target.checked && Number(group.min) < 1 ? '1' : group.min })} /> Obrigatório</label>
              </div>

              {group.addons.map((addon, addonIndex) => (
                <div key={addonIndex} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(130px,.35fr)_48px]">
                  <input required className="field !mt-0" placeholder="Nome da opção" value={addon.name} onChange={(event) => setGroup(index, { ...group, addons: group.addons.map((entry, position) => position === addonIndex ? { ...entry, name: event.target.value } : entry) })} />
                  <input required min="0" step="0.01" inputMode="decimal" type="number" className="field !mt-0" aria-label="Preço adicional" value={addon.price} onChange={(event) => setGroup(index, { ...group, addons: group.addons.map((entry, position) => position === addonIndex ? { ...entry, price: event.target.value } : entry) })} />
                  <button type="button" aria-label="Remover opção" title="Remover opção" onClick={() => setGroup(index, { ...group, addons: group.addons.filter((_, position) => position !== addonIndex) })} className="rounded-xl border text-danger">✕</button>
                </div>
              ))}

              <div className="mt-3 flex flex-wrap gap-3">
                <button type="button" onClick={() => setGroup(index, { ...group, addons: [...group.addons, { name: '', price: '0' }] })} className="rounded-lg border px-3 py-2 text-sm font-bold">+ Adicionar opção</button>
                <button type="button" onClick={() => setForm({ ...form, addonGroups: form.addonGroups.filter((_, position) => position !== index) })} className="rounded-lg border px-3 py-2 text-sm font-bold text-danger">Remover grupo</button>
              </div>
            </div>
          ))}
        </div>

        <footer className="mt-7 flex flex-col-reverse gap-3 border-t pt-5 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={close} className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-ink px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Salvando…' : 'Salvar produto'}</button>
        </footer>
      </form>
    </div>
  );
}

function Preview() {
  const { establishment } = useCatalog();
  return (
    <div className="mt-6 rounded-2xl border bg-surface p-8 text-center">
      {establishment?.slug ? (
        <Link href={`/${establishment.slug}`} className="inline-flex rounded-xl bg-ink px-5 py-3 font-bold text-white">Ver cardápio público</Link>
      ) : (
        <p>O estabelecimento ainda não possui slug.</p>
      )}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="mt-5 rounded-2xl border-2 border-dashed bg-surface p-10 text-center font-bold">{text}</div>;
}

function EmptyAction({ text, action, onClick }: { text: string; action: string; onClick: () => void }) {
  return (
    <div className="mt-5 rounded-2xl border-2 border-dashed bg-surface p-8 text-center">
      <p className="font-bold">{text}</p>
      <button type="button" onClick={onClick} className="mt-4 rounded-xl bg-ink px-5 py-3 font-bold text-white">{action}</button>
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return <div className="mt-5 animate-pulse rounded-2xl border bg-surface p-10 text-center font-bold text-stone-500">{text}</div>;
}

function CatalogStat({ label, value, accent = false, danger = false }: { label: string; value: number; accent?: boolean; danger?: boolean }) {
  return <div className={`rounded-2xl border bg-surface p-4 shadow-sm ${accent ? 'border-accent/30' : danger ? 'border-danger/20' : 'border-border'}`}><p className="text-xs font-bold uppercase tracking-wide text-stone-500">{label}</p><p className={`mt-1 text-2xl font-black ${accent ? 'text-accent' : danger ? 'text-danger' : 'text-ink'}`}>{value}</p></div>;
}

function Notice({ state }: { state: Exclude<NoticeState, null> }) {
  const classes = state.kind === 'error'
    ? 'border-danger/20 bg-danger/10 text-danger'
    : state.kind === 'success'
      ? 'border-success/20 bg-success/10 text-success'
      : 'border-border bg-surface text-stone-600';
  return <p role={state.kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={`mt-4 rounded-xl border p-3 font-medium ${classes}`}>{state.text}</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="font-bold">{label}{children}</label>;
}

function msg(error: unknown) {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação.';
}

function categoryId(product: Product) {
  return typeof product.categoryId === 'string' ? product.categoryId : product.categoryId._id;
}

function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function expectArray<T>(value: unknown, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`A API retornou uma resposta inválida para ${label}.`);
  return value as T[];
}

function assertEntity(value: unknown, label: string): asserts value is { _id: string } {
  if (!value || typeof value !== 'object' || !('_id' in value) || typeof (value as { _id?: unknown })._id !== 'string') {
    throw new Error(`A API não confirmou a criação/atualização da ${label}.`);
  }
}

function sortByOrder<T extends { order: number }>(items: T[]) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || ('_id' in a && '_id' in b ? String(a._id).localeCompare(String(b._id)) : 0));
}

function compareProducts(a: Product, b: Product) {
  return (a.order ?? 0) - (b.order ?? 0) || a._id.localeCompare(b._id);
}

function validateAddonGroups(groups: Group[]) {
  const groupNames = new Set<string>();
  const addonNames = new Set<string>();
  for (const group of groups) {
    const groupName = group.name.trim();
    if (!groupName) return 'Informe o nome de todos os grupos de adicionais.';
    const normalizedGroup = groupName.toLocaleLowerCase('pt-BR');
    if (groupNames.has(normalizedGroup)) return 'Os grupos de adicionais precisam ter nomes diferentes.';
    groupNames.add(normalizedGroup);

    const min = Number(group.min);
    const max = Number(group.max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1 || min > max || max > group.addons.length) {
      return `Revise as quantidades mínima e máxima do grupo “${groupName}”.`;
    }
    if (group.required && min < 1) return `O grupo obrigatório “${groupName}” precisa exigir pelo menos uma opção.`;
    if (!group.addons.length) return `Adicione pelo menos uma opção ao grupo “${groupName}”.`;

    for (const addon of group.addons) {
      const addonName = addon.name.trim();
      if (!addonName) return `Informe o nome de todas as opções do grupo “${groupName}”.`;
      const normalizedAddon = addonName.toLocaleLowerCase('pt-BR');
      if (addonNames.has(normalizedAddon)) return `A opção “${addonName}” está duplicada neste produto.`;
      addonNames.add(normalizedAddon);
      const addonPrice = Number(addon.price);
      if (!Number.isFinite(addonPrice) || addonPrice < 0) return `Informe um preço válido para a opção “${addonName}”.`;
    }
  }
  return null;
}
