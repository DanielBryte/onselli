'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  Check,
  ChartNoAxesCombined,
  ChevronDown,
  Database,
  FileText,
  Layers3,
  Mail,
  Rocket,
  Store,
  UsersRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  formatPlanPrice,
  PLAN_CATALOG,
  SUBSCRIPTION_CURRENCY,
  type BillingInterval,
  type PlanId,
} from '@/src/server/billing/plans';

type PricingPlan = (typeof PLAN_CATALOG)[PlanId];
type MarketingFeature = { text: string; emphasis?: string; included?: boolean };
type MarketingSection = { title: string; icon: LucideIcon; features: MarketingFeature[] };

// Shared plan feature copy for the public page and dashboard plan picker.
const PLAN_FEATURE_COPY: Record<PlanId, MarketingSection[]> = {
  free: [
    {
      title: 'Storefronts & offers',
      icon: Store,
      features: [
        { text: '1 workspace', emphasis: '1' },
        { text: '1 storefront', emphasis: '1' },
        { text: 'Unlimited published offers', emphasis: 'Unlimited' },
      ],
    },
    {
      title: 'Forms',
      icon: FileText,
      features: [
        { text: '3 forms', emphasis: '3' },
        { text: '500 form submissions per month', emphasis: '500' },
      ],
    },
    {
      title: 'Audience & email',
      icon: Mail,
      features: [
        { text: '500 active contacts', emphasis: '500' },
        { text: '1,000 emails included per month', emphasis: '1,000' },
        { text: 'Up to 500 recipients per campaign', emphasis: '500' },
      ],
    },
    {
      title: 'Storage & domain',
      icon: Database,
      features: [
        { text: '1 GB storage', emphasis: '1 GB' },
        { text: 'Connect your own domain' },
        { text: 'Remove Onselli branding', included: false },
      ],
    },
    {
      title: 'Insights & fees',
      icon: ChartNoAxesCombined,
      features: [
        { text: '30-day sales analytics', emphasis: '30-day' },
        { text: '5% Onselli fee on each sale', emphasis: '5%' },
      ],
    },
  ],
  pro: [
    {
      title: 'Storefronts & offers',
      icon: Store,
      features: [
        { text: '3 workspaces', emphasis: '3' },
        { text: '3 storefronts', emphasis: '3' },
        { text: 'Unlimited published offers', emphasis: 'Unlimited' },
      ],
    },
    {
      title: 'Forms',
      icon: FileText,
      features: [
        { text: 'Unlimited forms', emphasis: 'Unlimited' },
        { text: '10,000 form submissions per month', emphasis: '10,000' },
      ],
    },
    {
      title: 'Audience & email',
      icon: Mail,
      features: [
        { text: '10,000 active contacts', emphasis: '10,000' },
        { text: '10,000 emails included per month', emphasis: '10,000' },
        { text: 'Up to 5,000 recipients per campaign', emphasis: '5,000' },
      ],
    },
    {
      title: 'Storage & domain',
      icon: Database,
      features: [
        { text: '25 GB storage', emphasis: '25 GB' },
        { text: 'Connect your own domain' },
        { text: 'Remove Onselli branding' },
      ],
    },
    {
      title: 'Insights & fees',
      icon: ChartNoAxesCombined,
      features: [
        { text: '90-day sales analytics', emphasis: '90-day' },
        { text: '3% Onselli fee on each sale', emphasis: '3%' },
      ],
    },
  ],
  studio: [
    {
      title: 'Storefronts & offers',
      icon: Store,
      features: [
        { text: '10 workspaces', emphasis: '10' },
        { text: '10 storefronts', emphasis: '10' },
        { text: 'Unlimited published offers', emphasis: 'Unlimited' },
      ],
    },
    {
      title: 'Forms',
      icon: FileText,
      features: [
        { text: 'Unlimited forms', emphasis: 'Unlimited' },
        { text: '50,000 form submissions per month', emphasis: '50,000' },
      ],
    },
    {
      title: 'Audience & email',
      icon: Mail,
      features: [
        { text: '50,000 active contacts', emphasis: '50,000' },
        { text: '50,000 emails included per month', emphasis: '50,000' },
        { text: 'Up to 25,000 recipients per campaign', emphasis: '25,000' },
      ],
    },
    {
      title: 'Storage & domain',
      icon: Database,
      features: [
        { text: '100 GB storage', emphasis: '100 GB' },
        { text: 'Connect your own domain' },
        { text: 'Remove Onselli branding' },
      ],
    },
    {
      title: 'Insights & fees',
      icon: ChartNoAxesCombined,
      features: [
        { text: '12-month sales analytics with export', emphasis: '12-month' },
        { text: '2% Onselli fee on each sale', emphasis: '2%' },
      ],
    },
  ],
};

