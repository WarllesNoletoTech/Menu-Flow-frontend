'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';
import { getSession } from '../lib/auth';
import { useAuth } from './AuthProvider';
import { UserMenu } from './auth/UserMenu';

type Category = { _id: string; name: string };
type Addon = { name: string; price: number };
type AddonGroup = { name: string; required: boolean; min: number; max: number; addons: Addon[] };
type Product = { _id: string; name: string; description?: string; imageUrl?: string; price: number; promotionalPrice?: number; categoryId?: string; addonGroups?: AddonGroup[] };
type Restaurant = { _id: string; name: string; tradeName?: string; description?: string; bannerUrl?: string; logoUrl?: string; open: boolean; establishmentType?: string; city?: string; state?: string };
type CartItem = Product & { quantity: number; addonNames: string[] };
type StoredCartItem = { productId: string; quantity: number; addonNames: string[] };

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const typeLabels: Record<string, string> = { RESTAURANT: 'Restaurante', PHARMACY: 'Farmácia', CLOTHING: 'Loja de roupas', OTHER: 'Loja' };

export function Menu({ slug }: { slug: string }) {
  const { user } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [hydratedCartKey, setHydratedCartKey] = useState('');
  const [message, setMessage] = useState<string>();
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const cartKey = `menu-flow-cart:${slug}`;

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(apiUrl(`/restaurants/${slug}`));
        if (!response.ok) throw new Error('Estabelecimento não encontrado');
        const data = await response.json() as Restaurant;
        setRestaurant(data);
        const menuResponse = await fetch(apiUrl(`/restaurants/${data._id}/menu`));
        if (!menuResponse.ok) throw new Error('Não foi possível carregar o cardápio');
        const result = await menuResponse.json() as { categories: Category[]; products: Product[] };
        setCategories(result.categories);
        setProducts(result.products);
        try {
          const stored = JSON.parse(sessionStorage.getItem(cartKey) ?? '[]') as StoredCartItem[];
          setCart(stored.flatMap((item) => {
            const product = result.products.find((candidate) => candidate._id === item.productId);
            return product && Number.isInteger(item.quantity) && item.quantity > 0 && Array.isArray(item.addonNames)
              ? [{ ...product, quantity: item.quantity, addonNames: item.addonNames.filter((name): name is string => typeof name === 'string') }]
              : [];
          }));
        } catch {
          sessionStorage.removeItem(cartKey);
          setCart([]);
        } finally {
          setHydratedCartKey(cartKey);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao carregar cardápio');
      }
    })();
  }, [slug, cartKey]);

  useEffect(() => {
    if (hydratedCartKey !== cartKey) return;
    if (cart.length === 0) sessionStorage.removeItem(cartKey);
    else sessionStorage.setItem(cartKey, JSON.stringify(cart.map(({ _id, quantity, addonNames }) => ({ productId: _id, quantity, addonNames }))));
  }, [cart, cartKey, hydratedCartKey]);

  useEffect(() => {
    if (!selectedProduct && !checkout) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedProduct(undefined);
        setCheckout(false);
      }
    };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [selectedProduct, checkout]);

  const addonPrice = (product: Product, names: string[]) => (product.addonGroups ?? [])
    .flatMap((group) => group.addons)
    .filter((addon) => names.includes(addon.name))
    .reduce((total, addon) => total + addon.price, 0);
  const subtotal = useMemo(() => cart.reduce((total, item) => total + ((item.promotionalPrice ?? item.price) + addonPrice(item, item.addonNames)) * item.quantity, 0), [cart]);
  const visibleCategories = useMemo(() => {
    const categoryIds = new Set(categories.map((category) => category._id));
    const sections = categories.flatMap((category) => {
      const categoryProducts = products.filter((product) => product.categoryId === category._id);
      return categoryProducts.length ? [{ ...category, products: categoryProducts }] : [];
    });
    const uncategorizedProducts = products.filter((product) => !product.categoryId || !categoryIds.has(product.categoryId));
    return uncategorizedProducts.length
      ? [...sections, { _id: 'outros', name: 'Outros', products: uncategorizedProducts }]
      : sections;
  }, [categories, products]);
  const itemCount = cart.reduce((total, item) => total + item.quantity, 0);
  const add = (product: Product, addonNames: string[] = []) => setCart((items) => {
    const found = items.find((item) => item._id === product._id && item.addonNames.join('|') === addonNames.join('|'));
    return found ? items.map((item) => item === found ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { ...product, addonNames, quantity: 1 }];
  });
  const setQuantity = (item: CartItem, quantity: number) => setCart((items) => quantity < 1 ? items.filter((current) => current !== item) : items.map((current) => current === item ? { ...current, quantity } : current));
  const toggleAddon = (group: AddonGroup, name: string) => setSelectedAddons((names) => {
    const inGroup = names.filter((selected) => group.addons.some((addon) => addon.name === selected));
    if (names.includes(name)) return names.filter((selected) => selected !== name);
    if (inGroup.length >= group.max) return [...names.filter((selected) => !inGroup.includes(selected)), name];
    return [...names, name];
  });
  const canAddSelectedProduct = !selectedProduct || (selectedProduct.addonGroups ?? []).every((group) => selectedAddons.filter((name) => group.addons.some((addon) => addon.name === name)).length >= (group.min ?? (group.required ? 1 : 0)));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!restaurant) return;
    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: form.get('name'), phone: form.get('phone'), fulfillment,
      paymentMethod: form.get('paymentMethod'),
      address: fulfillment === 'DELIVERY' ? { neighborhood: form.get('neighborhood'), street: form.get('street'), number: form.get('number') } : undefined,
      items: cart.map(({ _id, quantity, addonNames }) => ({ productId: _id, quantity, addonNames })),
    };
    const session = getSession();
    try {
      const response = await fetch(apiUrl(`/restaurants/${restaurant._id}/orders`), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(session?.user.role === 'CUSTOMER' ? { Authorization: `Bearer ${session.accessToken}` } : {}) }, body: JSON.stringify(payload) });
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { message?: string | string[] } | null;
        setMessage(Array.isArray(data?.message) ? data.message[0] : data?.message ?? 'Não foi possível enviar o pedido');
        return;
      }
      setCart([]); setCheckout(false); setMessage('Pedido enviado! O estabelecimento irá confirmar em breve.');
    } catch { setMessage('Não foi possível conectar ao servidor. Tente novamente.'); }
  }

  if (message && !restaurant) return <StatePage error message={message} />;
  if (!restaurant) return <StatePage message="Carregando cardápio…" />;

  return (
    <main className={`min-h-screen bg-background ${cart.length ? 'pb-28 lg:pb-10' : 'pb-10'}`}>
      {message && <div role="status" aria-live="polite" className="fixed left-4 right-4 top-4 z-[80] mx-auto max-w-md rounded-xl bg-ink p-4 text-sm font-bold text-white shadow-soft sm:left-auto sm:right-6 sm:top-6 sm:w-full">{message}</div>}
      <MenuHeader restaurant={restaurant} slug={slug} />
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] lg:px-8 lg:py-8">
        <div className="min-w-0">
          {products.length === 0 ? <EmptyMenu /> : <>
          <nav aria-label="Categorias" className="scrollbar-none sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:px-3">
            {visibleCategories.map((category) => <a key={category._id} href={`#${category._id}`} className="min-h-11 shrink-0 whitespace-nowrap rounded-full bg-surface px-4 py-3 text-sm font-bold shadow-sm">{category.name}</a>)}
          </nav>
          {visibleCategories.map((category) => (
            <section id={category._id} key={category._id} className="scroll-mt-20 pt-7">
              <h2 className="text-xl font-black sm:text-2xl">{category.name}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {category.products.map((product) => <ProductCard key={product._id} product={product} open={restaurant.open} add={() => product.addonGroups?.length ? (setSelectedProduct(product), setSelectedAddons([])) : add(product)} />)}
              </div>
            </section>
          ))}</>}
        </div>
        <aside className="hidden lg:block"><div className="sticky top-24"><CartPanel cart={cart} subtotal={subtotal} addonPrice={addonPrice} setQuantity={setQuantity} checkout={() => setCheckout(true)} /></div></aside>
      </div>
      {selectedProduct && <ProductModal product={selectedProduct} selected={selectedAddons} toggle={toggleAddon} close={() => setSelectedProduct(undefined)} canAdd={canAddSelectedProduct} total={(selectedProduct.promotionalPrice ?? selectedProduct.price) + addonPrice(selectedProduct, selectedAddons)} confirm={() => { add(selectedProduct, selectedAddons); setSelectedProduct(undefined); }} />}
      {cart.length > 0 && <MobileCartBar count={itemCount} subtotal={subtotal} open={() => setCheckout(true)} />}
      {checkout && <CheckoutModal cart={cart} subtotal={subtotal} addonPrice={addonPrice} setQuantity={setQuantity} close={() => setCheckout(false)} submit={submit} fulfillment={fulfillment} setFulfillment={setFulfillment} customer={user?.role === 'CUSTOMER' ? user : undefined} />}
    </main>
  );
}

