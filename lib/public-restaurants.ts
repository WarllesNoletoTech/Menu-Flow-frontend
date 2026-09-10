export type EstablishmentType = 'RESTAURANT' | 'PHARMACY' | 'CLOTHING' | 'OTHER';
export type City = { city: string; state: string; count: number; restaurants?: number };
export type OpeningStatus = { status: 'OPEN' | 'CLOSED' | 'UNCONFIGURED'; isOpen: boolean | null };
export type PublicRestaurant = { _id: string; name: string; slug: string; tradeName?: string; city?: string; state?: string; address?: string; mapUrl?: string; logoUrl?: string; bannerUrl?: string; description?: string; establishmentType: EstablishmentType; restaurantCategories?: string[]; businessHoursConfigured: boolean; isOpenNow: boolean; canAcceptOrdersNow: boolean; acceptingOrders: boolean; openingStatus: OpeningStatus };
export type RestaurantPage = { items: PublicRestaurant[]; pagination: { page: number; limit: number; total: number; pages: number } };
export const establishmentLabels: Record<EstablishmentType, string> = { RESTAURANT: 'Restaurante', PHARMACY: 'Farmácia', CLOTHING: 'Loja de roupas', OTHER: 'Loja' };
