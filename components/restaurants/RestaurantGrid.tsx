import type { PublicRestaurant } from '../../lib/public-restaurants';
import { RestaurantCard } from './RestaurantCard';

export function RestaurantGrid({ restaurants }: { restaurants: PublicRestaurant[] }) {
  return <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4">{restaurants.map((restaurant) => <RestaurantCard key={restaurant._id} restaurant={restaurant} />)}</div>;
}

export function RestaurantGridSkeleton() {
  return <div className="grid gap-4 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Carregando restaurantes">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[355px] animate-pulse rounded-[28px] bg-stone-200" />)}</div>;
}
