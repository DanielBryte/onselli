'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, X } from 'lucide-react';
import { type BillingInterval, type PlanId } from '@/src/server/billing/plans';
import PricingPlanGrid from '@/app/components/PricingPlanGrid';

export default function PricingModal({ open, onOpen, onClose, trigger, currentPlan, billingEnabled }: {
  open: boolean; onOpen: () => void; onClose: () => void; trigger: ReactElement; currentPlan: PlanId; billingEnabled: boolean;
}) {
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [managing, setManaging] = useState(false);
  const [error, setError] = useState('');

  async function choosePlan(planId: PlanId, billingInterval: BillingInterval) {
    if (!billingEnabled || planId === 'free' || busyPlan) return;
    setBusyPlan(planId);
    setError('');
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingInterval }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.checkoutUrl !== 'string') throw new Error(result.error || 'We couldn’t start checkout. Please try again.');
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We couldn’t start checkout. Please try again.');
    } finally { setBusyPlan(null); }
  }

  async function manageSubscription() {
    setManaging(true);
    setError('');
    try {
      const response = await fetch('/api/billing/manage', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.manageUrl !== 'string') throw new Error(result.error || 'Subscription settings could not be opened.');
      window.location.assign(result.manageUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Subscription settings could not be opened.');
    } finally { setManaging(false); }
  }

  return <Dialog.Root open={open} onOpenChange={(nextOpen) => { if (nextOpen) onOpen(); else onClose(); }}>
    <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className="pricing-overlay" />
      <Dialog.Content className="pricing-modal" aria-describedby="pricing-description">
      <Dialog.Close asChild><button className="pricing-modal__close" type="button" aria-label="Close pricing"><X size={19}/></button></Dialog.Close>
      <Dialog.Title className="pricing-modal__title">Choose a plan</Dialog.Title>
      <Dialog.Description id="pricing-description">Compare limits and tools, then choose the plan that fits your business.</Dialog.Description>
      <PricingPlanGrid currentPlan={currentPlan} renderAction={(plan, isCurrent, needsPlanChange, billingInterval) => <button type="button" className={plan.id === 'pro' ? 'pricing-plan__action pricing-plan__action--primary' : 'pricing-plan__action'} disabled={plan.id === 'free' || (isCurrent && !billingEnabled) || Boolean(busyPlan) || managing} onClick={() => isCurrent && billingEnabled || needsPlanChange ? void manageSubscription() : void choosePlan(plan.id, billingInterval)}>
        {isCurrent && billingEnabled ? managing ? 'Opening billing portal…' : 'Manage plan' : needsPlanChange ? managing ? 'Opening billing portal…' : 'Change plan in portal' : isCurrent ? 'Your current plan' : busyPlan === plan.id ? 'Opening secure checkout…' : `Choose ${plan.name}`}<ArrowRight size={15}/>
      </button>} />
      {error && <p className="pricing-error" role="alert">{error}</p>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
