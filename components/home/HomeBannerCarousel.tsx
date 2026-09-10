'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRef } from 'react';
export type PublicHomeBanner = { id: string; title?: string; description?: string; desktopImageUrl: string; mobileImageUrl: string; targetUrl?: string | null };
export function HomeBannerCarousel({ banners }: { banners: PublicHomeBanner[] }) {
  const [current, setCurrent] = useState(0); const [paused, setPaused] = useState(false);
  const pointerStart = useRef<{ x: number; y: number } | undefined>(undefined);
  useEffect(() => { if (current >= banners.length) setCurrent(0); }, [banners.length, current]);
  useEffect(() => { if (paused || banners.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; const timer = window.setInterval(() => setCurrent(value => (value + 1) % banners.length), 5000); return () => window.clearInterval(timer); }, [banners.length, paused]);
  if (!banners.length) return null;
  const banner = banners[current]; const picture = <picture className="block h-full w-full"><source media="(max-width: 767px)" srcSet={banner.mobileImageUrl}/><img src={banner.desktopImageUrl} alt={banner.title || 'Banner promocional Menu Flow'} draggable={false} className="h-full w-full object-cover"/></picture>;
  const move = (direction: number) => { setPaused(true); setCurrent(value => (value + direction + banners.length) % banners.length); };
  const linkEvents = {
    onPointerDown: (event: React.PointerEvent) => { pointerStart.current = { x: event.clientX, y: event.clientY }; },
    onClick: (event: React.MouseEvent) => { const start = pointerStart.current; pointerStart.current = undefined; if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) event.preventDefault(); },
  };
  const campaign = banner.targetUrl ? (banner.targetUrl.startsWith('/')
    ? <Link href={banner.targetUrl} aria-label={banner.title || 'Abrir campanha'} className="block h-full w-full cursor-pointer" {...linkEvents}>{picture}</Link>
    : <a href={banner.targetUrl} target="_blank" rel="noopener noreferrer" aria-label={banner.title || 'Abrir campanha'} className="block h-full w-full cursor-pointer" {...linkEvents}>{picture}</a>) : picture;
  return <section aria-label="Campanhas em destaque" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} className="mx-auto max-w-7xl px-4 pt-6 sm:px-6"><div className="relative overflow-hidden rounded-3xl bg-stone-200 shadow-sm aspect-[4/5] md:aspect-[3/1]">{campaign}{banners.length > 1 && <><button type="button" aria-label="Banner anterior" onClick={() => move(-1)} className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink/75 text-xl font-black text-white">‹</button><button type="button" aria-label="Próximo banner" onClick={() => move(1)} className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-ink/75 text-xl font-black text-white">›</button><div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">{banners.map((item,index)=><button key={item.id} type="button" aria-label={`Exibir banner ${index+1}`} aria-current={index===current} onClick={()=>{setPaused(true);setCurrent(index)}} className={`h-2.5 rounded-full shadow ${index===current?'w-7 bg-lime':'w-2.5 bg-white'}`}/>)}</div></>}</div></section>;
}
