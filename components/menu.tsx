'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiUrl } from '../lib/api';
import { paymentMethodLabel } from '../lib/payment-methods';
import { clearSession, getSession, type AuthSession } from '../lib/auth';
import { PasswordField } from './auth/PasswordField';
import { useAuth } from './AuthProvider';
import { UserMenu } from './auth/UserMenu';
import { canOfferDelivery } from '../lib/fulfillment';
import { legacyEstablishmentLabel } from '../lib/public-restaurants';
import { customerAuthPayload } from '../lib/customer-auth';
import Link from 'next/link';
import { BrandLogo } from './BrandLogo';

type Category = { _id: string; name: string };
type Addon = { _id: string; name: string; price: number; priceCents?: number };
type AddonGroup = { _id: string; name: string; required: boolean; min: number; max: number; addons: Addon[] };
type Product = { _id: string; name: string; description?: string; imageUrl?: string; price: number; promotionalPrice?: number; categoryId?: string | { _id?: string }; available?: boolean; featured?: boolean; addonGroups?: AddonGroup[] };
type Restaurant = { _id:string;name:string;tradeName?:string;description?:string;bannerUrl?:string;bannerDesktopUrl?:string;bannerMobileUrl?:string;logoUrl?:string;establishmentType?:string;establishmentTypeName?:string;city?:string;state?:string;timezone:string;address?:string;mapUrl?:string;orderWhatsapp?:string;pickupInstructions?:string;pickupEnabled:boolean;deliveryEnabled:boolean;deliveryAvailable:boolean;deliveryUnavailableReason?:string;minimumOrderCents:number;customerServiceFeeCents:number;businessHours:Array<{dayOfWeek:number;isOpen:boolean;periods:Array<{openTime:string;closeTime:string}>}>;openingStatus:{status:'OPEN'|'CLOSED'|'UNCONFIGURED';isOpen:boolean|null};acceptingOrders:boolean;canAcceptOrdersNow:boolean;deliveryZones:Array<{_id:string;name:string;coverageType?:'ALL'|'SPECIFIC';fee:number;feeCents?:number;active?:boolean}>;paymentMethods:Array<{_id:string;name:string;method:string;active?:boolean}> };
type CartItem = Product & { quantity: number; addonNames: string[] };
type StoredCartItem = { productId: string; quantity: number; addonNames: string[] };

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const entityId = (value: Product['categoryId']) => typeof value === 'string' ? value : value?._id;

