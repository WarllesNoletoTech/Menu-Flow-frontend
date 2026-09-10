export type EstablishmentType = 'RESTAURANT' | 'PHARMACY' | 'CLOTHING' | 'OTHER';
export type City = { city: string; state: string; count: number; restaurants?: number };
export type PublicRestaurant = { _id: string; name: string; slug: string; tradeName?: string; city?: string; state?: string; logoUrl?: string; bannerUrl?: string; description?: string; establishmentType: EstablishmentType; restaurantCategories?: string[]; businessHoursConfigured: boolean; isOpenNow: boolean };
export type RestaurantPage = { items: PublicRestaurant[]; pagination: { page: number; limit: number; total: number; pages: number } };
export const establishmentLabels: Record<EstablishmentType, string> = { RESTAURANT: 'Restaurante', PHARMACY: 'Farmácia', CLOTHING: 'Loja de roupas', OTHER: 'Loja' };
