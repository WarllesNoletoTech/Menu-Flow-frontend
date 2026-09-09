import type { PublicRestaurant } from '../../lib/public-restaurants';
import { RestaurantCard } from './RestaurantCard';
export function RestaurantGrid({ restaurants }: { restaurants: PublicRestaurant[] }) { return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{restaurants.map((restaurant) => <RestaurantCard key={restaurant._id} restaurant={restaurant} />)}</div>; }
export function RestaurantGridSkeleton() { return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Carregando restaurantes">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-80 animate-pulse rounded-3xl bg-stone-200" />)}</div>; }
