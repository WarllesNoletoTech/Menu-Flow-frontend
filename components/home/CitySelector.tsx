import type { City } from '../../lib/public-restaurants';

export function CitySelector({ cities, value, onChange }: { cities: City[]; value: string; onChange: (value: string) => void }) {
  return <label className="relative block"><span className="sr-only">Cidade</span><select aria-label="Selecionar cidade" className="h-12 w-full appearance-none rounded-2xl border border-border bg-surface px-4 pr-10 text-sm font-bold text-ink outline-none focus:ring-2 focus:ring-lime" value={value} onChange={(event) => onChange(event.target.value)}><option value="">Todas as cidades</option>{cities.map((city) => <option key={`${city.city}-${city.state}`} value={`${city.city}|${city.state}`}>{city.city} - {city.state} ({city.count})</option>)}</select><span className="pointer-events-none absolute right-4 top-3 text-stone-500">⌄</span></label>;
}
