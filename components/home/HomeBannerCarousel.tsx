'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export type PublicHomeBanner = { id: string; title?: string; description?: string; desktopImageUrl: string; mobileImageUrl: string; targetUrl?: string | null };

export function HomeBannerCarousel({ banners }: { banners: PublicHomeBanner[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => { if (current >= banners.length) setCurrent(0); }, [banners.length, current]);
  useEffect(() => {
    if (paused || banners.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => setCurrent((value) => (value + 1) % banners.length), 5000);
    return () => window.clearInterval(timer);
  }, [banners.length, paused]);

  if (!banners.length) return null;
  const banner = banners[current];
  const picture = (
    <picture className="block h-full w-full">
      <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl || banner.desktopImageUrl} />
      <img src={banner.desktopImageUrl} alt={banner.title || 'Banner promocional Menu Flow'} draggable={false} className="h-full w-full object-cover" />
    </picture>
  );
  const move = (direction: number) => { setPaused(true); setCurrent((value) => (value + direction + banners.length) % banners.length); };
  const linkEvents = { onClick: () => setPaused(true) };
  const campaign = banner.targetUrl
    ? banner.targetUrl.startsWith('/')
      ? <Link href={banner.targetUrl} aria-label={banner.title || 'Abrir campanha'} className="block h-full w-full cursor-pointer" {...linkEvents}>{picture}</Link>
      : <a href={banner.targetUrl} target="_blank" rel="noopener noreferrer" aria-label={banner.title || 'Abrir campanha'} className="block h-full w-full cursor-pointer" {...linkEvents}>{picture}</a>
    : picture;

  return (
    <section aria-label="Campanhas em destaque" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="relative overflow-hidden rounded-[28px] border border-border/90 bg-stone-200 shadow-[0_18px_50px_rgba(41,37,36,.10)] aspect-[5/6] sm:rounded-[32px] md:aspect-[16/6] lg:aspect-[16/5]">
        {campaign}
        {banners.length > 1 && <>
          <button type="button" aria-label="Banner anterior" onClick={() => move(-1)} className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-xl font-black text-white backdrop-blur hover:bg-black/60 sm:left-4 sm:h-11 sm:w-11">‹</button>
          <button type="button" aria-label="Próximo banner" onClick={() => move(1)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/45 text-xl font-black text-white backdrop-blur hover:bg-black/60 sm:right-4 sm:h-11 sm:w-11">›</button>
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/20 px-2.5 py-2 backdrop-blur-sm sm:bottom-4">
            {banners.map((item, index) => <button key={item.id} type="button" aria-label={`Exibir banner ${index + 1}`} aria-current={index === current} onClick={() => { setPaused(true); setCurrent(index); }} className={`h-2 rounded-full shadow transition-all ${index === current ? 'w-6 bg-white' : 'w-2 bg-white/60'}`} />)}
          </div>
        </>}
      </div>
    </section>
  );
}
