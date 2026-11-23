import 'server-only';
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { getDatabase } from '@/src/server/db';
import { userSubscriptions } from '@/src/server/db/schema';
import { PLAN_CATALOG, type PlanId } from './plans';
import { getEnv } from '@/src/server/config/env';

export async function getAccountEntitlements(userId: string) {
  if (getEnv().SUBSCRIPTIONS_ENABLED !== 'true') {
    return { planId: 'free' as PlanId, maxWorkspaces: Number.POSITIVE_INFINITY, maxPublishedOffers: null, maxContacts: Number.POSITIVE_INFINITY, maxRecipientsPerSend: Number.POSITIVE_INFINITY, platformFeeBps: null, enabledFeatures: new Set(['email_campaigns', 'analytics_90d', 'unlimited_products']), billingEnabled: false };
  }
  const now = new Date();
  const [subscription] = await getDatabase().select().from(userSubscriptions).where(and(
    eq(userSubscriptions.userId, userId),
    inArray(userSubscriptions.status, ['active', 'trialing', 'past_due']),
    or(isNull(userSubscriptions.currentPeriodEnd), gt(userSubscriptions.currentPeriodEnd, now)),
  )).limit(1);
  const planId = (subscription?.planId === 'pro' || subscription?.planId === 'studio' ? subscription.planId : 'free') as PlanId;
  const features = new Set<string>();
  if (planId !== 'free') { features.add('email_campaigns'); features.add('analytics_90d'); features.add('unlimited_products'); }
  const plan = PLAN_CATALOG[planId];
  return { planId, maxWorkspaces: plan.maxWorkspaces, maxPublishedOffers: plan.maxPublishedOffers, maxContacts: plan.maxContacts, maxRecipientsPerSend: plan.maxRecipientsPerSend, platformFeeBps: plan.platformFeeBps, enabledFeatures: features, billingEnabled: true };
}

export async function hasAccountFeature(userId: string, feature: string) {
  const entitlements = await getAccountEntitlements(userId);
  return !entitlements.billingEnabled || entitlements.enabledFeatures.has(feature);
}
