'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, X } from 'lucide-react';
import { type BillingInterval, type PlanId } from '@/src/server/billing/plans';
import PricingPlanGrid from '@/app/components/PricingPlanGrid';

export default function PricingModal({
  open,
  onOpen,
  onClose,
  trigger,
  currentPlan,
  billingEnabled,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  trigger: ReactElement;
  currentPlan: PlanId;
  billingEnabled: boolean;
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, billingInterval }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.checkoutUrl !== 'string')
        throw new Error(result.error || 'We couldn’t start checkout. Please try again.');
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'We couldn’t start checkout. Please try again.');
    } finally {
      setBusyPlan(null);
    }
  }

  async function manageSubscription() {
    setManaging(true);
    setError('');
    try {
      const response = await fetch('/api/billing/manage', { cache: 'no-store' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.manageUrl !== 'string')
        throw new Error(result.error || 'Subscription settings could not be opened.');
      window.location.assign(result.manageUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Subscription settings could not be opened.');
    } finally {
      setManaging(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) onOpen();
        else onClose();
      }}
    >
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1300] bg-black/60 backdrop-blur-xs p-4 sm:p-6 grid place-items-center overflow-y-auto animate-in fade-in duration-150" />
        <Dialog.Content
          className="relative z-[1301] w-full max-w-5xl rounded-2xl bg-surface border border-border p-5 sm:p-8 shadow-2xl my-auto max-h-[92vh] overflow-y-auto focus:outline-none"
          aria-describedby="pricing-description"
        >
          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 sm:top-6 sm:right-6 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted hover:text-ink hover:bg-canvas transition-colors cursor-pointer"
              type="button"
              aria-label="Close pricing"
            >
              <X size={18} />
            </button>
          </Dialog.Close>
          <div className="mb-6 max-w-xl">
            <Dialog.Title className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Choose a plan
            </Dialog.Title>
            <Dialog.Description id="pricing-description" className="mt-1.5 text-xs sm:text-sm text-muted">
              Compare limits and tools, then choose the plan that fits your business.
            </Dialog.Description>
          </div>

          <PricingPlanGrid
            currentPlan={currentPlan}
            presentation="workspace"
            renderAction={(plan, isCurrent, needsPlanChange, billingInterval) => (
              <button
                type="button"
                className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 text-xs sm:text-sm font-semibold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                  plan.id === 'pro'
                    ? 'bg-brand text-white shadow-sm hover:bg-brand-strong hover:shadow'
                    : 'border border-border bg-surface text-ink hover:border-brand hover:bg-brand-tint/60'
                }`}
                disabled={
                  plan.id === 'free' ||
                  (isCurrent && !billingEnabled) ||
                  Boolean(busyPlan) ||
                  managing
                }
                onClick={() =>
                  (isCurrent && billingEnabled) || needsPlanChange
                    ? void manageSubscription()
                    : void choosePlan(plan.id, billingInterval)
                }
              >
                {isCurrent && billingEnabled
                  ? managing
                    ? 'Opening billing portal…'
                    : 'Manage plan'
                  : needsPlanChange
                  ? managing
                    ? 'Opening billing portal…'
                    : 'Change plan in portal'
                  : isCurrent
                  ? 'Your current plan'
                  : busyPlan === plan.id
                  ? 'Opening secure checkout…'
                  : `Choose ${plan.name}`}
                <ArrowRight size={15} />
              </button>
            )}
          />

          {error && (
            <p className="mt-4 rounded-lg bg-danger-tint border border-danger-border p-3 text-xs text-danger font-medium" role="alert">
              {error}
            </p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
