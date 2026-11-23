import { and, desc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDatabase } from '@/src/server/db';
import { creators, products, sites } from '@/src/server/db/schema';
import { getCreatorIdForSlug } from '@/src/server/workspaces/resolve-slug';
import { getCreatorLogoUrl } from '@/src/server/workspaces/logo';
import { normalizeProductDescription } from '@/lib/product-description.mjs';
import { getCurrentSession } from '@/src/server/auth/permissions';
import BuyerStorefront from './buyer-storefront';

export const revalidate = 300;

export default async function Storefront({ slug, initialCurrency = 'NGN' }: { slug: string; initialCurrency?: 'NGN' | 'USD' }) {
  const db = getDatabase();
  const session = await getCurrentSession();
  const creatorId = await getCreatorIdForSlug(slug);
  const [creator] = creatorId
    ? await db.select().from(creators).where(and(eq(creators.id, creatorId), eq(creators.status, 'active'))).limit(1)
    : [];
  if (!creator) notFound();

  const [site] = await db.select().from(sites).where(and(eq(sites.creatorId, creator.id), eq(sites.status, 'published'))).limit(1);
  const publishedProducts = await db.select().from(products)
    .where(and(eq(products.creatorId, creator.id), eq(products.status, 'published')))
    .orderBy(desc(products.createdAt));

  return <BuyerStorefront
    initialEmail={session?.user?.email ?? ''}
    initialCurrency={initialCurrency}
    isLoggedIn={Boolean(session?.user)}
    creator={{
    slug: creator.slug,
    name: creator.displayName,
    headline: creator.headline,
    bio: creator.bio,
    avatarUrl: getCreatorLogoUrl(creator.avatarKey),
    whatsappE164: creator.whatsappE164,
    socialLinks: (creator.socialLinks as Record<string, string> | null) ?? {},
    storefrontTitle: `${creator.displayName}'s store`,
  }} products={publishedProducts.map((product) => ({
    id: product.id,
    slug: product.slug,
    title: product.title,
    type: product.type,
    description: normalizeProductDescription(product.description),
    coverUrl: getCreatorLogoUrl(product.coverKey),
    priceMinor: product.priceMinor.toString(),
    currency: product.currency,
  }))} />;
}
