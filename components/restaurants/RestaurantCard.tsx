import Image from 'next/image';
import Link from 'next/link';
import type { PublicRestaurant } from '../../lib/public-restaurants';
import { legacyEstablishmentLabel } from '../../lib/public-restaurants';

export function RestaurantCard({ restaurant }: { restaurant: PublicRestaurant }) {
  const type = restaurant.establishmentType;
  const isRestaurant = type === 'RESTAURANT';
  const badge = restaurant.isOpenNow
    ? { label: 'Aberto agora', style: 'bg-success text-white' }
    : restaurant.businessHoursConfigured
      ? { label: 'Fechado', style: 'bg-white/95 text-stone-700' }
      : { label: 'Horário não informado', style: 'bg-white/95 text-stone-700' };
  const desktopBanner = restaurant.bannerDesktopUrl || restaurant.bannerUrl;
  const mobileBanner = restaurant.bannerMobileUrl || desktopBanner;
  const location = [restaurant.city, restaurant.state].filter(Boolean).join(' - ');

  return (
    <article className="group min-w-0 overflow-hidden rounded-[28px] border border-border/90 bg-white shadow-[0_14px_36px_rgba(41,37,36,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_52px_rgba(41,37,36,.12)]">
      <Link href={`/${restaurant.slug}`} className="block h-full focus-visible:outline-none">
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-primary-hover via-primary to-accent sm:aspect-[16/9]">
          {desktopBanner ? (
            <picture className="block h-full w-full">
              {mobileBanner && <source media="(max-width: 639px)" srcSet={mobileBanner} />}
              <img
                src={desktopBanner}
                alt={`Banner de ${restaurant.tradeName || restaurant.name}`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.045]"
              />
            </picture>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-6xl font-black text-white/15">MF</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent" />
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
            <span className="inline-flex max-w-[70%] items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50/95 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.18em] text-emerald-800 backdrop-blur-sm">
              {restaurant.establishmentTypeName ?? legacyEstablishmentLabel(type)}
            </span>
            <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black shadow-sm ${badge.style}`}>{badge.label}</span>
          </div>
        </div>

        <div className="relative px-5 pb-5 pt-9 sm:px-6 sm:pb-6">
          {restaurant.logoUrl ? (
            <span className="absolute -top-9 left-5 h-[74px] w-[74px] overflow-hidden rounded-[22px] border-[5px] border-white bg-white shadow-[0_12px_28px_rgba(41,37,36,.12)] sm:left-6">
              <Image src={restaurant.logoUrl} alt={`Logo de ${restaurant.name}`} fill sizes="74px" className="object-cover" />
            </span>
          ) : (
            <span className="absolute -top-9 left-5 grid h-[74px] w-[74px] place-items-center rounded-[22px] border-[5px] border-white bg-primary text-2xl font-black text-white shadow-[0_12px_28px_rgba(41,37,36,.12)] sm:left-6">
              {restaurant.name.charAt(0)}
            </span>
          )}

          <div className="flex min-h-[168px] flex-col">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[.14em] text-accent">{restaurant.restaurantCategories?.length ? restaurant.restaurantCategories.slice(0, 2).join(' • ') : 'Destaque local'}</p>
              <h3 className="mt-2 line-clamp-1 text-[22px] font-black tracking-tight text-stone-900">{restaurant.tradeName || restaurant.name}</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-6 text-stone-600">{restaurant.description || `Conheça ${isRestaurant ? 'o cardápio' : 'os produtos'} deste estabelecimento.`}</p>
            </div>

            <div className="mt-auto pt-5">
              <div className="rounded-[22px] border border-border/80 bg-background/55 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-stone-500">{location || 'Localização não informada'}</span>
                  <span className="shrink-0 text-sm font-black text-primary">{isRestaurant ? 'Ver cardápio' : 'Ver produtos'} →</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
