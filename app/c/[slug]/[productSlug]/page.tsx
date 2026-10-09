import PublicProductPage from './ProductPage';
export default async function CreatorProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) { const { slug, productSlug } = await params; return <PublicProductPage creatorSlug={slug} productSlug={productSlug} />; }
