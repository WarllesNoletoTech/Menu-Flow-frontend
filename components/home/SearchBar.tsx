export function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block">
      <span className="sr-only">Buscar estabelecimentos</span>
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-stone-400" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        className="h-12 w-full rounded-2xl border border-border bg-white/95 pl-11 pr-4 text-sm font-medium text-stone-700 shadow-sm outline-none placeholder:text-stone-400 focus:border-primary/40 focus:ring-4 focus:ring-primary/10 sm:h-13"
        placeholder="Buscar lojas, restaurantes ou produtos"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
