import { redirect } from 'next/navigation';

export default async function LegacyRestaurantLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/cliente/login?returnTo=${encodeURIComponent(`/${slug}`)}`);
}
