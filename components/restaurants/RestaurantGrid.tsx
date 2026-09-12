import type { PublicRestaurant } from '../../lib/public-restaurants';
import { RestaurantCard } from './RestaurantCard';

export function RestaurantGrid({ restaurants }: { restaurants: PublicRestaurant[] }) {
  return <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4">{restaurants.map((restaurant) => <RestaurantCard key={restaurant._id} restaurant={restaurant} />)}</div>;
}

export function RestaurantGridSkeleton() {
  return <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4" aria-label="Carregando restaurantes">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-[340px] animate-pulse rounded-[26px] bg-stone-200" />)}</div>;
}
