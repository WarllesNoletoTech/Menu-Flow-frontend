import type { Metadata } from 'next';
import { Menu } from '../../components/menu';
import { apiUrl } from '../../lib/api';

type RestaurantMetadata = {
  name: string;
  tradeName?: string;
  description?: string;
  logoUrl?: string;
  city?: string;
  state?: string;
};

async function getRestaurant(slug: string): Promise<RestaurantMetadata | null> {
  try {
    const response = await fetch(apiUrl(`/restaurants/${encodeURIComponent(slug)}`), {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;
    return await response.json() as RestaurantMetadata;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const restaurant = await getRestaurant(slug);

  if (!restaurant) {
    return {
      title: 'Cardápio',
      description: 'Cardápio online',
    };
  }

  const storeName = restaurant.tradeName?.trim() || restaurant.name.trim();
  const location = [restaurant.city, restaurant.state].filter(Boolean).join(' - ');
  const description = restaurant.description?.trim()
    || `Confira o cardápio de ${storeName}${location ? ` em ${location}` : ''} e faça seu pedido online.`;
  const logoUrl = restaurant.logoUrl?.trim();
  const images = logoUrl
    ? [{ url: logoUrl, alt: `Logo de ${storeName}` }]
    : undefined;

  return {
    title: storeName,
    description,
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      title: storeName,
      description,
      siteName: storeName,
      images,
    },
    twitter: {
      card: logoUrl ? 'summary' : 'summary_large_image',
      title: storeName,
      description,
      images: logoUrl ? [logoUrl] : undefined,
    },
  };
}

export default async function RestaurantPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <Menu slug={slug} />;
}
