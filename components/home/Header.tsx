'use client';

import Link from 'next/link';
import type { City } from '../../lib/public-restaurants';
import { UserMenu } from '../auth/UserMenu';
import { BrandLogo } from '../BrandLogo';
import { CitySelector } from './CitySelector';
import { SearchBar } from './SearchBar';

export function Header(props: { cities: City[]; city: string; onCityChange: (value: string) => void; search: string; onSearchChange: (value: string) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-2xl">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
        <div className="mf-panel overflow-hidden rounded-[28px] px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <Link href="/" className="flex min-w-0 items-center gap-3 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <div className="min-w-0">
                  <BrandLogo variant="wordmark" priority className="w-[clamp(10rem,22vw,13rem)] rounded-lg" />
                  <p className="mt-1 hidden text-xs font-semibold text-stone-500 sm:block">Descubra cardápios, pedidos online e lojas perto de você.</p>
                </div>
              </Link>
              <div className="lg:hidden">
                <UserMenu />
              </div>
            </div>

            <div className="hidden lg:block">
              <UserMenu />
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)] lg:items-center">
            <CitySelector cities={props.cities} value={props.city} onChange={props.onCityChange} />
            <SearchBar value={props.search} onChange={props.onSearchChange} />
          </div>
        </div>
      </div>
    </header>
  );
}
