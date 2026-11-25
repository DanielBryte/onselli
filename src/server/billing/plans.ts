export type PlanId = 'free' | 'pro' | 'studio';
export type BillingCurrency = 'NGN' | 'USD';
export type BillingInterval = 'month' | 'year';
// Bachs currently supports USD for recurring subscription checkout.
export const SUBSCRIPTION_CURRENCY: BillingCurrency = 'USD';

export const PLAN_CATALOG = {
  free: {
    id: 'free', name: 'Free', tagline: 'For getting your first offer online', monthly: { NGN: 0, USD: 0 }, yearly: { NGN: 0, USD: 0 }, maxWorkspaces: 1, maxPublishedOffers: 5, maxContacts: 500, maxRecipientsPerSend: 0, analyticsDays: 30, prioritySupport: false, platformFeeBps: 750,
  },
  pro: {
    id: 'pro', name: 'Pro', tagline: 'For creators building a steady business', monthly: { NGN: 950000, USD: 900 }, yearly: { NGN: 9500000, USD: 9000 }, maxWorkspaces: 3, maxPublishedOffers: null, maxContacts: 10000, maxRecipientsPerSend: 5000, analyticsDays: 90, prioritySupport: false, platformFeeBps: 500,
  },
  studio: {
    id: 'studio', name: 'Business', tagline: 'For teams managing multiple brands', monthly: { NGN: 2450000, USD: 2400 }, yearly: { NGN: 24500000, USD: 24000 }, maxWorkspaces: 10, maxPublishedOffers: null, maxContacts: 50000, maxRecipientsPerSend: 5000, analyticsDays: 90, prioritySupport: true, platformFeeBps: 300,
  },
} as const;

export const BILLING_CURRENCIES: { code: BillingCurrency; locale: string; label: string }[] = [
  { code: 'NGN', locale: 'en-NG', label: 'NGN' },
  { code: 'USD', locale: 'en-US', label: 'USD' },
];

export function formatPlanPrice(minor: number, currency: BillingCurrency) {
  return new Intl.NumberFormat(BILLING_CURRENCIES.find((item) => item.code === currency)?.locale ?? 'en', {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(minor / 100);
}
