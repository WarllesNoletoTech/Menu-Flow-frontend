export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className="relative block"><span className="sr-only">Buscar restaurantes</span><span className="pointer-events-none absolute left-4 top-3 text-lg" aria-hidden>⌕</span><input type="search" className="h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-4 text-sm outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-lime" placeholder="Buscar restaurantes ou culinárias" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
