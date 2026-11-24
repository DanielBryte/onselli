'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Check, ChartNoAxesCombined, Layers3, Mail, Rocket, Store, UsersRound } from 'lucide-react';
import { formatPlanPrice, PLAN_CATALOG, SUBSCRIPTION_CURRENCY, type BillingInterval, type PlanId } from '@/src/server/billing/plans';

type PricingPlan = (typeof PLAN_CATALOG)[PlanId];

export default function PricingPlanGrid({ currentPlan, className = '', presentation = 'workspace', renderAction }: {
  currentPlan?: PlanId;
  className?: string;
  presentation?: 'workspace' | 'marketing';
  renderAction: (plan: PricingPlan, isCurrent: boolean, needsPlanChange: boolean, billingInterval: BillingInterval) => ReactNode;
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
        if (!Number.isFinite(data.rate) || data.rate <= 0) throw new Error('Conversion rate unavailable');
        if (active) setConversion({ currency: displayCurrency, rate: data.rate });
      })
      .catch(() => { if (active) { setConversion(null); setConversionFailed(true); } });
    return () => { active = false; };
  }, [displayCurrency]);

  return <>
    <div className={`pricing-currency-preview ${marketing ? '!mx-auto !flex !w-full !max-w-[1100px] !flex-wrap !justify-center !gap-x-3 !gap-y-2 !text-left max-[760px]:!justify-start' : ''}`}>
      <label className={marketing ? '!text-xs !font-semibold !text-[#34483b] max-[760px]:!basis-full' : ''} htmlFor="pricing-display-currency">Display prices in</label>
      <select className={marketing ? '!min-h-[38px] !min-w-[190px] !rounded-lg !border !border-[#dfe7e1] !bg-white !px-3 !text-[13px] !font-semibold !text-[#22342a] max-[760px]:!w-full max-[760px]:!min-w-0' : ''} id="pricing-display-currency" value={displayCurrency} onChange={(event) => setDisplayCurrency(event.target.value)} aria-label="Currency for price estimate">
        <option value="USD">USD — US Dollar</option><option value="NGN">NGN — Nigerian Naira</option><option value="GBP">GBP — British Pound</option><option value="EUR">EUR — Euro</option><option value="CAD">CAD — Canadian Dollar</option>
      </select>
      <span className={`pricing-currency-preview__charge ${marketing ? '!text-xs !font-semibold !text-[#34483b] max-[760px]:!basis-full' : ''}`}>Checkout is charged in USD. Local prices are estimates.</span>
      {displayCurrency !== 'USD' && conversionFailed && <span className={`pricing-currency-preview__rate ${marketing ? '!basis-full !text-center !text-[11px] !leading-[1.4] !text-[#738078] max-[760px]:!text-left' : ''}`} role="status">Conversion unavailable. Prices remain in USD.</span>}
      {displayCurrency !== 'USD' && !conversion && !conversionFailed && <span className={`pricing-currency-preview__rate ${marketing ? '!basis-full !text-center !text-[11px] !leading-[1.4] !text-[#738078] max-[760px]:!text-left' : ''}`} role="status">Loading estimate…</span>}
    </div>
    <div className={`pricing-billing-toggle ${marketing ? '!mx-auto !mt-4 !flex !w-max !max-w-full !items-center !gap-[3px] !rounded-[9px] !border !border-[#e1e8e2] !bg-[#f6f8f6] !p-[3px] max-[760px]:!mx-0 max-[760px]:!mt-[14px]' : ''}`} role="group" aria-label="Billing frequency">
      <button type="button" aria-pressed={billingInterval === 'month'} className={`${billingInterval === 'month' ? 'is-selected' : ''} ${marketing ? '!inline-flex !min-h-9 !items-center !justify-center !gap-[7px] !rounded-md !border-0 !bg-transparent !px-3 !text-xs !font-medium !text-[#647269] !shadow-none max-[760px]:!min-h-[34px] max-[760px]:!px-[9px] max-[760px]:!text-[11px]' : ''} ${marketing && billingInterval === 'month' ? '!bg-white !text-[#173c2b] !shadow-[0_1px_3px_#17231b18]' : ''}`} onClick={() => setBillingInterval('month')}>Monthly</button>
      <button type="button" aria-pressed={billingInterval === 'year'} className={`${billingInterval === 'year' ? 'is-selected' : ''} ${marketing ? '!inline-flex !min-h-9 !items-center !justify-center !gap-[7px] !rounded-md !border-0 !bg-transparent !px-3 !text-xs !font-medium !text-[#647269] !shadow-none max-[760px]:!min-h-[34px] max-[760px]:!px-[9px] max-[760px]:!text-[11px]' : ''} ${marketing && billingInterval === 'year' ? '!bg-white !text-[#173c2b] !shadow-[0_1px_3px_#17231b18]' : ''}`} onClick={() => setBillingInterval('year')}>Yearly {marketing ? <span className="!rounded-[5px] !bg-[#e8f2eb] !px-1.5 !py-[3px] !text-[10px] !font-semibold !text-[#226245] max-[760px]:!text-[9px]">Save 2 months</span> : <span>Save 2 months</span>}</button>
    </div>
    <div className={`pricing-plans ${className} ${marketing ? '!mx-auto !mt-[22px] !grid !w-full !max-w-[1100px] !grid-cols-3 !items-stretch !gap-4 max-[900px]:!grid-cols-2 max-[900px]:[&_.pricing-plan--featured]:!col-span-2 max-[760px]:!mt-4 max-[760px]:!grid-cols-1 max-[760px]:!gap-3 max-[760px]:[&_.pricing-plan--featured]:[grid-column:auto]' : ''}`.trim()}>
      {(Object.values(PLAN_CATALOG) as PricingPlan[]).map((plan) => {
        const amount = plan[billingInterval === 'month' ? 'monthly' : 'yearly'][SUBSCRIPTION_CURRENCY];
        const isCurrent = plan.id === currentPlan;
        const needsPlanChange = Boolean(currentPlan && currentPlan !== 'free' && !isCurrent && plan.id !== 'free');
        const PlanIcon = plan.id === 'free' ? UsersRound : plan.id === 'pro' ? Rocket : Layers3;
        const convertedPrice = amount > 0 && displayCurrency !== 'USD' && conversion?.currency === displayCurrency
          ? new Intl.NumberFormat(undefined, { style: 'currency', currency: displayCurrency, currencyDisplay: 'code', maximumFractionDigits: 2 }).format((amount / 100) * conversion.rate)
          : null;
        const equivalentMonthly = billingInterval === 'year' && amount > 0 ? formatPlanPrice(amount / 10, SUBSCRIPTION_CURRENCY) : null;
        return <article className={`pricing-plan${plan.id === 'pro' ? ' pricing-plan--featured' : ''} ${marketing ? '!relative !flex !min-w-0 !flex-col !rounded-[18px] !border !border-[#e5ebe6] !bg-white !p-[22px] !shadow-[0_8px_24px_rgba(24,56,36,.04)] max-[480px]:!p-4' : ''} ${marketing && plan.id === 'pro' ? '!border-t-4 !border-t-[#16b783] !border-x-[#0b6848] !border-b-[#0b6848] !pt-[19px] !shadow-[0_12px_30px_rgba(6,75,52,.09)] max-[760px]:!pt-[21px] max-[480px]:!pt-[17px]' : ''}`} key={plan.id}>
          {plan.id === 'pro' && <span className={`pricing-plan__badge ${marketing ? '!absolute !right-[14px] !top-[13px] !rounded-full !bg-[#13a878] !px-2 !py-[5px] !text-[9px] !font-bold !tracking-[.07em] !text-white' : ''}`}>MOST POPULAR</span>}
          <div className={`pricing-plan__identity ${marketing ? '!flex !min-h-[53px] !items-start !gap-[11px]' : ''}`}><span className={`pricing-plan__icon ${marketing ? '!grid !h-10 !w-10 !shrink-0 !place-items-center !rounded-xl !bg-[#e9f6ef] !text-[#07986a]' : ''}`}><PlanIcon size={19}/></span><div className={marketing ? '!min-w-0' : ''}><div className={`pricing-plan__top ${marketing ? '!flex !justify-start !gap-2' : ''}`}><h3 className={marketing ? '!m-0 !text-[17px] !font-bold !tracking-[-.02em] !text-[#1d2c23]' : ''}>{plan.name}</h3>{isCurrent && <span className={`pricing-plan__current ${marketing ? '!rounded-full !bg-[#edf5ef] !px-1.5 !py-[3px] !text-[9px] !font-bold !text-[#286849]' : ''}`}>Current plan</span>}</div><p className={marketing ? '!mt-1 !text-xs !leading-[1.5] !text-[#748078]' : ''}>{plan.tagline}</p></div></div>
          <div className={`pricing-plan__price-wrap ${marketing ? '!grid !min-h-[105px] !justify-items-center !content-center !gap-[3px] !px-0 !py-[15px] !pb-[14px] max-[760px]:!min-h-[82px] max-[480px]:!min-h-[72px]' : ''}`}><p className={`pricing-plan__price ${marketing ? '!m-0 !text-[clamp(30px,3vw,40px)] !font-bold !leading-[1.1] !tracking-[-.045em] !text-[#16231c]' : ''}`}>{amount ? formatPlanPrice(amount, SUBSCRIPTION_CURRENCY) : 'Free'}{amount > 0 && <span className={`pricing-plan__period ${marketing ? '!ml-1 !text-[.38em] !font-medium !tracking-normal !text-[#758078]' : ''}`}>/{billingInterval === 'month' ? 'month' : 'year'}</span>}</p>{amount > 0 && <small className={marketing ? '!text-center !text-xs !leading-[1.4] !text-[#78847d]' : ''}>{convertedPrice ? `≈ ${convertedPrice} · estimate` : `Billed ${billingInterval === 'month' ? 'monthly' : 'yearly'} in USD`}{billingInterval === 'year' && equivalentMonthly ? ` · ${equivalentMonthly}/month, save 2 months` : ''}</small>}</div>
          {renderAction(plan, isCurrent, needsPlanChange, billingInterval)}
          <div className={`pricing-plan__sections ${marketing ? '!mt-[13px] !grid !gap-[14px] !border-t !border-[#edf1ed] !pt-[14px] max-[760px]:!grid-cols-2 max-[760px]:!gap-x-[14px] max-[480px]:!grid-cols-1 max-[480px]:!gap-3' : ''}`}>
            <section className={marketing ? 'max-[760px]:[&:last-child]:!col-span-full max-[480px]:[&:last-child]:!col-auto' : ''}><h4 className={marketing ? '!mb-2 !flex !items-center !gap-[7px] !text-xs !font-bold !leading-[1.4] !text-[#25382c]' : ''}><Store className={marketing ? 'shrink-0 !text-[#28734f]' : ''} size={14}/> Storefronts &amp; offers</h4><ul className={marketing ? '!grid !gap-2 !p-0 !m-0 !list-none' : ''}>
              <li className={marketing ? '!flex !items-start !gap-[7px] !text-xs !leading-[1.5] !text-[#536159]' : ''}><span className={marketing ? '!grid !h-[18px] !w-[18px] !shrink-0 !place-items-center !rounded-full !bg-[#e8f5ed] !text-[#158053]' : ''}><Check size={12}/></span><strong className={marketing ? '!font-bold !text-[#26362c]' : ''}>{plan.maxWorkspaces}</strong> {plan.maxWorkspaces === 1 ? 'workspace and storefront' : 'workspaces and storefronts'}</li>
              <li className={marketing ? '!flex !items-start !gap-[7px] !text-xs !leading-[1.5] !text-[#536159]' : ''}><span className={marketing ? '!grid !h-[18px] !w-[18px] !shrink-0 !place-items-center !rounded-full !bg-[#e8f5ed] !text-[#158053]' : ''}><Check size={12}/></span>{plan.maxPublishedOffers === null ? 'Unlimited published offers' : `${plan.maxPublishedOffers} published offers`}</li>
            </ul></section>
            <section className={marketing ? 'max-[760px]:[&:last-child]:!col-span-full max-[480px]:[&:last-child]:!col-auto' : ''}><h4 className={marketing ? '!mb-2 !flex !items-center !gap-[7px] !text-xs !font-bold !leading-[1.4] !text-[#25382c]' : ''}><Mail className={marketing ? 'shrink-0 !text-[#28734f]' : ''} size={14}/> Audience &amp; email</h4><ul className={marketing ? '!grid !gap-2 !p-0 !m-0 !list-none' : ''}>
              <li className={marketing ? '!flex !items-start !gap-[7px] !text-xs !leading-[1.5] !text-[#536159]' : ''}><span className={marketing ? '!grid !h-[18px] !w-[18px] !shrink-0 !place-items-center !rounded-full !bg-[#e8f5ed] !text-[#158053]' : ''}><Check size={12}/></span><strong className={marketing ? '!font-bold !text-[#26362c]' : ''}>{plan.maxContacts.toLocaleString()}</strong> active contacts</li>
              <li className={marketing ? '!flex !items-start !gap-[7px] !text-xs !leading-[1.5] !text-[#536159]' : ''}><span className={marketing ? '!grid !h-[18px] !w-[18px] !shrink-0 !place-items-center !rounded-full !bg-[#e8f5ed] !text-[#158053]' : ''}><Check size={12}/></span>{plan.maxRecipientsPerSend ? `Up to ${plan.maxRecipientsPerSend.toLocaleString()} recipients per campaign` : 'Campaign sending unavailable'}</li>
              {plan.maxRecipientsPerSend > 0 && <li className={`pricing-plan__note ${marketing ? '!pl-[25px] !text-[11px] !leading-[1.45] !text-[#7a867e]' : ''}`}>Email credits are purchased separately; no monthly sending credits are included.</li>}
            </ul></section>
            <section className={marketing ? 'max-[760px]:[&:last-child]:!col-span-full max-[480px]:[&:last-child]:!col-auto [&:last-child_ul]:!grid-cols-2 max-[480px]:[&:last-child_ul]:!grid-cols-1' : ''}><h4 className={marketing ? '!mb-2 !flex !items-center !gap-[7px] !text-xs !font-bold !leading-[1.4] !text-[#25382c]' : ''}><ChartNoAxesCombined className={marketing ? 'shrink-0 !text-[#28734f]' : ''} size={14}/> Insights &amp; fees</h4><ul className={marketing ? '!grid !gap-2 !p-0 !m-0 !list-none' : ''}>
              <li className={marketing ? '!flex !items-start !gap-[7px] !text-xs !leading-[1.5] !text-[#536159]' : ''}><span className={marketing ? '!grid !h-[18px] !w-[18px] !shrink-0 !place-items-center !rounded-full !bg-[#e8f5ed] !text-[#158053]' : ''}><Check size={12}/></span>{plan.analyticsDays}-day sales analytics</li>
              <li className={marketing ? '!flex !items-start !gap-[7px] !text-xs !leading-[1.5] !text-[#536159]' : ''}><span className={marketing ? '!grid !h-[18px] !w-[18px] !shrink-0 !place-items-center !rounded-full !bg-[#e8f5ed] !text-[#158053]' : ''}><Check size={12}/></span><strong className={marketing ? '!font-bold !text-[#26362c]' : ''}>{(plan.platformFeeBps / 100).toFixed(1).replace('.0', '')}%</strong> Onselli fee on each sale</li>
              {plan.prioritySupport && <li className={marketing ? '!flex !items-start !gap-[7px] !text-xs !leading-[1.5] !text-[#536159]' : ''}><span className={marketing ? '!grid !h-[18px] !w-[18px] !shrink-0 !place-items-center !rounded-full !bg-[#e8f5ed] !text-[#158053]' : ''}><Check size={12}/></span>Priority support</li>}
            </ul></section>
          </div>
        </article>;
      })}
    </div>
  </>;
}
