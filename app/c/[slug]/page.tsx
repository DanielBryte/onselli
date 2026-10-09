import Storefront from './Storefront';
export default async function CreatorStorefrontPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <Storefront slug={slug} />; }
