'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChartNoAxesCombined, Layers3, Mail, Rocket, Store, UsersRound } from 'lucide-react';
import { formatPlanPrice, PLAN_CATALOG, SUBSCRIPTION_CURRENCY, type BillingInterval, type PlanId } from '@/src/server/billing/plans';

type PricingPlan = (typeof PLAN_CATALOG)[PlanId];

export default function PricingPlanGrid({ currentPlan, className = '', renderAction }: {
  currentPlan?: PlanId;
  className?: string;
  renderAction: (plan: PricingPlan, isCurrent: boolean, needsPlanChange: boolean, billingInterval: BillingInterval) => ReactNode;
}) {
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
        if (!Number.isFinite(data.rate) || data.rate <= 0) throw new Error('Conversion rate unavailable');
        if (active) setConversion({ currency: displayCurrency, rate: data.rate });
      })
      .catch(() => { if (active) { setConversion(null); setConversionFailed(true); } });
    return () => { active = false; };
  }, [displayCurrency]);

  return <>
    <div className="pricing-currency-preview">
      <label htmlFor="pricing-display-currency">Display prices in</label>
      <select id="pricing-display-currency" value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value)} aria-label="Currency for price estimate">
        <option value="USD">USD — US Dollar</option><option value="NGN">NGN — Nigerian Naira</option><option value="GBP">GBP — British Pound</option><option value="EUR">EUR — Euro</option><option value="CAD">CAD — Canadian Dollar</option>
      </select>
      <span className="pricing-currency-preview__charge">Checkout is charged in USD. Local prices are estimates.</span>
      {displayCurrency !== 'USD' && conversionFailed && <span className="pricing-currency-preview__rate" role="status">Conversion unavailable. Prices remain in USD.</span>}
      {displayCurrency !== 'USD' && !conversion && !conversionFailed && <span className="pricing-currency-preview__rate" role="status">Loading estimate…</span>}
    </div>
    <div className="pricing-billing-toggle" role="group" aria-label="Billing frequency">
      <button type="button" aria-pressed={billingInterval === 'month'} className={billingInterval === 'month' ? 'is-selected' : ''} onClick={() => setBillingInterval('month')}>Monthly</button>
      <button type="button" aria-pressed={billingInterval === 'year'} className={billingInterval === 'year' ? 'is-selected' : ''} onClick={() => setBillingInterval('year')}>Yearly <span>Save 2 months</span></button>
    </div>
    <div className={`pricing-plans ${className}`.trim()}>
      {(Object.values(PLAN_CATALOG) as PricingPlan[]).map((plan) => {
        const amount = plan[billingInterval === 'month' ? 'monthly' : 'yearly'][SUBSCRIPTION_CURRENCY];
        const isCurrent = plan.id === currentPlan;
        const needsPlanChange = Boolean(currentPlan && currentPlan !== 'free' && !isCurrent && plan.id !== 'free');
        const PlanIcon = plan.id === 'free' ? UsersRound : plan.id === 'pro' ? Rocket : Layers3;
        const convertedPrice = amount > 0 && displayCurrency !== 'USD' && conversion?.currency === displayCurrency
          ? new Intl.NumberFormat(undefined, { style: 'currency', currency: displayCurrency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format((amount / 100) * conversion.rate)
          : null;
        const equivalentMonthly = billingInterval === 'year' && amount > 0 ? formatPlanPrice(amount / 10, SUBSCRIPTION_CURRENCY) : null;
        return <article className={`pricing-plan${plan.id === 'pro' ? ' pricing-plan--featured' : ''}`} key={plan.id}>
          {plan.id === 'pro' && <span className="pricing-plan__badge">MOST POPULAR</span>}
          <div className="pricing-plan__identity"><span className="pricing-plan__icon"><PlanIcon size={19}/></span><div><div className="pricing-plan__top"><h3>{plan.name}</h3>{isCurrent && <span className="pricing-plan__current">Current plan</span>}</div><p>{plan.tagline}</p></div></div>
          <div className="pricing-plan__price-wrap"><p className="pricing-plan__price">{amount ? formatPlanPrice(amount, SUBSCRIPTION_CURRENCY) : 'Free'}{amount > 0 && <span className="pricing-plan__period">/{billingInterval === 'month' ? 'month' : 'year'}</span>}</p>{amount > 0 && <small>{convertedPrice ? `≈ ${convertedPrice} · estimate` : `Billed ${billingInterval === 'month' ? 'monthly' : 'yearly'} in USD`}{billingInterval === 'year' && equivalentMonthly ? ` · ${equivalentMonthly}/month, save 2 months` : ''}</small>}</div>
          {renderAction(plan, isCurrent, needsPlanChange, billingInterval)}
          <div className="pricing-plan__sections">
            <section><h4><Store size={14}/> Storefronts &amp; offers</h4><ul>
              <li><span><Check size={12}/></span><strong>{plan.maxWorkspaces}</strong> {plan.maxWorkspaces === 1 ? 'workspace and storefront' : 'workspaces and storefronts'}</li>
              <li><span><Check size={12}/></span>{plan.maxPublishedOffers === null ? 'Unlimited published offers' : `${plan.maxPublishedOffers} published offers`}</li>
            </ul></section>
            <section><h4><Mail size={14}/> Audience &amp; email</h4><ul>
              <li><span><Check size={12}/></span><strong>{plan.maxContacts.toLocaleString()}</strong> active contacts</li>
              <li><span><Check size={12}/></span>{plan.maxRecipientsPerSend ? `Up to ${plan.maxRecipientsPerSend.toLocaleString()} recipients per campaign` : 'Campaign sending unavailable'}</li>
              {plan.maxRecipientsPerSend > 0 && <li className="pricing-plan__note">Email credits are purchased separately; no monthly sending credits are included.</li>}
            </ul></section>
            <section><h4><ChartNoAxesCombined size={14}/> Insights &amp; fees</h4><ul>
              <li><span><Check size={12}/></span>{plan.analyticsDays}-day sales analytics</li>
              <li><span><Check size={12}/></span><strong>{(plan.platformFeeBps / 100).toFixed(1).replace('.0', '')}%</strong> Onselli fee on each sale</li>
              {plan.prioritySupport && <li><span><Check size={12}/></span>Priority support</li>}
            </ul></section>
          </div>
        </article>;
      })}
    </div>
  </>;
}
