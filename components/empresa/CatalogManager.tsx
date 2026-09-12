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
import { CATALOG_TEMPLATES, PRODUCT_OPTION_PRESETS, catalogImportExample, findProductPreset, parseCatalogImport, type CatalogImportRow } from '../../lib/catalog-presets';

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
type Group = { _id?: string; name: string; required: boolean; min: string; max: string; pricingMode: 'SUM' | 'MAX'; addons: Addon[] };
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
  const [tab, setTab] = useState<'builder' | 'products' | 'categories' | 'preview'>('products');
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
            ['builder', 'Montagem rápida'],
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

        {tab === 'builder' ? (
          <SmartCatalogBuilder onGoProducts={() => setTab('products')} />
        ) : tab === 'products' ? (
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


function SmartCatalogBuilder({ onGoProducts }: { onGoProducts: () => void }) {
  const { request, base, categories, products, refresh, invalidateLoads } = useCatalog();
  const [templateId, setTemplateId] = useState(CATALOG_TEMPLATES[0].id);
  const [importText, setImportText] = useState('');
  const [notice, setNotice] = useState<NoticeState>(null);
  const [busy, setBusy] = useState<'template' | 'import' | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const selectedTemplate = CATALOG_TEMPLATES.find((item) => item.id === templateId) ?? CATALOG_TEMPLATES[0];
  const parsed = useMemo(() => parseCatalogImport(importText), [importText]);

  const normalize = (value: string) => value.trim().toLocaleLowerCase('pt-BR');

  async function applyTemplate() {
    const existingNames = new Set(categories.map((item) => normalize(item.name)));
    const missing = selectedTemplate.categories.filter((name) => !existingNames.has(normalize(name)));
    if (!missing.length) {
      setNotice({ text: 'A estrutura desse modelo já está criada no seu cardápio.', kind: 'info' });
      return;
    }
    if (!window.confirm(`Criar ${missing.length} categoria(s) do modelo ${selectedTemplate.label}? Nenhuma categoria ou produto atual será apagado.`)) return;
    setBusy('template');
    setNotice(null);
    try {
      for (let index = 0; index < missing.length; index += 1) {
        await request<Category>(`${base}/categories`, {
          method: 'POST',
          body: JSON.stringify({ name: missing[index], order: categories.length + index }),
        });
      }
      invalidateLoads();
      await refresh();
      setNotice({ text: `Modelo ${selectedTemplate.label} aplicado. Criamos apenas as categorias que estavam faltando.`, kind: 'success' });
    } catch (error) {
      setNotice({ text: msg(error), kind: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function readImportFile(file?: File) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setNotice({ text: 'Neste pacote, a importação automática aceita CSV e TXT. Para PDF ou foto, copie o texto reconhecido e cole no campo de importação.', kind: 'info' });
      return;
    }
    try {
      setImportText(await file.text());
      setNotice({ text: `Arquivo “${file.name}” carregado para revisão. Confira a prévia antes de importar.`, kind: 'success' });
    } catch {
      setNotice({ text: 'Não foi possível ler o arquivo selecionado.', kind: 'error' });
    }
  }

  function downloadExample() {
    const blob = new Blob([`\uFEFF${catalogImportExample()}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'modelo-importacao-cardapio-menuflow.csv';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function importCatalog() {
    if (!parsed.rows.length) {
      setNotice({ text: 'Adicione produtos válidos antes de iniciar a importação.', kind: 'error' });
      return;
    }
    const uniqueRows: CatalogImportRow[] = [];
    const inputKeys = new Set<string>();
    for (const row of parsed.rows) {
      const key = `${normalize(row.category)}::${normalize(row.name)}`;
      if (!inputKeys.has(key)) { inputKeys.add(key); uniqueRows.push(row); }
    }
    const existingCategoryByName = new Map(categories.map((item) => [normalize(item.name), item]));
    const existingProductByKey = new Map<string, Product>();
    for (const product of products) {
      const category = categories.find((item) => item._id === categoryId(product));
      existingProductByKey.set(`${normalize(category?.name ?? '')}::${normalize(product.name)}`, product);
    }

    const groupsForRow = (row: CatalogImportRow) => {
      const preset = findProductPreset(row.presetId);
      return (row.addonGroups ?? preset?.groups ?? []).map((group) => ({
        name: group.name,
        required: group.required,
        min: group.min,
        max: group.max,
        pricingMode: group.pricingMode ?? 'SUM' as const,
        addons: group.addons.map((addon) => ({ name: addon.name, price: addon.price })),
      }));
    };

    type ImportOperation =
      | { kind: 'create'; row: CatalogImportRow; addonGroups: ReturnType<typeof groupsForRow> }
      | { kind: 'repair'; row: CatalogImportRow; addonGroups: ReturnType<typeof groupsForRow>; existing: Product };
    const operations: ImportOperation[] = [];
    for (const row of uniqueRows) {
      const key = `${normalize(row.category)}::${normalize(row.name)}`;
      const existing = existingProductByKey.get(key);
      const addonGroups = groupsForRow(row);
      if (!existing) {
        operations.push({ kind: 'create', row, addonGroups });
        continue;
      }
      // Safe repair path: an earlier import may have created the product but lost its options.
      // In that case re-importing the same CSV restores only the missing option groups and
      // preserves the existing product price, description, image and availability.
      if (addonGroups.length && !(existing.addonGroups?.length)) operations.push({ kind: 'repair', row, addonGroups, existing });
    }
    const createdCount = operations.filter((item) => item.kind === 'create').length;
    const repairedCount = operations.filter((item) => item.kind === 'repair').length;
    const skipped = uniqueRows.length - operations.length;
    if (!operations.length) {
      setNotice({ text: 'Todos os produtos já existem e os grupos de opções já estão configurados. Nada foi alterado.', kind: 'info' });
      return;
    }
    const actionSummary = [createdCount ? `${createdCount} novo(s)` : '', repairedCount ? `${repairedCount} existente(s) com opções ausentes serão corrigidos` : ''].filter(Boolean).join(' e ');
    if (!window.confirm(`Processar ${actionSummary}${skipped ? `; ${skipped} item(ns) já completos serão preservados` : ''}?`)) return;

    setBusy('import');
    setProgress({ done: 0, total: operations.length });
    setNotice(null);
    try {
      const categoriesNeeded = [...new Set(operations.filter((item) => item.kind === 'create').map((item) => item.row.category))];
      let nextOrder = categories.length;
      for (const categoryName of categoriesNeeded) {
        const key = normalize(categoryName);
        if (existingCategoryByName.has(key)) continue;
        const created = await request<Category>(`${base}/categories`, {
          method: 'POST',
          body: JSON.stringify({ name: categoryName, order: nextOrder++ }),
        });
        assertEntity(created, 'categoria');
        existingCategoryByName.set(key, created);
      }

      let done = 0;
      for (const operation of operations) {
        const { row, addonGroups } = operation;
        let saved: Product;
        if (operation.kind === 'repair') {
          saved = await request<Product>(`${base}/products/${operation.existing._id}`, {
            method: 'PATCH',
            body: JSON.stringify({ addonGroups }),
          });
        } else {
          const category = existingCategoryByName.get(normalize(row.category));
          if (!category) throw new Error(`Não foi possível localizar a categoria “${row.category}”.`);
          saved = await request<Product>(`${base}/products`, {
            method: 'POST',
            body: JSON.stringify({
              categoryId: category._id,
              name: row.name,
              price: row.price,
              ...(row.promotionalPrice !== undefined ? { promotionalPrice: row.promotionalPrice } : {}),
              ...(row.description ? { description: row.description } : {}),
              available: row.available,
              featured: row.featured,
              addonGroups,
            }),
          });
        }
        assertEntity(saved, 'produto');
        if (addonGroups.length && (saved.addonGroups?.length ?? 0) !== addonGroups.length) {
          throw new Error(`O produto “${row.name}” foi salvo sem todos os grupos de opções. Atualize também o backend do Menu Flow e tente importar novamente.`);
        }
        done += 1;
        setProgress({ done, total: operations.length });
      }
      invalidateLoads();
      await refresh();
      const resultSummary = [createdCount ? `${createdCount} criado(s)` : '', repairedCount ? `${repairedCount} corrigido(s)` : '', skipped ? `${skipped} preservado(s)` : ''].filter(Boolean).join(', ');
      setNotice({ text: `Importação concluída: ${resultSummary}.`, kind: 'success' });
    } catch (error) {
      invalidateLoads();
      await refresh().catch(() => undefined);
      setNotice({ text: `${msg(error)} Os itens concluídos antes do erro foram mantidos.`, kind: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="overflow-hidden rounded-3xl border bg-surface shadow-sm">
        <div className="border-b bg-gradient-to-r from-background to-surface p-5 sm:p-7">
          <span className="inline-flex rounded-full border bg-surface px-3 py-1 text-xs font-black uppercase tracking-wide text-stone-500">Construtor inteligente</span>
          <h3 className="mt-3 text-2xl font-black">Comece com a estrutura certa para o seu negócio</h3>
          <p className="mt-1 max-w-3xl text-sm text-stone-500">O modelo cria somente categorias que ainda não existem. Seu cardápio atual, preços e produtos não são apagados.</p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          {CATALOG_TEMPLATES.map((template) => (
            <button key={template.id} type="button" onClick={() => setTemplateId(template.id)} className={`rounded-2xl border p-4 text-left transition ${template.id === templateId ? 'border-ink bg-ink text-white shadow-md' : 'bg-surface hover:border-ink/30 hover:bg-background'}`}>
              <span className="text-3xl" aria-hidden="true">{template.icon}</span>
              <strong className="mt-3 block text-base">{template.label}</strong>
              <span className={`mt-1 block text-xs leading-5 ${template.id === templateId ? 'text-white/70' : 'text-stone-500'}`}>{template.description}</span>
            </button>
          ))}
        </div>
        <div className="border-t p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-stone-500">Categorias sugeridas</p>
              <div className="mt-2 flex flex-wrap gap-2">{selectedTemplate.categories.map((name) => <span key={name} className="rounded-full border bg-background px-3 py-1.5 text-sm font-bold">{name}</span>)}</div>
              <p className="mt-3 text-xs text-stone-500">Modelos de opções recomendados: {selectedTemplate.recommendedPresetIds.map((id) => findProductPreset(id)?.label).filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" disabled={busy !== null} onClick={() => void applyTemplate()} className="min-h-12 shrink-0 rounded-xl bg-ink px-6 py-3 font-black text-white disabled:opacity-50">{busy === 'template' ? 'Criando estrutura…' : `Usar modelo ${selectedTemplate.label}`}</button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-accent">Importação em massa</span>
            <h3 className="mt-3 text-2xl font-black">Importe um cardápio completo</h3>
            <p className="mt-1 max-w-3xl text-sm text-stone-500">Importe CSV/TXT ou cole o cardápio. O Menu Flow cria categorias automaticamente, ignora duplicados e pode aplicar modelos de opções em cada produto.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadExample} className="rounded-xl border px-4 py-2.5 text-sm font-bold">Baixar planilha modelo</button>
            <label className="cursor-pointer rounded-xl border px-4 py-2.5 text-sm font-bold hover:bg-background">Selecionar CSV/TXT<input type="file" accept=".csv,.txt,text/csv,text/plain" className="sr-only" onChange={(event) => void readImportFile(event.target.files?.[0])} /></label>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
          <div>
            <label className="text-sm font-black">Conteúdo do cardápio</label>
            <textarea rows={13} className="field resize-y font-mono text-sm" placeholder={'Exemplo simples:\nPizzas:\nPizza Calabresa - 45,00\nPizza Portuguesa - 50,00\n\nOu use a planilha CSV para importar descrição, promoção, modelo e grupos de opções personalizados.'} value={importText} onChange={(event) => setImportText(event.target.value)} />
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-500"><span className="rounded-full bg-background px-2.5 py-1">CSV com até 500 produtos</span><span className="rounded-full bg-background px-2.5 py-1">Duplicados são ignorados</span><span className="rounded-full bg-background px-2.5 py-1">Revisão antes de salvar</span></div>
          </div>
          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="flex items-center justify-between gap-3"><h4 className="font-black">Prévia da importação</h4><span className="rounded-full bg-surface px-2.5 py-1 text-xs font-black">{parsed.rows.length} produto(s)</span></div>
            {parsed.rows.length ? <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{parsed.rows.slice(0, 20).map((row) => <div key={`${row.line}-${row.category}-${row.name}`} className="rounded-xl border bg-surface p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{row.name}</p><p className="truncate text-xs text-stone-500">{row.category}{row.presetId ? ` · ${findProductPreset(row.presetId)?.label}` : ''}{row.addonGroups?.length ? ` · ${row.addonGroups.length} grupo(s) de opções` : ''}</p></div><b className="shrink-0 text-sm">{money(row.promotionalPrice ?? row.price)}</b></div></div>)}{parsed.rows.length > 20 && <p className="text-center text-xs font-bold text-stone-500">+ {parsed.rows.length - 20} produtos na importação</p>}</div> : <p className="mt-4 text-sm text-stone-500">Cole ou selecione um arquivo para visualizar os itens antes de importar.</p>}
            {parsed.errors.length > 0 && <div className="mt-4 rounded-xl border border-danger/20 bg-danger/10 p-3"><p className="text-sm font-black text-danger">Atenção na leitura</p><ul className="mt-2 max-h-28 list-disc space-y-1 overflow-y-auto pl-5 text-xs text-danger">{parsed.errors.slice(0, 12).map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>}
            {busy === 'import' && <div className="mt-4"><div className="flex justify-between text-xs font-bold"><span>Importando…</span><span>{progress.done}/{progress.total}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200"><div className="h-full bg-ink transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} /></div></div>}
            <button type="button" disabled={busy !== null || !parsed.rows.length} onClick={() => void importCatalog()} className="mt-4 min-h-12 w-full rounded-xl bg-ink px-4 font-black text-white disabled:opacity-40">{busy === 'import' ? 'Importando cardápio…' : 'Revisado, importar cardápio'}</button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border bg-surface p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><h3 className="text-xl font-black">Modelos de opções prontos</h3><p className="mt-1 text-sm text-stone-500">Ao criar ou editar um produto, você pode aplicar um destes modelos e depois personalizar cada opção e preço.</p></div><button type="button" onClick={onGoProducts} className="rounded-xl border px-5 py-3 font-bold">Ir para produtos →</button></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{PRODUCT_OPTION_PRESETS.map((preset) => <div key={preset.id} className="rounded-2xl border bg-background/40 p-4"><span className="text-2xl">{preset.icon}</span><p className="mt-2 font-black">{preset.label}</p><p className="mt-1 text-xs leading-5 text-stone-500">{preset.description}</p><p className="mt-3 text-[11px] font-bold text-stone-500">{preset.groups.length} grupo(s) de opções</p></div>)}</div>
      </section>

      {notice && <Notice state={notice} />}
    </div>
  );
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
  const [status, setStatus] = useState<'all' | 'available' | 'unavailable'>('available');
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
        pricingMode: group.pricingMode === 'MAX' ? 'MAX' : 'SUM',
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
          pricingMode: group.pricingMode,
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

  function movableSiblings(product: Product) {
    return products
      .filter((item) => categoryId(item) === categoryId(product) && item.available === product.available)
      .sort(compareProducts);
  }

  function canMoveProduct(product: Product, delta: number) {
    const siblings = movableSiblings(product);
    const index = siblings.findIndex((item) => item._id === product._id);
    return index >= 0 && index + delta >= 0 && index + delta < siblings.length;
  }

  async function moveProduct(product: Product, delta: number) {
    const productCategoryId = categoryId(product);
    const allSiblings = products.filter((item) => categoryId(item) === productCategoryId).sort(compareProducts);
    const movable = allSiblings.filter((item) => item.available === product.available);
    const movableIndex = movable.findIndex((item) => item._id === product._id);
    const target = movable[movableIndex + delta];
    if (!target) return;

    const currentIndex = allSiblings.findIndex((item) => item._id === product._id);
    const targetIndex = allSiblings.findIndex((item) => item._id === target._id);
    if (currentIndex < 0 || targetIndex < 0) return;

    const before = [...products];
    const reorderedSiblings = [...allSiblings];
    [reorderedSiblings[currentIndex], reorderedSiblings[targetIndex]] = [reorderedSiblings[targetIndex], reorderedSiblings[currentIndex]];
    const reordered = reorderedSiblings.map((item, order) => ({ ...item, order }));
    setProducts((current) => current.map((item) => reordered.find((entry) => entry._id === item._id) ?? item));
    setBusyId(`reorder:${productCategoryId}`);
    try {
      await request(`${base}/products/reorder`, {
        method: 'PATCH',
        body: JSON.stringify(reordered.map((item) => ({ id: item._id, order: item.order }))),
      });
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

  async function removeProduct(product: Product) {
    if (!window.confirm(`Excluir permanentemente o produto “${product.name}”? Esta ação não pode ser desfeita.`)) return;
    setBusyId(product._id);
    try {
      await request(`${base}/products/${product._id}`, { method: 'DELETE' });
      invalidateLoads();
      setProducts((current) => current.filter((entry) => entry._id !== product._id));
      await refresh();
      setNotice({ text: 'Produto excluído do cardápio.', kind: 'success' });
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
          <option value="available">Ativos no cardápio</option>
          <option value="unavailable">Desativados</option>
          <option value="all">Todos</option>
        </select>
        <label className="flex min-h-11 items-center gap-2 rounded-xl px-2 font-bold">
          <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /> Destaques
        </label>
        <button type="button" onClick={startCreate} className="rounded-xl bg-ink px-5 py-3 font-bold text-white">
          + Novo produto
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <CatalogStat label="Produtos" value={catalogStats.total} />
        <CatalogStat label="Ativos" value={catalogStats.available} />
        <CatalogStat label="Desativados" value={catalogStats.total - catalogStats.available} />
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
          {categoryProducts.map((product) => (
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
                  <button type="button" disabled={busyId !== null} onClick={() => void removeProduct(product)} className="rounded-lg border px-3 py-2 text-sm font-bold text-danger disabled:opacity-50">
                    Excluir
                  </button>
                  <button type="button" title="Mover para cima" aria-label={`Mover ${product.name} para cima`} disabled={busyId !== null || !canMoveProduct(product, -1)} onClick={() => void moveProduct(product, -1)} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-30">↑</button>
                  <button type="button" title="Mover para baixo" aria-label={`Mover ${product.name} para baixo`} disabled={busyId !== null || !canMoveProduct(product, 1)} onClick={() => void moveProduct(product, 1)} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-30">↓</button>
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

  const applyOptionPreset = (presetId: string) => {
    const preset = findProductPreset(presetId);
    if (!preset) return;
    if (form.addonGroups.length && !window.confirm(`Substituir os grupos de opções atuais pelo modelo ${preset.label}?`)) return;
    setForm({
      ...form,
      addonGroups: preset.groups.map((group) => ({
        name: group.name,
        required: group.required,
        min: String(group.min),
        max: String(group.max),
        pricingMode: group.pricingMode ?? 'SUM',
        addons: group.addons.map((addon) => ({ name: addon.name, price: String(addon.price) })),
      })),
    });
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
          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="flex flex-col gap-1"><h4 className="font-black">Aplicar modelo de opções</h4><p className="text-sm text-stone-500">Economize tempo usando uma estrutura pronta. Depois você pode alterar nomes, preços, mínimos e máximos normalmente.</p></div>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">{PRODUCT_OPTION_PRESETS.map((preset) => <button key={preset.id} type="button" onClick={() => applyOptionPreset(preset.id)} className="min-w-max rounded-xl border bg-surface px-3 py-2 text-left text-sm font-bold hover:border-ink/30 hover:bg-background"><span className="mr-2">{preset.icon}</span>{preset.label}</button>)}</div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-black">Adicionais / opções</h4>
              <p className="text-sm text-stone-500">Ex.: tamanho, ponto da carne, adicionais ou acompanhamentos.</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, addonGroups: [...form.addonGroups, { name: '', required: false, min: '0', max: '1', pricingMode: 'SUM', addons: [{ name: '', price: '0' }] }] })}
              className="rounded-xl border px-4 py-2 font-bold"
            >
              + Adicionar grupo
            </button>
          </div>

          {form.addonGroups.map((group, index) => (
            <div key={index} className="mt-4 rounded-2xl border bg-background/40 p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <input required className="field !mt-0" placeholder="Nome do grupo" value={group.name} onChange={(event) => setGroup(index, { ...group, name: event.target.value })} />
                <input required min="0" type="number" className="field !mt-0" aria-label="Quantidade mínima" placeholder="Mínimo" value={group.min} onChange={(event) => setGroup(index, { ...group, min: event.target.value })} />
                <input required min="1" type="number" className="field !mt-0" aria-label="Quantidade máxima" placeholder="Máximo" value={group.max} onChange={(event) => setGroup(index, { ...group, max: event.target.value })} />
                <select className="field !mt-0" aria-label="Regra de cobrança do grupo" value={group.pricingMode} onChange={(event) => setGroup(index, { ...group, pricingMode: event.target.value as 'SUM' | 'MAX' })}>
                  <option value="SUM">Somar opções</option>
                  <option value="MAX">Cobrar só a mais cara</option>
                </select>
                <label className="flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 font-bold"><input type="checkbox" checked={group.required} onChange={(event) => setGroup(index, { ...group, required: event.target.checked, min: event.target.checked && Number(group.min) < 1 ? '1' : group.min })} /> Obrigatório</label>
              </div>
              {group.pricingMode === 'MAX' && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">Ao escolher várias opções deste grupo, somente a de maior valor será cobrada. Ideal para sabores de pizza meio a meio.</p>}

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

    const addonNames = new Set<string>();
    for (const addon of group.addons) {
      const addonName = addon.name.trim();
      if (!addonName) return `Informe o nome de todas as opções do grupo “${groupName}”.`;
      const normalizedAddon = addonName.toLocaleLowerCase('pt-BR');
      if (addonNames.has(normalizedAddon)) return `A opção “${addonName}” está duplicada no grupo “${groupName}”.`;
      addonNames.add(normalizedAddon);
      const addonPrice = Number(addon.price);
      if (!Number.isFinite(addonPrice) || addonPrice < 0) return `Informe um preço válido para a opção “${addonName}”.`;
    }
  }
  return null;
}
