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
    <article className="group min-w-0 overflow-hidden rounded-[26px] border border-border bg-surface shadow-[0_8px_30px_rgba(41,37,36,.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(41,37,36,.11)]">
      <Link href={`/${restaurant.slug}`} className="block h-full focus-visible:outline-none">
        <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-primary-hover via-primary to-gold sm:aspect-[5/3]">
          {desktopBanner ? (
            <picture className="block h-full w-full">
              {mobileBanner && <source media="(max-width: 639px)" srcSet={mobileBanner} />}
              <img
                src={desktopBanner}
                alt={`Banner de ${restaurant.tradeName || restaurant.name}`}
                loading="lazy"
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
              />
            </picture>
          ) : (
            <div className="absolute inset-0 grid place-items-center text-6xl font-black text-white/15">MF</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" />
          <span className={`absolute right-3 top-3 rounded-full px-3 py-1.5 text-[11px] font-black shadow-sm ${badge.style}`}>{badge.label}</span>
        </div>

        <div className="relative px-5 pb-5 pt-8 sm:px-6">
          {restaurant.logoUrl ? (
            <span className="absolute -top-8 left-5 h-16 w-16 overflow-hidden rounded-2xl border-[4px] border-surface bg-white shadow-md sm:left-6 sm:h-[68px] sm:w-[68px]">
              <Image src={restaurant.logoUrl} alt={`Logo de ${restaurant.name}`} fill sizes="68px" className="object-cover" />
            </span>
          ) : (
            <span className="absolute -top-8 left-5 grid h-16 w-16 place-items-center rounded-2xl border-[4px] border-surface bg-primary text-xl font-black text-white shadow-md sm:left-6 sm:h-[68px] sm:w-[68px]">
              {restaurant.name.charAt(0)}
            </span>
          )}

          <p className="mt-1 text-[11px] font-black uppercase tracking-[.14em] text-accent">{restaurant.establishmentTypeName ?? legacyEstablishmentLabel(type)}</p>
          <h3 className="mt-1.5 line-clamp-1 text-xl font-black tracking-tight text-stone-900">{restaurant.tradeName || restaurant.name}</h3>
          {restaurant.restaurantCategories?.length ? <p className="mt-1 line-clamp-1 text-sm font-semibold text-stone-500">{restaurant.restaurantCategories.join(' • ')}</p> : null}
          <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-stone-600">{restaurant.description || `Conheça ${isRestaurant ? 'o cardápio' : 'os produtos'} deste estabelecimento.`}</p>

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
            <span className="min-w-0 truncate text-sm font-semibold text-stone-500">{location || 'Localização não informada'}</span>
            <span className="shrink-0 text-sm font-black text-primary">{isRestaurant ? 'Ver cardápio' : 'Ver produtos'} →</span>
          </div>
        </div>
      </Link>
    </article>
  );
}