function MenuHeader({ restaurant, slug }: { restaurant: Restaurant; slug: string }) {
  const location = [restaurant.city, restaurant.state].filter(Boolean).join(' - ');
  const background = restaurant.bannerUrl ? { backgroundImage: `linear-gradient(90deg,rgba(23,32,27,.88),rgba(23,32,27,.38)),url(${restaurant.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined;
  return <header className="relative mx-auto w-full max-w-7xl lg:mt-6">
    <div className="relative min-h-[240px] overflow-hidden bg-gradient-to-br from-ink via-primary-hover to-accent sm:min-h-[280px] lg:min-h-[360px] lg:rounded-3xl" style={background}>
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent p-5 pt-20 text-white sm:p-8 sm:pr-72 lg:p-10 lg:pr-80">
      <div className="flex items-end gap-4 sm:gap-6">
        {restaurant.logoUrl ? <img src={restaurant.logoUrl} alt={`Logo de ${restaurant.name}`} className="h-20 w-20 shrink-0 rounded-2xl border-4 border-white bg-surface object-cover shadow-xl lg:h-24 lg:w-24" /> : <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-white bg-lime text-3xl font-black text-ink shadow-xl lg:h-24 lg:w-24">{restaurant.name.charAt(0)}</span>}
        <div className="min-w-0 pb-1">
          <span className={`inline-block rounded-full px-3 py-1 text-xs font-black ${restaurant.open ? 'bg-success text-white' : 'bg-danger text-white'}`}>{restaurant.open ? 'ABERTO AGORA' : 'FECHADO'}</span>
          <h1 className="mt-2 break-words text-2xl font-black leading-tight sm:text-4xl lg:text-5xl">{restaurant.tradeName || restaurant.name}</h1>
          <p className="mt-2 text-sm font-semibold text-stone-200 sm:text-base">{[typeLabels[restaurant.establishmentType ?? 'RESTAURANT'], location].filter(Boolean).join(' • ')}</p>
          <p className="mt-1 hidden max-w-2xl text-stone-200 sm:line-clamp-2 sm:block">{restaurant.description ?? 'Entrega e retirada no estabelecimento.'}</p>
        </div>
      </div>
    </div>
    </div>
    <div className="absolute right-4 top-4 z-50 sm:right-6 sm:top-6"><UserMenu returnTo={`/${slug}`} /></div>
  </header>;
}

function EmptyMenu() {
  return <section className="mt-3 min-h-72 rounded-3xl border border-border bg-surface px-6 py-10 text-center shadow-sm sm:mt-0 sm:min-h-80 sm:px-10 sm:py-14">
    <p className="text-left text-2xl font-black">Cardápio</p>
    <div className="mx-auto mt-8 max-w-md"><span className="text-5xl" aria-hidden>🍽️</span><h2 className="mt-4 text-lg font-black sm:text-xl">Este estabelecimento ainda não possui produtos disponíveis.</h2><p className="mt-2 text-stone-500">Volte em breve.</p></div>
  </section>;
}

function ProductCard({ product, open, add }: { product: Product; open: boolean; add: () => void }) {
  return <article className="flex min-h-36 min-w-0 gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm transition hover:shadow-soft sm:gap-4 sm:p-4">
    {product.imageUrl ? <img src={product.imageUrl} alt="" loading="lazy" className="h-24 w-24 shrink-0 rounded-xl object-cover sm:h-28 sm:w-28" /> : <div className="grid h-24 w-24 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-stone-100 to-lime/30 text-2xl font-black text-ink/40 sm:h-28 sm:w-28" aria-label="Produto sem imagem">MF</div>}
    <div className="flex min-w-0 flex-1 flex-col"><h3 className="break-words font-black">{product.name}</h3><p className="mt-1 line-clamp-2 text-sm leading-5 text-stone-500">{product.description || 'Confira este produto.'}</p>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3"><span className="whitespace-nowrap">{product.promotionalPrice != null && <><span className="mr-2 rounded-full bg-lime/30 px-2 py-1 text-[10px] font-black">OFERTA</span><del className="mr-1 text-xs text-stone-400">{money(product.price)}</del></>}<b>{money(product.promotionalPrice ?? product.price)}</b></span><button type="button" disabled={!open} onClick={add} className="min-h-11 rounded-xl bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Adicionar</button></div>
    </div>
  </article>;
}

function CartPanel({ cart, subtotal, addonPrice, setQuantity, checkout }: { cart: CartItem[]; subtotal: number; addonPrice: (p: Product, n: string[]) => number; setQuantity: (item: CartItem, quantity: number) => void; checkout: () => void }) {
  return <section className="rounded-3xl border border-border bg-surface p-5 shadow-soft"><h2 className="text-xl font-black">Sua sacola</h2>{cart.length === 0 ? <div className="py-10 text-center text-stone-500"><span className="text-4xl" aria-hidden>🛒</span><p className="mt-3 font-bold">Sua sacola está vazia</p><p className="mt-1 text-sm">Adicione produtos para começar.</p></div> : <>{cart.map((item) => <CartRow key={`${item._id}-${item.addonNames.join()}`} item={item} addonPrice={addonPrice} setQuantity={setQuantity} />)}<div className="mt-5 flex justify-between border-t pt-4 text-lg font-black"><span>Subtotal</span><span className="whitespace-nowrap">{money(subtotal)}</span></div><button type="button" onClick={checkout} className="mt-4 min-h-12 w-full rounded-xl bg-ink px-4 font-black text-white">FINALIZAR PEDIDO</button></>}</section>;
}

function CartRow({ item, addonPrice, setQuantity }: { item: CartItem; addonPrice: (p: Product, n: string[]) => number; setQuantity: (item: CartItem, quantity: number) => void }) {
  return <div className="mt-4 border-t pt-4 first:border-0"><div className="flex justify-between gap-3"><div className="min-w-0"><b className="break-words">{item.name}</b>{item.addonNames.length > 0 && <p className="break-words text-xs text-stone-500">{item.addonNames.join(', ')}</p>}<p className="mt-1 whitespace-nowrap text-sm font-bold">{money((item.promotionalPrice ?? item.price) + addonPrice(item, item.addonNames))}</p></div><div className="flex h-11 shrink-0 items-center rounded-xl border"><button type="button" aria-label={`Diminuir ${item.name}`} className="h-11 w-11" onClick={() => setQuantity(item, item.quantity - 1)}>−</button><b className="min-w-5 text-center">{item.quantity}</b><button type="button" aria-label={`Aumentar ${item.name}`} className="h-11 w-11" onClick={() => setQuantity(item, item.quantity + 1)}>+</button></div></div></div>;
}

function MobileCartBar({ count, subtotal, open }: { count: number; subtotal: number; open: () => void }) {
  return <aside className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 px-4 pt-3 shadow-2xl backdrop-blur lg:hidden" style={{ paddingBottom: 'max(.75rem, env(safe-area-inset-bottom))' }}><button type="button" onClick={open} className="mx-auto flex min-h-14 w-full max-w-2xl items-center justify-between gap-3 rounded-xl bg-ink px-5 font-black text-white"><span>🛒 VER SACOLA · {count} {count === 1 ? 'item' : 'itens'}</span><span className="whitespace-nowrap">{money(subtotal)}</span></button></aside>;
}

function ModalFrame({ label, close, children, sheet = false }: { label: string; close: () => void; children: React.ReactNode; sheet?: boolean }) {
  return <div className={`fixed inset-0 z-[70] overflow-y-auto bg-ink/60 p-0 ${sheet ? 'flex items-end sm:block sm:p-4' : 'p-3 sm:p-6'}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section role="dialog" aria-modal="true" aria-label={label} className={`mx-auto max-h-[92dvh] w-full overflow-y-auto bg-surface shadow-2xl ${sheet ? 'max-w-2xl rounded-t-3xl p-5 sm:my-6 sm:rounded-3xl sm:p-7' : 'my-3 max-w-2xl rounded-3xl p-5 sm:my-6 sm:p-7'}`}>{children}</section></div>;
}

function ProductModal({ product, selected, toggle, close, canAdd, total, confirm }: { product: Product; selected: string[]; toggle: (group: AddonGroup, name: string) => void; close: () => void; canAdd: boolean; total: number; confirm: () => void }) {
  return <ModalFrame label={`Personalizar ${product.name}`} close={close} sheet><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-xl font-black sm:text-2xl">{product.name}</h2><p className="mt-1 text-sm text-stone-500">{product.description}</p></div><button type="button" aria-label="Fechar produto" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border">✕</button></div>{(product.addonGroups ?? []).map((group) => <fieldset key={group.name} className="mt-5 border-t pt-4"><legend className="font-bold">{group.name} {group.required && <span className="text-danger">* obrigatório</span>}</legend><p className="mt-1 text-xs text-stone-500">Escolha de {group.min ?? (group.required ? 1 : 0)} a {group.max} opções</p>{group.addons.map((addon) => <label key={addon.name} className="mt-3 flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3"><span className="break-words"><input className="mr-3 h-5 w-5 align-middle accent-primary" type="checkbox" checked={selected.includes(addon.name)} onChange={() => toggle(group, addon.name)} />{addon.name}</span><b className="shrink-0 whitespace-nowrap">{addon.price > 0 ? `+ ${money(addon.price)}` : 'Grátis'}</b></label>)}</fieldset>)}<button type="button" disabled={!canAdd} onClick={confirm} className="sticky bottom-0 mt-6 min-h-14 w-full rounded-xl bg-ink px-4 font-black text-white disabled:opacity-40">ADICIONAR · {money(total)}</button></ModalFrame>;
}

function CheckoutModal({ cart, subtotal, addonPrice, setQuantity, close, submit, fulfillment, setFulfillment, customer }: { cart: CartItem[]; subtotal: number; addonPrice: (p: Product, n: string[]) => number; setQuantity: (item: CartItem, quantity: number) => void; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void; fulfillment: 'PICKUP' | 'DELIVERY'; setFulfillment: (value: 'PICKUP' | 'DELIVERY') => void; customer?: { name: string; phone?: string } }) {
  return <ModalFrame label="Finalizar pedido" close={close} sheet><form onSubmit={submit}><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-black sm:text-2xl">Finalizar pedido</h2><button type="button" onClick={close} aria-label="Fechar checkout" className="grid h-11 w-11 place-items-center rounded-xl border">✕</button></div><div className="mt-5 rounded-2xl bg-background p-4">{cart.map((item) => <CartRow key={`${item._id}-${item.addonNames.join()}`} item={item} addonPrice={addonPrice} setQuantity={setQuantity} />)}<p className="mt-4 flex justify-between border-t pt-4 text-lg font-black"><span>Subtotal</span><span className="whitespace-nowrap">{money(subtotal)}</span></p></div><div className="mt-5 grid gap-x-4 sm:grid-cols-2"><label className="font-bold">Nome<input required name="name" defaultValue={customer?.name} className="field" /></label><label className="font-bold">Telefone<input required name="phone" inputMode="tel" defaultValue={customer?.phone} className="field" /></label><label className="font-bold sm:col-span-2">Tipo de entrega<select name="fulfillment" value={fulfillment} onChange={(event) => setFulfillment(event.target.value as 'PICKUP' | 'DELIVERY')} className="field"><option value="PICKUP">Retirar no estabelecimento</option><option value="DELIVERY">Entrega</option></select></label>{fulfillment === 'DELIVERY' && <><label className="font-bold sm:col-span-2">Bairro<input required name="neighborhood" className="field" /></label><label className="font-bold">Rua<input required name="street" className="field" /></label><label className="font-bold">Número<input required name="number" className="field" /></label></>}<label className="font-bold sm:col-span-2">Forma de pagamento<select name="paymentMethod" className="field"><option value="PIX">PIX</option><option value="CASH">Dinheiro</option><option value="CREDIT_CARD">Cartão de crédito</option><option value="DEBIT_CARD">Cartão de débito</option></select></label></div><button className="sticky bottom-0 mt-5 min-h-14 w-full rounded-xl bg-ink px-4 font-black text-white">FINALIZAR · {money(subtotal)}</button></form></ModalFrame>;
}

function StatePage({ message, error = false }: { message: string; error?: boolean }) {
  return <main className="mx-auto min-h-[60dvh] w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className={`rounded-3xl p-8 text-center ${error ? 'border border-danger/30 bg-danger/10 text-danger' : 'bg-surface'}`}>{!error && <div className="mx-auto h-48 max-w-2xl animate-pulse rounded-2xl bg-stone-200" />}<h1 className="mt-5 text-xl font-black sm:text-2xl">{message}</h1>{error && <a href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 font-bold text-white">Voltar para o início</a>}</div></main>;
}
