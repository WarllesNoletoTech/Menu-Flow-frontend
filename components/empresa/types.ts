export type Establishment = { _id: string; name: string; tradeName?: string; slug: string; cnpj?: string; email?: string; phone?: string; whatsapp?: string; instagram?: string; address?: string; state?: string; city?: string; description?: string; logoUrl?: string; bannerUrl?: string; establishmentType: string; open: boolean };
export type Settings = { minimumOrder: number; preparationMinutes?: number; rappidexEnabled: boolean };
export type Category = { _id: string; name: string; order: number; active: boolean };
export type Product = { _id: string; categoryId: string | { _id: string }; name: string; description?: string; imageUrl?: string; price: number; promotionalPrice?: number; available: boolean; featured: boolean; order: number; addonGroups?: Array<{ name: string; required?: boolean; min?: number; max?: number; addons: Array<{ name: string; price: number }> }> };
export type Employee = { id: string; name: string; email: string; phone?: string; active: boolean };
