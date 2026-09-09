type BrandLogoProps = {
  variant?: 'full' | 'symbol';
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ variant = 'full', className = '', priority = false }: BrandLogoProps) {
  const symbol = variant === 'symbol';
  return <span
    aria-label={symbol ? 'Menu Flow' : 'Menu Flow — Cardápios mais simples, clientes mais felizes'}
    data-priority={priority || undefined}
    className={`inline-flex max-w-full items-center gap-2 rounded-xl bg-surface px-2 py-2 ${className}`}
  >
    <span aria-hidden className="grid aspect-square w-11 shrink-0 place-items-center rounded-xl bg-primary font-black text-white shadow-sm">MF</span>
    {!symbol && <span className="min-w-0 leading-none">
      <strong className="block whitespace-nowrap font-serif text-xl font-bold tracking-tight text-primary">Menu Flow</strong>
      <small className="mt-1 block whitespace-nowrap text-[.42rem] font-bold uppercase tracking-[.12em] text-text-secondary">Cardápios mais simples&nbsp; Clientes mais felizes</small>
    </span>}
  </span>;
}
