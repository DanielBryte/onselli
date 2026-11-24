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
  return <main className="min-h-[calc(100vh-72px)] bg-[#f6f7f5] px-6 pb-[88px] pt-10 text-[#17221d] max-[700px]:px-4 max-[700px]:pb-14 max-[700px]:pt-6"><section className="rounded-2xl border border-[#dfe5e0] bg-white p-8 shadow-[0_1px_2px_rgba(16,24,20,.03)] max-[700px]:px-5 max-[700px]:py-6"><p className="mb-2.5 mt-0 text-[11px] font-bold tracking-[.11em] text-[#647168]">CHECKOUT</p><h1 className="m-0 text-[clamp(26px,3vw,34px)] font-semibold leading-[1.15] tracking-[-.04em]">This checkout isn’t available</h1><p className="mb-6 mt-[11px] text-sm leading-[1.6] text-[#647168]">Return to the creator’s store and choose an available offer.</p><Link className="inline-flex items-center gap-2 text-sm font-semibold text-[#34423a] transition-colors hover:text-[#00543d]" href="/discover"><ArrowLeft size={16} /> Browse offers</Link></section></main>;
}
