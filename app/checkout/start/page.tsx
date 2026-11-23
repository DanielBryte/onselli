import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { ArrowLeft } from 'lucide-react';
import { getCurrentSession } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { creators, products } from '@/src/server/db/schema';
import CheckoutStartForm from './CheckoutStartForm';

export const metadata = { title: 'Checkout' };

export default async function CheckoutStartPage({ searchParams }: { searchParams: Promise<{ productId?: string; amountMinor?: string; cart?: string; email?: string }> }) {
  const query = await searchParams;
  const session = await getCurrentSession();
  const db = getDatabase();
  const initialEmail = query.email?.trim() || session?.user.email || '';
  if (query.cart && /^[a-z0-9-]{1,80}$/i.test(query.cart)) {
    const [creator] = await db.select({ slug: creators.slug, displayName: creators.displayName }).from(creators).where(and(eq(creators.slug, query.cart), eq(creators.status, 'active'))).limit(1);
    if (creator) return <CheckoutStartForm mode="cart" cartSlug={creator.slug} creatorName={creator.displayName} initialName={session?.user.name ?? ''} initialEmail={initialEmail} />;
  }
  if (query.productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(query.productId)) {
    const [row] = await db.select({ product: products, creator: creators }).from(products).innerJoin(creators, eq(products.creatorId, creators.id)).where(and(eq(products.id, query.productId), eq(products.status, 'published'), eq(creators.status, 'active'))).limit(1);
    if (row && ['NGN', 'USD'].includes(row.product.currency)) {
      const amountMinor = row.product.amountType === 'customer_chooses' && /^\d{1,15}$/.test(query.amountMinor ?? '') ? query.amountMinor! : row.product.priceMinor.toString();
      return <CheckoutStartForm mode="single" product={{ id: row.product.id, title: row.product.title, slug: row.product.slug, creatorSlug: row.creator.slug, priceMinor: row.product.priceMinor.toString(), amountMinor, amountType: row.product.amountType, minAmountMinor: row.product.minAmountMinor?.toString() ?? null, currency: row.product.currency }} initialName={session?.user.name ?? ''} initialEmail={initialEmail} />;
    }
  }
  return <main className="checkout-start-page"><section className="checkout-start-card"><p className="checkout-start-kicker">CHECKOUT</p><h1>This checkout isn’t available</h1><p>Return to the creator’s store and choose an available offer.</p><Link className="checkout-start-back" href="/discover"><ArrowLeft size={16} /> Browse offers</Link></section></main>;
}
