'use client';

import { useEffect, useState } from 'react';

type Props = { label: string; value: string; onChange: (value: string) => void; type: 'logo' | 'banner'; invalid?: boolean };

export function ImageUrlField({ label, value, onChange, type, invalid }: Props) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  useEffect(() => setStatus('loading'), [value]);
  const logo = type === 'logo';
  return <label className="font-bold">
    {label}
    <input aria-invalid={invalid || undefined} type="url" pattern="https://.*" placeholder={`https://exemplo.com/${logo ? 'logo' : 'banner'}.webp`} className="field" value={value} onChange={(event) => onChange(event.target.value)} />
    <span className="mt-1 block space-y-1 text-xs font-normal leading-relaxed text-stone-500">
      <span className="block">Use um link público direto para a imagem. Links para páginas intermediárias podem não funcionar.</span>
      <span className="block">{logo ? 'Recomendado: 800 × 800 px (1:1). PNG, JPG ou WebP. Até 2 MB.' : 'Recomendado: 1600 × 900 px (16:9). PNG, JPG ou WebP. Até 5 MB.'}</span>
      <span className="block">{logo ? 'Tamanho mínimo sugerido: 400 × 400 px.' : 'Mantenha textos e informações importantes no centro da imagem.'}</span>
    </span>
    {value && <span className="mt-2 block" aria-live="polite">
      <span className="mb-1 block text-xs font-normal text-stone-500">Prévia {logo ? 'da logo' : 'do banner'}</span>
      {status !== 'failed' && <img key={value} src={value} alt={`Prévia ${logo ? 'da logo' : 'do banner'}`} onLoad={() => setStatus('loaded')} onError={() => setStatus('failed')} className={`rounded-xl border object-cover ${logo ? 'h-20 w-20' : 'h-24 w-full'}`} />}
      {status === 'loading' && <span className="block text-xs font-normal text-stone-500">Carregando imagem…</span>}
      {status === 'loaded' && <span className="block text-xs font-bold text-green-700">✓ Imagem carregada</span>}
      {status === 'failed' && <span className="block rounded-lg bg-red-50 p-2 text-xs font-normal text-red-700">Não foi possível carregar essa imagem. Verifique se o link é público e aponta diretamente para uma imagem.</span>}
    </span>}
  </label>;
}