export function Menu({ slug }: { slug: string }) {
  const { user, login, logout } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkout, setCheckout] = useState(false);
  const [authGate, setAuthGate] = useState<'welcome'|'login'|'register'>();
  const [selectedProduct, setSelectedProduct] = useState<Product>();
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [hydratedCartKey, setHydratedCartKey] = useState('');
  const [message, setMessage] = useState<string>();
  const [fulfillment, setFulfillment] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [submitting, setSubmitting] = useState(false);
  const [menuQuery, setMenuQuery] = useState('');
  const cartKey = `menu-flow-cart:${slug}`;

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(apiUrl(`/restaurants/${slug}`), { cache: 'no-store' });
        if (!response.ok) throw new Error('Estabelecimento não encontrado');
        const data = await response.json() as Restaurant;
        setRestaurant(data);
        setFulfillment(data.pickupEnabled ? 'PICKUP' : 'DELIVERY');
        const menuResponse = await fetch(apiUrl(`/restaurants/${data._id}/menu`), { cache: 'no-store' });
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
    const timer = window.setInterval(() => {
      void fetch(apiUrl(`/restaurants/${slug}`), { cache: 'no-store' })
        .then(async (response) => { if (response.ok) setRestaurant(await response.json() as Restaurant); })
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [slug]);

  useEffect(() => {
    if (hydratedCartKey !== cartKey) return;
    if (cart.length === 0) sessionStorage.removeItem(cartKey);
    else sessionStorage.setItem(cartKey, JSON.stringify(cart.map(({ _id, quantity, addonNames }) => ({ productId: _id, quantity, addonNames }))));
  }, [cart, cartKey, hydratedCartKey]);

  useEffect(() => {
    if (!selectedProduct && !checkout && !authGate) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedProduct(undefined);
        setCheckout(false);
        setAuthGate(undefined);
      }
    };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [selectedProduct, checkout, authGate]);

  const openCheckout = async () => {
    setMessage(undefined);
    setCheckout(false);
    const session = getSession();
    if (!session || session.user.role !== 'CUSTOMER') {
      setAuthGate('welcome');
      return;
    }
    try {
      const response = await fetch(apiUrl('/auth/me'), { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: 'no-store' });
      if (!response.ok) throw new Error();
      const profile = await response.json() as AuthSession['user'];
      if (profile.role !== 'CUSTOMER') {
        setAuthGate('welcome');
        return;
      }
      setAuthGate(undefined);
      setCheckout(true);
    } catch {
      clearSession();
      logout();
      setMessage('Sua sessão expirou. Entre novamente para continuar.');
      setAuthGate('login');
    }
  };
  const authenticated = (session: AuthSession) => {
    login(session);
    setMessage(undefined);
    setAuthGate(undefined);
    setCheckout(true);
  };

  const addonPrice = (product: Product, names: string[]) => (product.addonGroups ?? [])
    .flatMap((group) => group.addons)
    .filter((addon) => names.includes(addon.name))
    .reduce((total, addon) => total + addon.price, 0);
  const subtotal = useMemo(() => cart.reduce((total, item) => total + ((item.promotionalPrice ?? item.price) + addonPrice(item, item.addonNames)) * item.quantity, 0), [cart]);
  const visibleCategories = useMemo(() => {
    const categoryIds = new Set(categories.map((category) => category._id));
    const sections = categories.flatMap((category) => {
      const categoryProducts = products.filter((product) => entityId(product.categoryId) === category._id);
      return categoryProducts.length ? [{ ...category, products: categoryProducts }] : [];
    });
    const uncategorizedProducts = products.filter((product) => { const id = entityId(product.categoryId); return !id || !categoryIds.has(id); });
    return uncategorizedProducts.length
      ? [...sections, { _id: 'outros', name: 'Outros', products: uncategorizedProducts }]
      : sections;
  }, [categories, products]);
  const filteredCategories = useMemo(() => {
    const query = menuQuery.trim().toLocaleLowerCase('pt-BR');
    if (!query) return visibleCategories;
    return visibleCategories.flatMap((category) => {
      const categoryMatches = category.name.toLocaleLowerCase('pt-BR').includes(query);
      const categoryProducts = category.products.filter((product) => categoryMatches || product.name.toLocaleLowerCase('pt-BR').includes(query) || product.description?.toLocaleLowerCase('pt-BR').includes(query));
      return categoryProducts.length ? [{ ...category, products: categoryProducts }] : [];
    });
  }, [menuQuery, visibleCategories]);
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
    if (!restaurant || submitting) return;
    const customerSession = getSession();
    if (!customerSession || customerSession.user.role !== 'CUSTOMER') {
      setCheckout(false);
      setAuthGate('welcome');
      setMessage('Entre ou crie uma conta de cliente para finalizar seu pedido.');
      return;
    }
    setSubmitting(true);
    // Reserve a user-initiated tab before the asynchronous POST; navigate it only after the order is saved.
    const whatsappWindow = restaurant.orderWhatsapp ? window.open('about:blank', '_blank') : null;
    const form = new FormData(event.currentTarget);
    const payload = {
      customerName: form.get('name'), phone: form.get('phone'), fulfillment,
      paymentMethod: form.get('paymentMethod'),
      deliveryZoneId: fulfillment === 'DELIVERY' ? form.get('deliveryZoneId') : undefined,
      address: fulfillment === 'DELIVERY' ? { zipCode: form.get('zipCode'), street: form.get('street'), number: form.get('number'), complement: form.get('complement'), neighborhood: form.get('neighborhood'), city: form.get('city'), state: form.get('state'), reference: form.get('reference') } : undefined,
      needsChange: form.get('needsChange') === 'yes',
      changeForCents: form.get('needsChange') === 'yes' ? parseMoneyToCents(String(form.get('changeFor'))) : undefined,
      items: cart.map(({ _id, quantity, addonNames, addonGroups }) => ({ productId: _id, quantity, addons: addonNames.map(name => { const group = (addonGroups ?? []).find(g => g.addons.some(a => a.name === name))!; const addon = group.addons.find(a => a.name === name)!; return { groupId: group._id, addonId: addon._id }; }) })),
    };
    try {
      const response = await fetch(apiUrl(`/restaurants/${restaurant._id}/orders`), { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID(), Authorization: `Bearer ${customerSession.accessToken}` }, body: JSON.stringify(payload) });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) { whatsappWindow?.close(); clearSession(); logout(); setCheckout(false); setAuthGate('login'); setMessage(response.status === 401 ? 'Sua sessão expirou. Entre novamente para continuar.' : 'Para realizar pedidos, entre com uma conta de cliente.'); return; }
        const data = await response.json().catch(() => null) as { message?: string | string[] } | null;
        setMessage(Array.isArray(data?.message) ? data.message[0] : data?.message ?? 'Não foi possível enviar o pedido');
        whatsappWindow?.close(); return;
      }
      const order = await response.json() as { orderNumber: string; publicToken: string; trackingUrl: string; whatsappUrl?: string }; setCart([]); setCheckout(false);
      if (order.whatsappUrl) { sessionStorage.setItem(`menu-flow-whatsapp:${order.orderNumber}`, order.whatsappUrl); if (whatsappWindow) whatsappWindow.location.href = order.whatsappUrl; else window.open(order.whatsappUrl, '_blank', 'noopener,noreferrer'); } else whatsappWindow?.close();
      window.location.assign(`${order.trackingUrl}&confirmed=1`);
    } catch { whatsappWindow?.close(); setMessage('Não foi possível conectar ao servidor. Tente novamente.'); } finally { setSubmitting(false); }
  }

  if (message && !restaurant) return <StatePage error message={message} />;
  if (!restaurant) return <StatePage message="Carregando cardápio…" />;

  return (
    <main className={`min-h-screen bg-background font-sans ${cart.length ? 'pb-28 lg:pb-14' : 'pb-12'}`}>
      {message && <div role="status" aria-live="polite" className="fixed left-4 right-4 top-4 z-[80] mx-auto max-w-md rounded-[22px] bg-ink px-4 py-3 text-sm font-bold text-white shadow-2xl sm:left-auto sm:right-6 sm:top-6 sm:w-full">{message}</div>}
      <MenuHeader restaurant={restaurant} slug={slug} />

      <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
          <div className="min-w-0">
            {products.length === 0 ? <EmptyMenu /> : <>
              <div className="sticky top-3 z-30 mb-1">
                <div className="mf-panel overflow-hidden rounded-[26px] px-3 py-3 sm:px-4 lg:px-5">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <nav aria-label="Categorias" className="scrollbar-none flex min-w-0 gap-2 overflow-x-auto pb-1 xl:pb-0">
                      {visibleCategories.map((category) => <a key={category._id} href={`#${category._id}`} className="group inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border bg-white px-4 py-2.5 text-sm font-extrabold text-stone-700 shadow-sm transition hover:border-ink/20 hover:bg-ink hover:text-white">
                        <CategoryIcon name={category.name} />
                        <span>{category.name}</span>
                      </a>)}
                    </nav>
                    <label className="relative block w-full shrink-0 xl:w-[320px]">
                      <span className="sr-only">Buscar no cardápio</span>
                      <SearchIcon />
                      <input value={menuQuery} onChange={(event) => setMenuQuery(event.target.value)} placeholder="Buscar no cardápio..." className="h-12 w-full rounded-full border border-border bg-white pl-11 pr-4 text-sm font-semibold text-stone-700 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-ink focus:ring-4 focus:ring-ink/10" />
                    </label>
                  </div>
                </div>
              </div>

              {filteredCategories.length === 0 ? <div className="mt-6 rounded-[28px] border border-border bg-white px-6 py-14 text-center shadow-sm"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-ink/10 text-ink"><SearchIcon compact /></div><h2 className="mt-4 text-xl font-black">Nenhum produto encontrado</h2><p className="mt-2 text-sm text-stone-500">Tente buscar por outro nome ou categoria.</p><button type="button" onClick={() => setMenuQuery('')} className="mt-5 min-h-11 rounded-xl bg-ink px-5 text-sm font-black text-white">LIMPAR BUSCA</button></div> : filteredCategories.map((category) => (
                <section id={category._id} key={category._id} className="scroll-mt-28 pt-6 first:pt-5 sm:pt-8">
                  <div className="mb-4 flex items-end justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink/10 text-ink"><CategoryIcon name={category.name} large /></span>
                        <div>
                          <h2 className="text-2xl font-black tracking-tight text-stone-900 sm:text-[29px]">{category.name}</h2>
                          <p className="mt-1 text-sm font-medium text-stone-500">{category.products.length} {category.products.length === 1 ? 'opção disponível' : 'opções disponíveis'}</p>
                        </div>
                      </div>
                    </div>
                    <a href="#topo-cardapio" className="hidden text-sm font-black text-ink hover:underline sm:inline">Topo ↑</a>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
                    {category.products.map((product) => <ProductCard key={product._id} product={product} open={restaurant.canAcceptOrdersNow} add={() => product.addonGroups?.length ? (setSelectedProduct(product), setSelectedAddons([])) : add(product)} />)}
                  </div>
                </section>
              ))}
            </>}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-6">
              <CartPanel cart={cart} subtotal={subtotal} addonPrice={addonPrice} setQuantity={setQuantity} checkout={openCheckout} requiresCustomerAuth={user?.role !== 'CUSTOMER'} />
            </div>
          </aside>
        </div>
      </div>

      {selectedProduct && <ProductModal product={selectedProduct} selected={selectedAddons} toggle={toggleAddon} close={() => setSelectedProduct(undefined)} canAdd={canAddSelectedProduct} total={(selectedProduct.promotionalPrice ?? selectedProduct.price) + addonPrice(selectedProduct, selectedAddons)} confirm={() => { add(selectedProduct, selectedAddons); setSelectedProduct(undefined); }} />}
      {cart.length > 0 && <MobileCartBar count={itemCount} subtotal={subtotal} open={openCheckout} requiresCustomerAuth={user?.role !== 'CUSTOMER'} />}
      {checkout && <CheckoutModal restaurant={restaurant} cart={cart} subtotal={subtotal} addonPrice={addonPrice} setQuantity={setQuantity} close={() => setCheckout(false)} submit={submit} fulfillment={fulfillment} setFulfillment={setFulfillment} customer={user?.role === 'CUSTOMER' ? user : undefined} submitting={submitting} />}
      {authGate && <CustomerAuthModal mode={authGate} setMode={setAuthGate} close={() => setAuthGate(undefined)} complete={authenticated} wrongRole={Boolean(user && user.role !== 'CUSTOMER')} />}
    </main>
  );
}
function MenuHeader({ restaurant, slug }: { restaurant: Restaurant; slug: string }) {
  const location = [restaurant.city, restaurant.state].filter(Boolean).join(' - ');
  const establishmentLabel = restaurant.establishmentTypeName ?? legacyEstablishmentLabel(restaurant.establishmentType);
  const availability = restaurant.canAcceptOrdersNow ? 'Aberto agora' : restaurant.openingStatus.status === 'UNCONFIGURED' ? 'Horário não informado' : restaurant.openingStatus.status === 'OPEN' && !restaurant.acceptingOrders ? 'Pedidos pausados' : 'Fechado';
  const serviceLabel = restaurant.deliveryEnabled && restaurant.pickupEnabled ? 'Entrega e retirada' : restaurant.deliveryEnabled ? 'Entrega disponível' : 'Retirada no local';

  return <header id="topo-cardapio" className="pb-5 pt-3 sm:pt-4">
    <div className="mx-auto flex min-h-16 w-full max-w-[1480px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8">
      <Link href="/" aria-label="Voltar para a página inicial do Menu Flow" className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        <BrandLogo variant="wordmark" priority className="h-9 w-auto bg-transparent sm:h-11 [&_img]:h-full [&_img]:w-auto" />
      </Link>
      <UserMenu returnTo={`/${slug}`} />
    </div>

    <div className="mx-auto w-full max-w-[1480px] px-4 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[30px] border border-border/90 bg-white shadow-[0_20px_65px_rgba(41,37,36,.10)] sm:rounded-[36px]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-accent/10 to-transparent" />
        <div className="grid xl:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)]">
          <div className="relative order-2 flex flex-col justify-center p-5 sm:p-7 xl:order-1 xl:min-h-[420px] xl:p-10">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[.18em] text-success"><span className={`h-2 w-2 rounded-full ${restaurant.canAcceptOrdersNow ? 'bg-success' : 'bg-danger'}`} />{availability}</span>
              <span className="inline-flex rounded-full border border-border bg-background/80 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-[.18em] text-stone-500">{establishmentLabel}</span>
            </div>

            <div className="mt-5 flex items-start gap-4 sm:gap-5">
              {restaurant.logoUrl
                ? <img src={restaurant.logoUrl} alt={`Logo de ${restaurant.name}`} className="h-16 w-16 shrink-0 rounded-[22px] border border-border bg-white object-contain p-1.5 shadow-md sm:h-[84px] sm:w-[84px]" />
                : <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-ink text-2xl font-black text-white shadow-md sm:h-[84px] sm:w-[84px] sm:text-3xl">{restaurant.name.charAt(0)}</span>}
              <div className="min-w-0">
                <h1 className="break-words text-[2rem] font-black leading-[0.98] tracking-tight text-stone-900 sm:text-[2.65rem] xl:text-[3.25rem]">{restaurant.tradeName || restaurant.name}</h1>
                <p className="mt-3 max-w-xl text-sm font-semibold text-stone-500 sm:text-base">{[location, serviceLabel].filter(Boolean).join(' • ')}</p>
              </div>
            </div>

            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600 sm:text-[15px]">{restaurant.description ?? 'Comida boa, atendimento prático e seu pedido do seu jeito.'}</p>

            <details className="mt-6 max-w-2xl rounded-[24px] border border-border bg-background/75 p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center gap-2 font-black text-ink">
                <ClockIcon />
                <span>Horários de funcionamento</span>
                <span className="ml-auto text-stone-400">⌄</span>
              </summary>
              <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
                {restaurant.businessHours.length ? restaurant.businessHours.map(day => <p key={day.dayOfWeek} className="flex flex-col justify-between gap-1 sm:flex-row sm:gap-4"><b>{['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][day.dayOfWeek]}</b><span className="text-stone-600 sm:text-right">{day.isOpen ? day.periods.map(period => `${period.openTime} — ${period.closeTime}`).join(' · ') : 'Fechado'}</span></p>) : <p>Horários ainda não informados.</p>}
                <p className="pt-1 text-xs text-stone-400">Fuso: {restaurant.timezone}</p>
              </div>
            </details>
          </div>

          <div className="relative order-1 min-h-[250px] overflow-hidden bg-gradient-to-br from-ink via-primary-hover to-accent sm:min-h-[320px] xl:order-2 xl:min-h-[420px]">
            {(restaurant.bannerDesktopUrl || restaurant.bannerUrl) ? <>
              <img src={restaurant.bannerDesktopUrl || restaurant.bannerUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl brightness-75" />
              <picture className="relative block h-full w-full">
                <source media="(max-width: 767px)" srcSet={restaurant.bannerMobileUrl || restaurant.bannerDesktopUrl || restaurant.bannerUrl} />
                <img src={restaurant.bannerDesktopUrl || restaurant.bannerUrl} alt={`Banner de ${restaurant.tradeName || restaurant.name}`} className="h-full w-full object-cover" />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-tr from-black/45 via-black/5 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-[24px] border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md sm:bottom-6 sm:left-6 sm:right-auto sm:max-w-[300px] sm:p-5">
                <p className="text-lg font-black leading-tight sm:text-2xl">Sabor que cria experiências.</p>
                <p className="mt-2 text-sm text-white/80">Escolha seus favoritos e finalize com praticidade no Menu Flow.</p>
              </div>
            </> : <>
              <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
              <div className="absolute bottom-5 right-6 max-w-[250px] rounded-3xl border border-white/15 bg-black/15 p-5 text-right text-white backdrop-blur-sm sm:bottom-8 sm:right-8">
                <p className="text-2xl font-black leading-tight">Sabor que aproxima pessoas.</p>
                <p className="mt-2 text-sm text-white/75">Escolha seus favoritos e peça em poucos passos.</p>
              </div>
            </>}
          </div>
        </div>

        <div className="grid border-t border-border bg-background/45 sm:grid-cols-2 xl:grid-cols-3">
          <div className="flex min-h-[76px] items-center gap-3 border-b border-border px-5 py-4 sm:px-6 xl:border-b-0 xl:border-r"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/10 text-success"><ClockIcon /></span><div><b className="block text-sm">{availability}</b><span className="text-xs text-stone-500">Confira os horários da loja</span></div></div>
          <div className="flex min-h-[76px] items-center gap-3 border-b border-border px-5 py-4 sm:px-6 xl:border-b-0 xl:border-r"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/10 text-ink"><LocationIcon /></span><div><b className="block text-sm">{location || 'Localização da loja'}</b><span className="text-xs text-stone-500">{restaurant.address || 'Consulte no pedido'}</span></div></div>
          <div className="flex min-h-[76px] items-center gap-3 px-5 py-4 sm:px-6 sm:col-span-2 xl:col-span-1"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/15 text-accent"><DeliveryIcon /></span><div><b className="block text-sm">{serviceLabel}</b><span className="text-xs text-stone-500">Escolha na finalização</span></div></div>
        </div>
      </section>
    </div>
  </header>;
}

function CategoryIcon({ name, large = false }: { name: string; large?: boolean }) {
  const normalized = name.toLocaleLowerCase('pt-BR');
  const size = large ? 'h-5 w-5' : 'h-4 w-4';
  if (/beb|refri|suco|drink/.test(normalized)) return <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M7 3h10l-1 17H8L7 3Z"/><path d="M9 7h6M14 3l2-2"/></svg>;
  if (/sobrem|doce|bolo|aça|acai/.test(normalized)) return <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 11h16v8H4z"/><path d="M6 11c1-4 3-6 6-6s5 2 6 6M12 5V2"/></svg>;
  if (/lanche|burger|hamb|sandu/.test(normalized)) return <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M4 11c0-4 3-7 8-7s8 3 8 7H4Z"/><path d="M3 14h18M5 18h14a2 2 0 0 0 2-2H3a2 2 0 0 0 2 2Z"/></svg>;
  if (/pizza/.test(normalized)) return <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="m12 3 9 17H3L12 3Z"/><circle cx="10" cy="12" r="1" fill="currentColor"/><circle cx="14" cy="16" r="1" fill="currentColor"/></svg>;
  return <svg className={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M7 3v7M4 3v4c0 2 1 3 3 3s3-1 3-3V3M7 10v11M16 3v18M16 3c3 2 4 5 4 8h-4"/></svg>;
}

function SearchIcon({ compact = false }: { compact?: boolean }) {
  return <svg className={compact ? 'h-6 w-6' : 'pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>;
}
function ClockIcon(){return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}
function LocationIcon(){return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>}
function DeliveryIcon(){return <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>}
function BagIcon(){return <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>}

function EmptyMenu() {
  return <section className="mt-3 min-h-72 rounded-3xl border border-border bg-surface px-6 py-10 text-center shadow-sm sm:mt-0 sm:min-h-80 sm:px-10 sm:py-14">
    <p className="text-left text-2xl font-black">Cardápio</p>
    <div className="mx-auto mt-8 max-w-md"><span className="text-5xl" aria-hidden>🍽️</span><h2 className="mt-4 text-lg font-black sm:text-xl">Este estabelecimento ainda não possui produtos disponíveis.</h2><p className="mt-2 text-stone-500">Volte em breve.</p></div>
  </section>;
}

function ProductCard({ product, open, add }: { product: Product; open: boolean; add: () => void }) {
  const hasPromotion = product.promotionalPrice != null && product.promotionalPrice < product.price;
  return <article className={`group relative flex min-w-0 overflow-hidden rounded-[26px] border bg-white shadow-[0_14px_36px_rgba(41,37,36,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(41,37,36,.11)] lg:flex-col ${product.featured ? 'border-accent/60 ring-1 ring-accent/15' : 'border-border/90'}`}>
    <div className="relative h-32 w-32 shrink-0 overflow-hidden bg-stone-100 sm:h-36 sm:w-36 lg:aspect-[16/10] lg:h-auto lg:w-full">
      {product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" /> : <div className="grid h-full w-full place-items-center bg-gradient-to-br from-stone-100 via-white to-ink/10 text-3xl font-black text-ink/35" aria-label="Produto sem imagem">MF</div>}
      {product.featured && <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-white shadow-lg">★ Destaque</div>}
      {!open && <div className="absolute inset-0 grid place-items-center bg-black/45 p-3 text-center text-xs font-black uppercase tracking-wide text-white backdrop-blur-[1px]">Pedidos indisponíveis agora</div>}
    </div>
    <div className="flex min-w-0 flex-1 flex-col p-4 sm:p-5">
      <div className="min-w-0">
        <h3 className="break-words text-[17px] font-black leading-tight text-stone-900 sm:text-xl">{product.name}</h3>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-stone-500">{product.description || 'Confira este produto.'}</p>
      </div>
      <div className="mt-auto pt-4">
        {hasPromotion && <div className="mb-2 flex flex-wrap items-center gap-2"><span className="rounded-full bg-danger/10 px-2 py-1 text-[9px] font-black uppercase tracking-[.08em] text-danger">Oferta</span><del className="text-xs font-bold text-stone-400 decoration-2">{money(product.price)}</del></div>}
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between lg:flex-row lg:items-end">
          <b className="text-xl font-black tracking-tight text-ink">{money(product.promotionalPrice ?? product.price)}</b>
          <button type="button" disabled={!open} onClick={add} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto lg:w-full"><span className="grid h-5 w-5 place-items-center rounded-full bg-white/15 text-base leading-none">+</span>Adicionar</button>
        </div>
      </div>
    </div>
  </article>;
}

function CartPanel({ cart, subtotal, addonPrice, setQuantity, checkout, requiresCustomerAuth }: { cart: CartItem[]; subtotal: number; addonPrice: (p: Product, n: string[]) => number; setQuantity: (item: CartItem, quantity: number) => void; checkout: () => void; requiresCustomerAuth: boolean }) {
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  return <section className="overflow-hidden rounded-[30px] border border-border/90 bg-white shadow-[0_20px_55px_rgba(41,37,36,.10)]">
    <div className="flex items-center gap-3 border-b border-border px-5 py-5">
      <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-ink/10 text-ink"><BagIcon />{count > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-ink px-1.5 text-[10px] font-black text-white ring-2 ring-white">{count}</span>}</span>
      <div><h2 className="text-xl font-black tracking-tight">Sua sacola</h2><p className="mt-0.5 text-xs font-medium text-stone-500">{cart.length ? 'Confira seus itens' : 'Pronta para receber seus favoritos'}</p></div>
    </div>
    {cart.length === 0 ? <div className="px-5 py-12 text-center text-stone-500"><span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-background text-ink"><BagIcon /></span><p className="mt-4 font-black text-stone-700">Sua sacola está vazia</p><p className="mx-auto mt-1 max-w-[220px] text-sm leading-5">Adicione produtos do cardápio para começar.</p></div> : <div className="p-5">
      <div className="divide-y divide-border">{cart.map((item) => <CartRow key={`${item._id}-${item.addonNames.join()}`} item={item} addonPrice={addonPrice} setQuantity={setQuantity} />)}</div>
      <div className="mt-5 rounded-[24px] border border-border bg-background/70 p-4"><div className="flex items-center justify-between gap-4"><span className="text-sm font-semibold text-stone-500">Subtotal</span><b className="whitespace-nowrap text-lg">{money(subtotal)}</b></div><p className="mt-2 text-xs leading-5 text-stone-400">Taxas e forma de entrega são confirmadas na finalização.</p></div>
      {requiresCustomerAuth && <p className="mt-3 rounded-[22px] border border-border bg-white p-3 text-xs font-semibold leading-5 text-stone-600">Para finalizar, entre na sua conta de cliente ou crie um cadastro. Sua sacola será mantida.</p>}
      <button type="button" onClick={checkout} className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-[22px] bg-ink px-4 font-black text-white shadow-lg shadow-ink/10 hover:bg-primary-hover">{requiresCustomerAuth ? 'ENTRAR PARA FINALIZAR' : 'FINALIZAR PEDIDO'}<span aria-hidden>→</span></button>
    </div>}
  </section>;
}

function CartRow({ item, addonPrice, setQuantity }: { item: CartItem; addonPrice: (p: Product, n: string[]) => number; setQuantity: (item: CartItem, quantity: number) => void }) {
  const unitPrice = (item.promotionalPrice ?? item.price) + addonPrice(item, item.addonNames);
  return <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
    {item.imageUrl ? <img src={item.imageUrl} alt="" aria-hidden="true" className="h-14 w-14 shrink-0 rounded-xl object-cover" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-background text-sm font-black text-ink/40">MF</div>}
    <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><b className="line-clamp-1 break-words text-sm">{item.name}</b>{item.addonNames.length > 0 && <p className="mt-0.5 line-clamp-2 break-words text-[11px] leading-4 text-stone-500">{item.addonNames.join(', ')}</p>}</div><b className="shrink-0 whitespace-nowrap text-sm text-ink">{money(unitPrice * item.quantity)}</b></div>
      <div className="mt-2 flex h-9 w-fit items-center rounded-xl border border-border bg-white"><button type="button" aria-label={`Diminuir ${item.name}`} className="grid h-9 w-9 place-items-center text-lg font-bold text-stone-500 hover:bg-background" onClick={() => setQuantity(item, item.quantity - 1)}>−</button><b className="min-w-7 text-center text-xs">{item.quantity}</b><button type="button" aria-label={`Aumentar ${item.name}`} className="grid h-9 w-9 place-items-center text-lg font-bold text-ink hover:bg-background" onClick={() => setQuantity(item, item.quantity + 1)}>+</button></div>
    </div>
  </div>;
}

function MobileCartBar({ count, subtotal, open, requiresCustomerAuth }: { count: number; subtotal: number; open: () => void; requiresCustomerAuth: boolean }) {
  return <aside className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/96 px-3 pt-2 shadow-[0_-14px_36px_rgba(41,37,36,.12)] backdrop-blur-xl lg:hidden" style={{ paddingBottom: 'max(.65rem, env(safe-area-inset-bottom))' }}><button type="button" onClick={open} className="mx-auto flex min-h-14 w-full max-w-2xl items-center justify-between gap-3 rounded-[22px] bg-ink px-4 font-black text-white shadow-lg shadow-ink/10"><span className="flex min-w-0 items-center gap-3"><span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10"><BagIcon /><span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[10px] font-black text-ink">{count}</span></span><span className="truncate text-sm">{requiresCustomerAuth ? 'Entrar para finalizar' : 'Ver sua sacola'}</span></span><span className="shrink-0 whitespace-nowrap text-sm">{money(subtotal)} →</span></button></aside>;
}

function ModalFrame({ label, close, children, sheet = false }: { label: string; close: () => void; children: React.ReactNode; sheet?: boolean }) {
  return <div className={`fixed inset-0 z-[70] overflow-y-auto bg-ink/60 p-0 ${sheet ? 'flex items-end sm:block sm:p-4' : 'p-3 sm:p-6'}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section role="dialog" aria-modal="true" aria-label={label} className={`mx-auto max-h-[92dvh] w-full overflow-y-auto bg-surface shadow-2xl ${sheet ? 'max-w-2xl rounded-t-3xl p-5 sm:my-6 sm:rounded-3xl sm:p-7' : 'my-3 max-w-2xl rounded-3xl p-5 sm:my-6 sm:p-7'}`}>{children}</section></div>;
}

function ProductModal({ product, selected, toggle, close, canAdd, total, confirm }: { product: Product; selected: string[]; toggle: (group: AddonGroup, name: string) => void; close: () => void; canAdd: boolean; total: number; confirm: () => void }) {
  return <ModalFrame label={`Personalizar ${product.name}`} close={close} sheet><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-xl font-black sm:text-2xl">{product.name}</h2><p className="mt-1 text-sm text-stone-500">{product.description}</p></div><button type="button" aria-label="Fechar produto" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border">✕</button></div>{(product.addonGroups ?? []).map((group) => <fieldset key={group.name} className="mt-5 border-t pt-4"><legend className="font-bold">{group.name} {group.required && <span className="text-danger">* obrigatório</span>}</legend><p className="mt-1 text-xs text-stone-500">Escolha de {group.min ?? (group.required ? 1 : 0)} a {group.max} opções</p>{group.addons.map((addon) => <label key={addon.name} className="mt-3 flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border p-3"><span className="break-words"><input className="mr-3 h-5 w-5 align-middle accent-primary" type="checkbox" checked={selected.includes(addon.name)} onChange={() => toggle(group, addon.name)} />{addon.name}</span><b className="shrink-0 whitespace-nowrap">{addon.price > 0 ? `+ ${money(addon.price)}` : 'Grátis'}</b></label>)}</fieldset>)}<button type="button" disabled={!canAdd} onClick={confirm} className="sticky bottom-0 mt-6 min-h-14 w-full rounded-xl bg-ink px-4 font-black text-white disabled:opacity-40">ADICIONAR · {money(total)}</button></ModalFrame>;
}

function CustomerAuthModal({mode,setMode,close,complete,wrongRole}:{mode:'welcome'|'login'|'register';setMode:(mode:'welcome'|'login'|'register')=>void;close:()=>void;complete:(session:AuthSession)=>void;wrongRole:boolean}) {
  const [error,setError]=useState(''); const [loading,setLoading]=useState(false); const [duplicate,setDuplicate]=useState(false);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);if(mode==='register'&&form.get('password')!==form.get('confirmPassword')){setError('As senhas não coincidem.');return}const payload=customerAuthPayload(mode === 'register' ? 'register' : 'login',form);setLoading(true);setError('');setDuplicate(false);try{const response=await fetch(apiUrl(mode==='register'?'/auth/customer/register':'/auth/login'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const data=await response.json().catch(()=>null) as AuthSession&{message?:string|string[]};if(!response.ok){if(mode==='register'&&response.status===409){setDuplicate(true);throw new Error('Já existe uma conta com este e-mail. Entre para continuar.')}if(mode==='login'&&response.status===401)throw new Error('E-mail ou senha incorretos.');throw new Error(mode==='login'?'Não foi possível entrar agora. Tente novamente.':'Não foi possível criar a conta agora. Tente novamente.')}if(!data.accessToken||!data.user)throw new Error('Não foi possível entrar agora. Tente novamente.');if(data.user.role!=='CUSTOMER')throw new Error('Para realizar pedidos, entre com uma conta de cliente.');complete(data)}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível entrar agora. Tente novamente.')}finally{setLoading(false)}}
  return <ModalFrame label="Entre para continuar" close={close} sheet><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-black">Entre para continuar</h2><p className="mt-2 text-stone-600">{wrongRole?'Para realizar pedidos, entre com uma conta de cliente.':'Para finalizar seu pedido, entre na sua conta ou crie um cadastro.'}</p></div><button aria-label="Fechar autenticação" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border">✕</button></div>{mode==='welcome'?<div className="mt-7 grid gap-3"><button onClick={()=>setMode('login')} className="min-h-14 rounded-xl bg-ink font-black text-white">ENTRAR</button><p className="text-center text-sm text-stone-500">Ainda não possui cadastro?</p><button onClick={()=>setMode('register')} className="min-h-14 rounded-xl border font-black">CRIAR CONTA</button></div>:<form onSubmit={submit} className="mt-6">{mode==='register'&&<div className="grid gap-3 sm:grid-cols-2"><label className="font-bold">Nome<input name="name" required className="field"/></label><label className="font-bold">Telefone<input name="phone" required inputMode="tel" className="field"/></label></div>}<label className="mt-3 block font-bold">E-mail<input name="email" required type="email" autoComplete="email" className="field"/></label><label className="mt-3 block font-bold">Senha<PasswordField name="password" required minLength={8} autoComplete={mode==='register'?'new-password':'current-password'} className="field"/></label>{mode==='register'&&<label className="mt-3 block font-bold">Confirmar senha<PasswordField name="confirmPassword" required minLength={8} autoComplete="new-password" className="field"/></label>}{error&&<p role="alert" className="mt-4 rounded-xl bg-danger/10 p-3 font-bold text-danger">{error}</p>}<button disabled={loading} className="mt-5 min-h-14 w-full rounded-xl bg-ink font-black text-white disabled:opacity-50">{loading?'AGUARDE…':mode==='register'?'CRIAR CONTA':'ENTRAR'}</button>{mode==='login'&&<a href="/cliente/login" className="mt-4 block text-center text-sm font-bold underline">Esqueci minha senha</a>}<button type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('');setDuplicate(false)}} className="mt-4 min-h-11 w-full text-sm font-bold underline">{mode==='login'?'Ainda não tenho conta — criar cadastro':duplicate?'Entrar':'Já tenho uma conta'}</button></form>}</ModalFrame>;
}

function CheckoutModal({ restaurant, cart, subtotal, addonPrice, setQuantity, close, submit, fulfillment, setFulfillment, customer, submitting }: { restaurant: Restaurant; cart: CartItem[]; subtotal: number; addonPrice: (p: Product, n: string[]) => number; setQuantity: (item: CartItem, quantity: number) => void; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void; fulfillment: 'PICKUP' | 'DELIVERY'; setFulfillment: (value: 'PICKUP' | 'DELIVERY') => void; customer?: { name: string; phone?: string }; submitting: boolean }) {
  const methods = useMemo(() => restaurant.paymentMethods.filter(method => method.active !== false), [restaurant.paymentMethods]);
  const zones = useMemo(() => restaurant.deliveryZones.filter(zone => zone.active !== false), [restaurant.deliveryZones]);
  const deliveryOffered = canOfferDelivery(restaurant);
  const [payment, setPayment] = useState(methods[0]?.method ?? '');
  const [zoneId, setZoneId] = useState(zones.find(item=>item.coverageType==='ALL')?._id ?? '');
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ?? '');
  const [addressComplete, setAddressComplete] = useState(false);
  const [address, setAddress] = useState({ zipCode:'', street:'', number:'', neighborhood:'', complement:'', reference:'' });
  const [postalError, setPostalError] = useState('');
  const [lookingUpPostalCode, setLookingUpPostalCode] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Array<{_id:string;label:string;zipCode:string;street:string;number:string;neighborhood:string;complement?:string;city:string;state:string}>>([]);
  const [cashValid, setCashValid] = useState(true);
  useEffect(() => { if (!methods.some(item => item.method === payment)) setPayment(methods[0]?.method ?? ''); }, [methods, payment]);
  useEffect(() => { if (!zones.some(item => item._id === zoneId)) setZoneId(zones.find(item=>item.coverageType==='ALL')?._id ?? ''); }, [zones, zoneId]);
  useEffect(() => {
    if (fulfillment === 'PICKUP' && !restaurant.pickupEnabled && deliveryOffered) setFulfillment('DELIVERY');
    if (fulfillment === 'DELIVERY' && !deliveryOffered && restaurant.pickupEnabled) setFulfillment('PICKUP');
  }, [deliveryOffered, fulfillment, restaurant.pickupEnabled, setFulfillment]);
  useEffect(()=>{const session=getSession();if(session?.user.role!=='CUSTOMER')return;void fetch(apiUrl('/customer/me'),{headers:{Authorization:`Bearer ${session.accessToken}`}}).then(async response=>{if(response.ok){const profile=await response.json() as {addresses?:typeof savedAddresses};setSavedAddresses(profile.addresses??[])}}).catch(()=>undefined)},[]); // Addresses remain account-wide; eligibility is checked when selected.
  const universalZone = zones.find(zone => zone.coverageType === 'ALL');
  const selectedZone = universalZone ?? zones.find(zone => zone._id === zoneId);
  useEffect(()=>setAddressComplete(['zipCode','street','number','neighborhood'].every(field=>address[field as keyof typeof address].trim().length>0)),[address]);
  async function lookupPostalCode() {
    const digits=address.zipCode.replace(/\D/g,''); if(digits.length!==8)return;
    setLookingUpPostalCode(true); setPostalError('');
    try { const response=await fetch(`https://viacep.com.br/ws/${digits}/json/`); const data=await response.json() as {erro?:boolean;logradouro?:string;bairro?:string;localidade?:string;uf?:string};
      if(data.erro) throw new Error('CEP não encontrado.');
      if(data.localidade?.localeCompare(restaurant.city??'','pt-BR',{sensitivity:'base'})!==0||data.uf?.toUpperCase()!==restaurant.state?.toUpperCase()) { setPostalError(`Este estabelecimento realiza entregas somente em ${restaurant.city} - ${restaurant.state}.`); return; }
      setAddress(current=>({...current,street:data.logradouro||current.street,neighborhood:data.bairro||current.neighborhood}));
    } catch(error){setPostalError(error instanceof Error?error.message:'Não foi possível consultar o CEP.');} finally{setLookingUpPostalCode(false);}
  }
  const deliveryFee = fulfillment === 'DELIVERY' ? (selectedZone?.feeCents ?? Math.round((selectedZone?.fee ?? 0) * 100)) / 100 : 0;
  const customerServiceFeeCents = restaurant.customerServiceFeeCents ?? 0;
  const totalCents = Math.round((subtotal + deliveryFee) * 100) + customerServiceFeeCents;
  const invalidReason = !restaurant.canAcceptOrdersNow ? 'Este estabelecimento não está recebendo pedidos agora.'
    : cart.length === 0 ? 'Sua sacola está vazia.'
    : Math.round(subtotal * 100) < restaurant.minimumOrderCents ? `O pedido mínimo é ${money(restaurant.minimumOrderCents / 100)}.`
    : !name.trim() ? 'Informe seu nome.'
    : !phone.trim() ? 'Informe seu telefone.'
    : fulfillment === 'DELIVERY' && !selectedZone ? 'Entrega não disponível para esta região.'
    : fulfillment === 'DELIVERY' && Boolean(postalError) ? postalError
    : fulfillment === 'DELIVERY' && !addressComplete ? 'Preencha o endereço completo para entrega.'
    : methods.length === 0 ? 'Este estabelecimento ainda não configurou formas de pagamento.'
    : !payment ? 'Selecione uma forma de pagamento.'
    : payment === 'CASH' && !cashValid ? 'Configure um valor de troco válido.' : '';
  return <ModalFrame label="Finalizar pedido" close={close} sheet><form className="pb-3" onSubmit={submit}><div className="flex items-center justify-between gap-4"><h2 className="text-xl font-black sm:text-2xl">Finalizar pedido</h2><button type="button" onClick={close} aria-label="Fechar checkout" className="grid h-11 w-11 place-items-center rounded-xl border">✕</button></div>
    <CheckoutSection number="1" title="Seu pedido"><div className="rounded-2xl bg-background p-4">{cart.map(item => <CartRow key={`${item._id}-${item.addonNames.join()}`} item={item} addonPrice={addonPrice} setQuantity={setQuantity} />)}<p className="mt-4 flex justify-between border-t pt-4 text-lg font-black"><span>Subtotal</span><span>{money(subtotal)}</span></p></div></CheckoutSection>
    <CheckoutSection number="2" title="Seus dados"><div className="grid gap-x-4 sm:grid-cols-2"><label className="font-bold">Nome<input required name="name" value={name} onChange={e=>setName(e.target.value)} className="field" /></label><label className="font-bold">Telefone<input required name="phone" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} className="field" /></label></div></CheckoutSection>
    <CheckoutSection number="3" title="Como receber"><div className="grid gap-3 sm:grid-cols-2">{restaurant.pickupEnabled&&<label className={`rounded-xl border p-4 font-bold ${fulfillment==='PICKUP'?'border-ink bg-lime/20':''}`}><input className="mr-2" type="radio" name="fulfillmentChoice" checked={fulfillment==='PICKUP'} onChange={()=>setFulfillment('PICKUP')}/>Retirar no estabelecimento</label>}{deliveryOffered&&<label className={`rounded-xl border p-4 font-bold ${fulfillment==='DELIVERY'?'border-ink bg-lime/20':''}`}><input className="mr-2" type="radio" name="fulfillmentChoice" checked={fulfillment==='DELIVERY'} onChange={()=>setFulfillment('DELIVERY')}/>Entrega</label>}</div>{restaurant.deliveryEnabled&&!deliveryOffered&&<p className="mt-3 text-sm font-semibold text-stone-500">{restaurant.deliveryUnavailableReason||'Entrega temporariamente indisponível.'}</p>}</CheckoutSection>
    <CheckoutSection number="4" title={fulfillment==='DELIVERY'?'Endereço de entrega':'Retirada'}>{fulfillment==='DELIVERY'?<div className="grid gap-x-4 sm:grid-cols-2">{savedAddresses.length>0&&<label className="font-bold sm:col-span-2">Usar endereço salvo<select className="field" defaultValue="" onChange={event=>{const saved=savedAddresses.find(item=>item._id===event.target.value);if(!saved)return;if(saved.city.localeCompare(restaurant.city??'','pt-BR',{sensitivity:'base'})!==0||saved.state.toUpperCase()!==restaurant.state?.toUpperCase()){setPostalError('Este endereço está fora da cidade atendida pelo estabelecimento.');return}setPostalError('');setAddress({zipCode:saved.zipCode,street:saved.street,number:saved.number,neighborhood:saved.neighborhood,complement:saved.complement??'',reference:''});const matching=zones.find(zone=>zone.coverageType!=='ALL'&&zone.name.localeCompare(saved.neighborhood,'pt-BR',{sensitivity:'base'})===0);if(!universalZone)setZoneId(matching?._id??'')}}><option value="">Preencher outro endereço</option>{savedAddresses.map(item=><option key={item._id} value={item._id}>{item.label} · {item.neighborhood}, {item.city}/{item.state}</option>)}</select></label>}<label className="font-bold">CEP<input required name="zipCode" inputMode="numeric" value={address.zipCode} onChange={e=>{setAddress({...address,zipCode:e.target.value});setPostalError('')}} onBlur={()=>void lookupPostalCode()} className="field" />{lookingUpPostalCode&&<small className="text-stone-500">Consultando CEP…</small>}</label><label className="font-bold">Bairro{universalZone?<input required maxLength={100} name="neighborhood" value={address.neighborhood} onChange={e=>setAddress({...address,neighborhood:e.target.value})} className="field" placeholder="Informe seu bairro"/>:<select required name="deliveryZoneId" className="field" value={zoneId} onChange={e=>{setZoneId(e.target.value);const chosen=zones.find(zone=>zone._id===e.target.value);setAddress({...address,neighborhood:chosen?.name??''})}}><option value="">Selecione o bairro</option>{zones.filter(zone=>zone.coverageType!=='ALL').map(zone=><option key={zone._id} value={zone._id}>{zone.name}</option>)}</select>}<input type="hidden" name="deliveryZoneId" value={selectedZone?._id??''}/>{!universalZone&&<input type="hidden" name="neighborhood" value={address.neighborhood}/>}</label><label className="font-bold">Rua<input required name="street" value={address.street} onChange={e=>setAddress({...address,street:e.target.value})} className="field" /></label><label className="font-bold">Número<input required name="number" value={address.number} onChange={e=>setAddress({...address,number:e.target.value})} className="field" /></label><label className="font-bold">Complemento<input name="complement" value={address.complement} onChange={e=>setAddress({...address,complement:e.target.value})} className="field" /></label><label className="font-bold">Cidade<input required readOnly aria-readonly="true" name="city" value={restaurant.city??''} className="field bg-stone-100 text-stone-600" /></label><label className="font-bold">UF<input required readOnly aria-readonly="true" name="state" value={restaurant.state??''} className="field bg-stone-100 text-stone-600" /></label><label className="font-bold">Referência<input name="reference" value={address.reference} onChange={e=>setAddress({...address,reference:e.target.value})} className="field" /></label>{postalError&&<p role="alert" className="sm:col-span-2 rounded-xl bg-danger/10 p-3 font-bold text-danger">{postalError}</p>}</div>:<div className="rounded-xl bg-background p-4"><b>Retirada em:</b><p>{restaurant.address||[restaurant.city,restaurant.state].filter(Boolean).join(' - ')}</p>{restaurant.pickupInstructions&&<p className="mt-2 text-sm">{restaurant.pickupInstructions}</p>}{restaurant.mapUrl&&<a href={restaurant.mapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center rounded-xl font-black text-accent">📍 COMO CHEGAR</a>}</div>}</CheckoutSection>
    <CheckoutSection number="5" title="Pagamento">{methods.length?<label className="block font-bold">Forma de pagamento<select required name="paymentMethod" className="field" value={payment} onChange={e=>setPayment(e.target.value)}>{methods.map(item=><option key={item._id} value={item.method}>{paymentMethodLabel(item.method,item.name)}</option>)}</select></label>:<p role="alert" className="rounded-xl border border-gold bg-gold/10 p-4 font-bold">Este estabelecimento ainda não configurou formas de pagamento.</p>}</CheckoutSection>
    {payment==='CASH'&&<CheckoutSection number="6" title="Troco"><CashChange totalCents={totalCents} validChange={setCashValid}/></CheckoutSection>}
    <CheckoutSection number={payment==='CASH'?'7':'6'} title="Resumo"><div className="rounded-xl bg-background p-4 text-sm"><p className="flex justify-between"><span>Subtotal</span><b>{money(subtotal)}</b></p><p className="mt-1 flex justify-between"><span>Taxa de entrega</span><b>{money(deliveryFee)}</b></p><p className="mt-1 flex items-center justify-between gap-3"><span>Taxa de serviço Menu Flow <abbr className="cursor-help rounded-full border px-1 text-xs no-underline" title="Taxa destinada à manutenção, segurança, suporte, desempenho e evolução contínua da plataforma Menu Flow." aria-label="Sobre a taxa de serviço Menu Flow">?</abbr></span><b>{money(customerServiceFeeCents/100)}</b></p><p className="mt-2 flex justify-between border-t pt-2 text-lg font-black"><span>Total</span><span>{money(totalCents/100)}</span></p></div></CheckoutSection>
    {invalidReason&&<p role="alert" className="mt-5 rounded-xl bg-danger/10 p-4 text-sm font-bold text-danger">{invalidReason}</p>}<div className="sticky bottom-0 -mx-1 mt-3 border-t border-border bg-surface/95 px-1 pb-[max(.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur"><button disabled={submitting||Boolean(invalidReason)} className="min-h-14 w-full rounded-xl bg-ink px-4 font-black text-white disabled:opacity-50">{submitting?'ENVIANDO…':`CONFIRMAR PEDIDO · ${money(totalCents/100)}`}</button></div></form></ModalFrame>;
}

function CheckoutSection({number,title,children}:{number:string;title:string;children:React.ReactNode}){return <section className="mt-6"><h3 className="mb-3 text-lg font-black"><span className="mr-2 inline-grid h-7 w-7 place-items-center rounded-full bg-ink text-sm text-white">{number}</span>{title}</h3>{children}</section>}

function StatePage({ message, error = false }: { message: string; error?: boolean }) {
  return <main className="mx-auto min-h-[60dvh] w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><div className={`rounded-3xl p-8 text-center ${error ? 'border border-danger/30 bg-danger/10 text-danger' : 'bg-surface'}`}>{!error && <div className="mx-auto h-48 max-w-2xl animate-pulse rounded-2xl bg-stone-200" />}<h1 className="mt-5 text-xl font-black sm:text-2xl">{message}</h1>{error && <a href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-ink px-5 font-bold text-white">Voltar para o início</a>}</div></main>;
}

function CashChange({totalCents,validChange}:{totalCents:number;validChange:(valid:boolean)=>void}){const [needs,setNeeds]=useState(false);const [value,setValue]=useState('');const changeForCents=parseMoneyToCents(value);const valid=!needs||(changeForCents!==undefined&&changeForCents>=totalCents);useEffect(()=>validChange(valid),[valid,validChange]);return <fieldset className="rounded-xl border p-4"><legend className="font-bold">Precisa de troco?</legend><div className="mt-3 flex gap-5"><label className="font-bold"><input className="mr-2 h-5 w-5 align-middle" required type="radio" name="needsChange" value="no" checked={!needs} onChange={()=>{setNeeds(false);setValue('')}}/>Não</label><label className="font-bold"><input className="mr-2 h-5 w-5 align-middle" type="radio" name="needsChange" value="yes" checked={needs} onChange={()=>setNeeds(true)}/>Sim</label></div>{needs&&<><label className="mt-4 block font-bold">Troco para quanto?<input required name="changeFor" inputMode="decimal" placeholder="R$ 50,00" value={value} onChange={e=>setValue(e.target.value)} className="field"/></label>{changeForCents!==undefined&&<p className={`mt-2 font-bold ${valid?'text-success':'text-danger'}`}>{valid?`Troco estimado: ${money((changeForCents-totalCents)/100)}`:'O valor para troco não pode ser menor que o total do pedido.'}</p>}</>}</fieldset>}

function parseMoneyToCents(value:string):number|undefined{const cleaned=value.replace(/[^\d,.]/g,'').trim();if(!cleaned)return undefined;const lastComma=cleaned.lastIndexOf(','),lastDot=cleaned.lastIndexOf('.');const separator=Math.max(lastComma,lastDot);const normalized=separator>=0?`${cleaned.slice(0,separator).replace(/[.,]/g,'')}.${cleaned.slice(separator+1).replace(/[.,]/g,'')}`:cleaned;const amount=Number(normalized);return Number.isFinite(amount)?Math.round(amount*100):undefined}
