import { Menu } from '../../components/menu';
export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <Menu slug={slug} />; }