export default function PricingPlanGrid({
  currentPlan,
  className = '',
  presentation = 'workspace',
  renderAction,
}: {
  currentPlan?: PlanId;
  className?: string;
  presentation?: 'workspace' | 'marketing';
  renderAction: (
    plan: PricingPlan,
    isCurrent: boolean,
    needsPlanChange: boolean,
    billingInterval: BillingInterval,
  ) => ReactNode;
}) {
  const marketing = presentation === 'marketing';
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [conversion, setConversion] = useState<{ currency: string; rate: number } | null>(null);
  const [conversionFailed, setConversionFailed] = useState(false);

  useEffect(() => {
    if (displayCurrency === 'USD') return;
    let active = true;
    setConversion(null);
    setConversionFailed(false);
    fetch(`https://api.frankfurter.dev/v2/rate/usd/${displayCurrency.toLowerCase()}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Conversion rate unavailable');
        return response.json() as Promise<{ rate: number }>;
      })
      .then((data) => {
        if (!Number.isFinite(data.rate) || data.rate <= 0)
          throw new Error('Conversion rate unavailable');
        if (active) setConversion({ currency: displayCurrency, rate: data.rate });
      })
      .catch(() => {
        if (active) {
          setConversion(null);
          setConversionFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, [displayCurrency]);

  return (
    <div className={`w-full ${className}`}>
      {/* Controls Container: Currency Selector & Billing Interval Toggle */}
      <div className="mx-auto flex flex-col items-center justify-center gap-4 sm:flex-row sm:justify-between sm:gap-6 mb-8 max-w-5xl">
        {/* Currency preview dropdown */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs font-medium text-ink">
          <label htmlFor="pricing-display-currency" className="text-muted">
            Display prices in
          </label>
          <div className="relative inline-flex items-center">
            <select
              id="pricing-display-currency"
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              aria-label="Currency for price estimate"
              className="appearance-none rounded-lg border border-border bg-surface pl-3 pr-8 py-1.5 text-xs font-semibold text-ink shadow-xs hover:border-border-hover focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-colors cursor-pointer"
            >
              <option value="USD">USD ($)</option>
              <option value="NGN">NGN (₦)</option>
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
              <option value="CAD">CAD ($)</option>
            </select>
            <ChevronDown
              size={13}
              className="pointer-events-none absolute right-2.5 text-muted"
            />
          </div>
          {displayCurrency !== 'USD' && conversionFailed && (
            <span className="w-full text-center sm:text-left text-[11px] text-danger" role="status">
              Estimate unavailable. Charged in USD.
            </span>
          )}
          {displayCurrency !== 'USD' && !conversion && !conversionFailed && (
            <span className="w-full text-center sm:text-left text-[11px] text-muted" role="status">
              Loading conversion rate…
            </span>
          )}
        </div>

        {/* Monthly / Yearly Billing Toggle */}
        <div
          role="radiogroup"
          aria-label="Billing frequency"
          className="inline-flex items-center rounded-xl border border-border bg-canvas/80 p-1 shadow-inner"
        >
          <button
            type="button"
            role="radio"
            aria-checked={billingInterval === 'month'}
            onClick={() => setBillingInterval('month')}
            className={`inline-flex items-center justify-center rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              billingInterval === 'month'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={billingInterval === 'year'}
            onClick={() => setBillingInterval('year')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              billingInterval === 'year'
                ? 'bg-surface text-ink shadow-sm'
                : 'text-muted hover:text-ink'
            }`}
          >
            Yearly
            <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-bold text-success-strong tracking-tight">
              Save 2 mo
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
        {(Object.values(PLAN_CATALOG) as PricingPlan[]).map((plan) => {
          const amount = plan[billingInterval === 'month' ? 'monthly' : 'yearly'][SUBSCRIPTION_CURRENCY];
          const isCurrent = plan.id === currentPlan;
          const isPro = plan.id === 'pro';
          const needsPlanChange = Boolean(currentPlan && currentPlan !== 'free' && !isCurrent && plan.id !== 'free');
          const PlanIcon = plan.id === 'free' ? UsersRound : isPro ? Rocket : Layers3;
          const planSections = PLAN_FEATURE_COPY[plan.id];
          const convertedPrice =
            amount > 0 && displayCurrency !== 'USD' && conversion?.currency === displayCurrency
              ? new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: displayCurrency,
                  currencyDisplay: 'narrowSymbol',
                  maximumFractionDigits: 0,
                }).format((amount / 100) * conversion.rate)
              : null;
          const equivalentMonthly =
            billingInterval === 'year' && amount > 0
              ? formatPlanPrice(Math.round(amount / 12), SUBSCRIPTION_CURRENCY)
              : null;

          return (
            <article
              key={plan.id}
              className={`relative flex flex-col rounded-2xl bg-surface p-6 sm:p-7 transition-all duration-200 ${
                isPro
                  ? 'border-2 border-brand shadow-xl ring-1 ring-brand/20 lg:-translate-y-2'
                  : 'border border-border shadow-xs hover:border-border-hover hover:shadow-md'
              }`}
            >
              {/* Featured Badge */}
              {isPro && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3.5 py-1 text-[10px] font-extrabold uppercase tracking-widest text-white shadow-sm">
                  Most Popular
                </div>
              )}

              {/* Plan Identity: Icon, Name, Tagline & Current Plan Badge */}
              <div className="flex items-start gap-3.5 min-h-[58px]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand">
                  <PlanIcon size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold tracking-tight text-ink">{plan.name}</h3>
                    {isCurrent && (
                      <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[10px] font-bold text-success-strong">
                        Current plan
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted line-clamp-2">
                    {plan.tagline}
                  </p>
                </div>
              </div>

              {/* Pricing Display */}
              <div className="my-5 rounded-xl border border-border-subtle bg-canvas/40 px-4 py-4 text-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-ink">
                    {amount ? formatPlanPrice(amount, SUBSCRIPTION_CURRENCY) : 'Free'}
                  </span>
                  {amount > 0 && (
                    <span className="text-sm font-semibold text-muted">
                      /{billingInterval === 'month' ? 'mo' : 'yr'}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-muted min-h-[18px]">
                  {amount > 0 ? (
                    convertedPrice ? (
                      <span>≈ {convertedPrice} · estimated conversion</span>
                    ) : billingInterval === 'year' && equivalentMonthly ? (
                      <span>
                        {equivalentMonthly}/mo billed annually in USD
                      </span>
                    ) : (
                      <span>Billed monthly in USD</span>
                    )
                  ) : (
                    <span>Free forever, no credit card required</span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mb-6">
                {renderAction(plan, isCurrent, needsPlanChange, billingInterval)}
              </div>

              {/* Feature Sections */}
              <div className="flex-1 space-y-5 border-t border-border-subtle pt-5">
                {planSections.map((section) => {
                  const SectionIcon = section.icon;
                  return (
                    <section key={section.title} className="space-y-2.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink pb-1 border-b border-border-subtle/80">
                        <SectionIcon size={14} className="shrink-0 text-brand" />
                        <span>{section.title}</span>
                      </div>
                      <ul className="space-y-2.5 p-0 m-0 list-none">
                        {section.features.map((feature) => {
                          const emphasisIndex = feature.emphasis
                            ? feature.text.indexOf(feature.emphasis)
                            : -1;
                          const before =
                            emphasisIndex >= 0 ? feature.text.slice(0, emphasisIndex) : feature.text;
                          const after =
                            emphasisIndex >= 0
                              ? feature.text.slice(emphasisIndex + feature.emphasis!.length)
                              : '';
                          const isIncluded = feature.included !== false;

                          return (
                            <li
                              key={feature.text}
                              className="flex items-start gap-2.5 text-xs leading-normal"
                            >
                              <span
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full mt-0.5 ${
                                  isIncluded
                                    ? 'bg-success-tint text-success-strong'
                                    : 'bg-danger-tint text-danger'
                                }`}
                                aria-hidden="true"
                              >
                                {isIncluded ? (
                                  <Check size={11} strokeWidth={2.5} />
                                ) : (
                                  <X size={11} strokeWidth={2.5} />
                                )}
                              </span>
                              <span
                                className={`flex-1 min-w-0 ${
                                  isIncluded ? 'text-ink-secondary' : 'text-muted line-through opacity-70'
                                }`}
                              >
                                {before}
                                {emphasisIndex >= 0 && (
                                  <strong className="font-semibold text-ink">
                                    {feature.emphasis}
                                  </strong>
                                )}
                                {after}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
