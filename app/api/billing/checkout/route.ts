import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { AuthorizationError, requireBuyer } from '@/src/server/auth/permissions';
import { getEnv } from '@/src/server/config/env';
import { getDatabase } from '@/src/server/db';
import { billingTransactions } from '@/src/server/db/schema';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import { PLAN_CATALOG, SUBSCRIPTION_CURRENCY, type BillingInterval, type PlanId } from '@/src/server/billing/plans';
import { createBachsSubscriptionCheckout } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const session = await requireBuyer();
    const env = getEnv();
    if (env.SUBSCRIPTIONS_ENABLED !== 'true') return NextResponse.json({ error: 'Subscriptions are currently in preview mode.' }, { status: 403 });
    if (!env.BACHS_API_KEY) return NextResponse.json({ error: 'Subscription checkout is not configured yet.' }, { status: 503 });
    const body = await request.json().catch(() => null) as { planId?: unknown; currency?: unknown; billingInterval?: unknown } | null;
    const planId = body?.planId;
    if (planId !== 'pro' && planId !== 'studio') {
      return NextResponse.json({ error: 'Choose a valid subscription plan.' }, { status: 400 });
    }
    const billingInterval = body?.billingInterval ?? 'month';
    if (billingInterval !== 'month' && billingInterval !== 'year') {
      return NextResponse.json({ error: 'Choose monthly or yearly billing.' }, { status: 400 });
    }
    if (body?.currency !== undefined && body.currency !== SUBSCRIPTION_CURRENCY) {
      return NextResponse.json({ error: 'Bachs recurring subscriptions are billed in USD.' }, { status: 409 });
    }
    const currentEntitlements = await getAccountEntitlements(session.user.id);
    if (currentEntitlements.planId !== 'free') return NextResponse.json({ error: 'You already have a subscription. Manage plan changes from your billing portal.' }, { status: 409 });
    const productId = planId === 'pro'
      ? billingInterval === 'year' ? env.BACHS_PLAN_PRO_USD_YEARLY_PRODUCT_ID : env.BACHS_PLAN_PRO_USD_PRODUCT_ID
      : billingInterval === 'year' ? env.BACHS_PLAN_STUDIO_USD_YEARLY_PRODUCT_ID : env.BACHS_PLAN_STUDIO_USD_PRODUCT_ID;
    if (!productId) return NextResponse.json({ error: `The ${billingInterval === 'year' ? 'yearly' : 'monthly'} Bachs subscription product for this plan is not configured yet.` }, { status: 503 });

    const plan = PLAN_CATALOG[planId as PlanId];
    const amountMinor = plan[billingInterval === 'month' ? 'monthly' : 'yearly'][SUBSCRIPTION_CURRENCY];
    const reference = `onselli-${crypto.randomUUID().replaceAll('-', '')}`;
    await getDatabase().insert(billingTransactions).values({ reference, userId: session.user.id, planId, billingInterval, currency: SUBSCRIPTION_CURRENCY, amountMinor: BigInt(amountMinor), status: 'pending' });
    const appUrl = new URL(env.NEXT_PUBLIC_APP_URL);
    const hostIsPrivate = appUrl.hostname === 'localhost' || appUrl.hostname.endsWith('.local') || appUrl.hostname.endsWith('.test') || /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(appUrl.hostname);
    const canReturnToApp = appUrl.protocol === 'https:' && !hostIsPrivate;
    const successUrl = canReturnToApp ? new URL(`/workspace/billing?reference=${encodeURIComponent(reference)}`, appUrl).toString() : undefined;
    const cancelUrl = canReturnToApp ? new URL('/workspace', appUrl).toString() : undefined;
    try {
      const checkout = await createBachsSubscriptionCheckout({
        productId, email: session.user.email, name: session.user.name ?? undefined,
        userId: session.user.id, planId, billingInterval, reference,
        successUrl,
        cancelUrl,
      });
      await getDatabase().update(billingTransactions).set({ providerTransactionId: checkout.checkoutId, updatedAt: new Date() }).where(eq(billingTransactions.reference, reference));
      return NextResponse.json({ checkoutUrl: checkout.checkoutUrl }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      await getDatabase().update(billingTransactions).set({ status: 'failed', updatedAt: new Date() }).where(eq(billingTransactions.reference, reference));
      console.error('Bachs subscription checkout initialization failed', error);
      return NextResponse.json({ error: error instanceof Error ? error.message : 'The payment provider could not open checkout.' }, { status: 502 });
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Billing checkout initialization failed', error);
    return NextResponse.json({ error: 'We couldn’t open secure checkout. Please try again.' }, { status: 503 });
  }
}
