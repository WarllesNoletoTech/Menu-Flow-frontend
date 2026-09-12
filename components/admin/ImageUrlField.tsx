'use client';

import { useEffect, useState } from 'react';

type ImageType = 'logo' | 'banner' | 'bannerDesktop' | 'bannerMobile';
type Props = { label: string; value: string; onChange: (value: string) => void; type: ImageType; invalid?: boolean };

const config: Record<ImageType, { recommendation: string; help: string; preview: string; className: string }> = {
  logo: {
    recommendation: 'Recomendado: 800 × 800 px (1:1). PNG, JPG ou WebP. Até 2 MB.',
    help: 'Tamanho mínimo sugerido: 400 × 400 px.',
    preview: 'da logo',
    className: 'h-28 w-28 rounded-2xl object-cover',
  },
  banner: {
    recommendation: 'Recomendado: 1600 × 600 px. PNG, JPG ou WebP. Até 5 MB.',
    help: 'Mantenha textos e informações importantes no centro da imagem.',
    preview: 'do banner',
    className: 'aspect-[8/3] max-h-64 w-full rounded-2xl object-cover',
  },
  bannerDesktop: {
    recommendation: 'Computador: recomendado 1600 × 600 px (aprox. 8:3). PNG, JPG ou WebP. Até 5 MB.',
    help: 'Use uma arte horizontal com o conteúdo principal protegido nas áreas centrais.',
    preview: 'do banner para computador',
    className: 'aspect-[8/3] max-h-64 w-full rounded-2xl object-cover',
  },
  bannerMobile: {
    recommendation: 'Celular: recomendado 800 × 1000 px (4:5). PNG, JPG ou WebP. Até 5 MB.',
    help: 'Use uma composição própria para telas estreitas, com textos maiores e bem centralizados.',
    preview: 'do banner para celular',
    className: 'aspect-[4/5] max-h-[420px] w-full max-w-[260px] rounded-[26px] object-cover',
  },
};

export function ImageUrlField({ label, value, onChange, type, invalid }: Props) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  useEffect(() => setStatus('loading'), [value]);
  const meta = config[type];

  return (
    <label className="block min-w-0 font-bold text-stone-800">
      <span className="flex items-center gap-2">
        {label}
        {(type === 'bannerDesktop' || type === 'bannerMobile') && (
          <span className="rounded-full bg-background px-2 py-1 text-[10px] font-black uppercase tracking-wider text-stone-500">
            {type === 'bannerDesktop' ? 'Desktop' : 'Mobile'}
          </span>
        )}
      </span>
      <input
        aria-invalid={invalid || undefined}
        type="url"
        pattern="https://.*"
        placeholder={`https://exemplo.com/${type === 'logo' ? 'logo' : type === 'bannerMobile' ? 'banner-mobile' : 'banner-desktop'}.webp`}
        className="field"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="mt-2 block space-y-1 text-xs font-normal leading-relaxed text-stone-500">
        <span className="block">Use um link público direto para a imagem. Links de páginas intermediárias podem não funcionar.</span>
        <span className="block font-semibold text-stone-600">{meta.recommendation}</span>
        <span className="block">{meta.help}</span>
      </span>
      {value && (
        <span className="mt-3 block rounded-2xl border border-border bg-background/60 p-3" aria-live="polite">
          <span className="mb-2 block text-xs font-normal text-stone-500">Prévia {meta.preview}</span>
          {status !== 'failed' && (
            <span className={type === 'bannerMobile' ? 'flex justify-center' : 'block'}>
              <img
                key={value}
                src={value}
                alt={`Prévia ${meta.preview}`}
                onLoad={() => setStatus('loaded')}
                onError={() => setStatus('failed')}
                className={`border border-border bg-white ${meta.className}`}
              />
            </span>
          )}
          {status === 'loading' && <span className="mt-2 block text-xs font-normal text-stone-500">Carregando imagem…</span>}
          {status === 'loaded' && <span className="mt-2 block text-xs font-bold text-success">✓ Imagem carregada</span>}
          {status === 'failed' && <span className="block rounded-xl bg-danger/10 p-3 text-xs font-normal text-danger">Não foi possível carregar essa imagem. Verifique se o link é público, HTTPS e aponta diretamente para um arquivo de imagem.</span>}
        </span>
      )}
    </label>
  );
}
