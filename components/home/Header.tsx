'use client';

import Link from 'next/link';
import type { City } from '../../lib/public-restaurants';
import { UserMenu } from '../auth/UserMenu';
import { BrandLogo } from '../BrandLogo';
import { CitySelector } from './CitySelector';
import { SearchBar } from './SearchBar';

export function Header(props: { cities: City[]; city: string; onCityChange: (value: string) => void; search: string; onSearchChange: (value: string) => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
            <BrandLogo variant="wordmark" priority className="w-[clamp(8.5rem,22vw,12rem)] rounded-lg" />
          </Link>
          <UserMenu />
        </div>
        <div className="mt-3 grid gap-2.5 md:grid-cols-[minmax(220px,.62fr)_1.38fr] md:gap-3 sm:mt-4">
          <CitySelector cities={props.cities} value={props.city} onChange={props.onCityChange} />
          <SearchBar value={props.search} onChange={props.onSearchChange} />
        </div>
      </div>
    </header>
  );
}
