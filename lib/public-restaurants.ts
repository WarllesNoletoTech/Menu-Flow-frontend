export type City = { city: string; state: string; restaurants: number };
export type PublicRestaurant = {
  _id: string; name: string; slug: string; tradeName?: string; city?: string; state?: string;
  logoUrl?: string; bannerUrl?: string; description?: string; restaurantCategories?: string[]; open: boolean;
};
export type RestaurantPage = { items: PublicRestaurant[]; pagination: { page: number; limit: number; total: number; pages: number } };
