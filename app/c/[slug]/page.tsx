import Storefront from './Storefront';
export default async function CreatorStorefrontPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ currency?: string }> }) { const { slug } = await params; const { currency } = await searchParams; return <Storefront slug={slug} initialCurrency={currency === 'USD' ? 'USD' : 'NGN'} />; }
