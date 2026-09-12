'use client';

import { useEffect, useState } from 'react';
import { HomeBannerCarousel, type PublicHomeBanner } from '../components/home/HomeBannerCarousel';
import { Header } from '../components/home/Header';
import { RestaurantGrid, RestaurantGridSkeleton } from '../components/restaurants/RestaurantGrid';
import { apiUrl } from '../lib/api';
import type { City, EstablishmentTypeOption, RestaurantPage } from '../lib/public-restaurants';

const CITY_KEY = 'menu-flow.selected-city';

export default function HomePage() {
  const [cities, setCities] = useState<City[]>([]);
  const [types, setTypes] = useState<EstablishmentTypeOption[]>([]);
  const [banners, setBanners] = useState<PublicHomeBanner[]>([]);
  const [city, setCity] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [type, setType] = useState('');
  const [result, setResult] = useState<RestaurantPage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [statusRefresh, setStatusRefresh] = useState(0);

  useEffect(() => {
    setCity(localStorage.getItem(CITY_KEY) || '');
    void fetch(apiUrl('/public/home-banners'), { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setBanners(data as PublicHomeBanner[]))
      .catch(() => setBanners([]));
    void Promise.all([fetch(apiUrl('/public/cities')), fetch(apiUrl('/public/establishment-types'))])
      .then(async ([citiesResponse, typesResponse]) => {
        if (!citiesResponse.ok || !typesResponse.ok) throw new Error();
        setCities(await citiesResponse.json() as City[]);
        setTypes(await typesResponse.json() as EstablishmentTypeOption[]);
      })
      .catch(() => setError('Não foi possível carregar os filtros agora.'));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = window.setInterval(() => setStatusRefresh((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '12' });
    const [selectedCity, state] = city.split('|');
    if (selectedCity) params.set('city', selectedCity);
    if (state) params.set('state', state);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (openOnly) params.set('open', 'true');
    if (type) params.set('type', type);
    setLoading(true);
    setError('');
    void fetch(apiUrl(`/public/establishments?${params}`), { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error(); setResult(await response.json() as RestaurantPage); })
      .catch((cause: unknown) => { if ((cause as { name?: string }).name !== 'AbortError') setError('Não foi possível carregar os estabelecimentos. Tente novamente.'); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [city, debouncedSearch, openOnly, type, page, statusRefresh]);

  function selectCity(value: string) {
    setCity(value); setPage(1);
    if (value) localStorage.setItem(CITY_KEY, value); else localStorage.removeItem(CITY_KEY);
  }

  const selectedName = city.split('|')[0];
  const selectedType = types.find((item) => item.slug === type);
  const heading = selectedType
    ? selectedName ? `${selectedType.name} em ${selectedName}` : selectedType.name
    : selectedName ? `Estabelecimentos em ${selectedName}` : 'Todos os estabelecimentos';

  return (
    <main className="min-h-screen bg-background">
      <Header cities={cities} city={city} onCityChange={selectCity} search={search} onSearchChange={setSearch} />
      <HomeBannerCarousel banners={banners} />

      <section className="mx-auto w-full max-w-7xl px-4 pb-12 pt-7 sm:px-6 sm:pt-9 lg:pb-16">
        <div className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Filtrar por tipo">
          <div className="flex min-w-max gap-2 pb-1 sm:min-w-0 sm:flex-wrap">
            {[{ id: 'all', name: 'Todos', slug: '' }, ...types].map((option) => (
              <button
                key={option.id}
                onClick={() => { setType(option.slug); setPage(1); }}
                aria-pressed={type === option.slug}
                className={`min-h-10 rounded-full border px-4 py-2 text-sm font-black transition ${type === option.slug ? 'border-primary bg-primary text-white shadow-sm' : 'border-border bg-surface text-stone-700 hover:border-primary/30 hover:bg-white'}`}
              >
                {option.name}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[.18em] text-accent">Explore perto de você</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-stone-900 sm:text-3xl lg:text-[34px]">{heading}</h2>
            {result && <p className="mt-2 text-sm font-medium text-stone-500">{result.pagination.total} {result.pagination.total === 1 ? 'estabelecimento encontrado' : 'estabelecimentos encontrados'}</p>}
          </div>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-3 self-start rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-black shadow-sm sm:self-auto">
            <input type="checkbox" checked={openOnly} onChange={(event) => { setOpenOnly(event.target.checked); setPage(1); }} />
            Abertos agora
          </label>
        </div>

        <div className="mt-6">
          {error ? (
            <div role="alert" className="rounded-[26px] border border-danger/20 bg-danger/10 p-8 text-center text-danger">
              <b>Algo não saiu como esperado.</b><p className="mt-2">{error}</p>
            </div>
          ) : loading ? <RestaurantGridSkeleton /> : result?.items.length ? (
            <>
              <RestaurantGrid restaurants={result.items} />
              {result.pagination.pages > 1 && (
                <nav className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="min-h-11 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-black disabled:opacity-40">Anterior</button>
                  <span className="text-sm font-semibold text-stone-500">Página {page} de {result.pagination.pages}</span>
                  <button disabled={page === result.pagination.pages} onClick={() => setPage((value) => value + 1)} className="min-h-11 rounded-xl bg-primary px-5 py-3 text-sm font-black text-white disabled:opacity-40">Próxima</button>
                </nav>
              )}
            </>
          ) : (
            <div className="rounded-[26px] border border-dashed border-stone-300 bg-surface p-10 text-center">
              <span className="text-4xl">🏪</span><h3 className="mt-4 text-xl font-black">Nenhum estabelecimento encontrado</h3><p className="mt-2 text-stone-500">Tente outra busca, cidade ou remova algum filtro.</p>
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-border bg-surface px-4 py-8 text-center text-sm text-stone-500"><b className="text-primary">MENU FLOW</b> · Estabelecimentos e produtos em um só lugar.</footer>
    </main>
  );
}
