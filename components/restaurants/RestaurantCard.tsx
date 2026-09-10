import Image from 'next/image';
import Link from 'next/link';
import { establishmentLabels, type PublicRestaurant } from '../../lib/public-restaurants';

export function RestaurantCard({ restaurant }: { restaurant: PublicRestaurant }) {
  const type = restaurant.establishmentType ?? 'RESTAURANT';
  const isRestaurant = type === 'RESTAURANT';
  const badge = !restaurant.businessHoursConfigured || restaurant.openingStatus?.status === 'UNCONFIGURED'
    ? { label: 'Horário não informado', style: 'bg-surface text-stone-600' }
    : restaurant.canAcceptOrdersNow
      ? { label: 'Aberto agora', style: 'bg-success text-white' }
      : restaurant.openingStatus?.status === 'OPEN' && !restaurant.acceptingOrders
        ? { label: 'Pedidos pausados', style: 'bg-gold text-ink' }
      : { label: 'Fechado', style: 'bg-danger text-white' };

  return <article className="group overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-soft"><Link href={`/${restaurant.slug}`} className="block"><div className="relative h-40 overflow-hidden bg-gradient-to-br from-ink via-primary-hover to-gold">{restaurant.bannerUrl ? <Image src={restaurant.bannerUrl} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 grid place-items-center text-5xl font-black text-white/15">MF</div>}<span className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-xs font-black shadow ${badge.style}`}>{badge.label}</span></div><div className="relative p-5 pb-0 pt-7">{restaurant.logoUrl ? <span className="absolute -top-8 left-5 h-16 w-16 overflow-hidden rounded-2xl border-4 border-white bg-surface shadow"><Image src={restaurant.logoUrl} alt={`Logo de ${restaurant.name}`} fill sizes="64px" className="object-cover" /></span> : <span className="absolute -top-8 left-5 grid h-16 w-16 place-items-center rounded-2xl border-4 border-white bg-lime text-xl font-black text-ink shadow">{restaurant.name.charAt(0)}</span>}<p className="mt-2 text-xs font-black uppercase tracking-wider text-accent">{establishmentLabels[type]}</p><h3 className="mt-1 truncate text-xl font-black text-ink">{restaurant.tradeName || restaurant.name}</h3>{restaurant.restaurantCategories?.length ? <p className="mt-1 truncate text-sm font-semibold text-stone-500">{restaurant.restaurantCategories.join(' • ')}</p> : null}<p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-stone-600">{restaurant.description || `Conheça ${isRestaurant ? 'o cardápio' : 'os produtos'} deste estabelecimento.`}</p><p className="mt-5 text-sm text-stone-500">{[restaurant.city, restaurant.state].filter(Boolean).join(' - ') || 'Localização não informada'}</p></div></Link><footer className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-3 border-t py-4">{restaurant.mapUrl ? <a href={restaurant.mapUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-black text-accent">📍 Como chegar</a> : <span />}<Link href={`/${restaurant.slug}`} className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-black text-ink">{isRestaurant ? 'Ver cardápio' : 'Ver produtos'} →</Link></footer></article>;
}
