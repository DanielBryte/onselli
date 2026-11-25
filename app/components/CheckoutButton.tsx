'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { currencyMinorToDecimal, decimalToCurrencyMinor } from '@/lib/money.mjs';

export default function CheckoutButton({
  productId,
  returnPath,
  amountType = 'fixed',
  priceMinor,
  minAmountMinor,
  currency = 'NGN',
  initialEmail = '',
  secondaryAction,
}: {
  productId: string;
  returnPath?: string;
  amountType?: 'fixed' | 'customer_chooses';
  priceMinor: string;
  minAmountMinor?: string | null;
  currency?: string;
  initialEmail?: string;
  secondaryAction?: React.ReactNode;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [amount, setAmount] = useState(currencyMinorToDecimal(minAmountMinor ?? priceMinor, currency));
  const [error, setError] = useState('');
  const minimumAmount = Number(currencyMinorToDecimal(minAmountMinor ?? '0', currency));
  const toMinor = (value: string) => {
    try {
      return decimalToCurrencyMinor(value, currency).toString();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const savedAmount = sessionStorage.getItem(`onselli:checkout-amount:${productId}`);
    if (savedAmount) setAmount(savedAmount);
  }, [productId]);

  function continueToCheckout() {
    setError('');
    let amountMinor: string | null = null;
    if (amountType === 'customer_chooses') {
      amountMinor = toMinor(amount);
      if (!amountMinor || BigInt(amountMinor) < BigInt(minAmountMinor ?? '0')) {
        setError(
          `Enter an amount of at least ${new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          }).format(minimumAmount)}.`
        );
        return;
      }
      sessionStorage.setItem(`onselli:checkout-amount:${productId}`, amount);
    }
    const query = new URLSearchParams({ productId });
    if (amountMinor) query.set('amountMinor', amountMinor);
    if (email.trim()) query.set('email', email.trim());
    router.push(`/checkout/start?${query.toString()}`);
  }

  const symbol =
    new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency;

  return (
    <div className="flex flex-col">
      {amountType === 'customer_chooses' && (
        <label className="mt-[17px] grid gap-1.5 text-[11px] font-[650] text-ink-secondary">
          <span className="text-[10px] font-medium text-muted">Your amount</span>
          <span className="text-[10px] font-medium text-muted">
            <b>{symbol}</b>
            <input
              type="number"
              min={minimumAmount}
              step="0.01"
              inputMode="decimal"
              value={amount}
              className="w-full border-0 bg-transparent text-sm text-ink outline-none"
              onChange={(event) => setAmount(event.target.value)}
              aria-label={`Enter your payment amount in ${currency}`}
            />
          </span>
          <small className="text-[10px] font-normal text-muted">
            Minimum{' '}
            {new Intl.NumberFormat(undefined, {
              style: 'currency',
              currency,
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            }).format(minimumAmount)}
          </small>
        </label>
      )}

      {!initialEmail && (
        <div className="mb-[14px] flex flex-col gap-1.5">
          <label className="text-[12.5px] font-semibold text-ink-secondary" htmlFor="checkout-email-input">Email for receipt and access</label>
          <input
            className="box-border h-11 w-full rounded-lg border border-border-hover bg-white px-[13px] text-sm text-ink outline-none transition-[border-color,box-shadow] focus:border-brand focus:!outline-none focus:ring-2 focus:ring-brand/15"
            id="checkout-email-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <small className="mt-0.5 text-[11.5px] leading-[1.5] text-muted">
            We’ll send your receipt and access link here. Guest checkout is available.
          </small>
          <div className="mt-[5px] text-[12.5px] text-ink-secondary">
            <span>Already have an Onselli account?</span>{' '}
            <a className="font-semibold !text-display-strong !underline decoration-1 underline-offset-2 hover:!text-display-dark" href={`/login?next=${encodeURIComponent(returnPath || '')}`}>Sign in</a>
          </div>
        </div>
      )}

      <button className="mt-3 flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-[9px] border-0 bg-brand font-sans text-sm font-[650] leading-none text-white transition-colors hover:bg-brand-strong" type="button" onClick={continueToCheckout}>
        {Number(amountType === 'customer_chooses' ? toMinor(amount) ?? '0' : priceMinor) === 0
          ? 'Get free access'
          : 'Continue to checkout'}{' '}
        <ArrowRight size={16} />
      </button>
      {secondaryAction}
      {error && (
        <p className="mt-2.5 rounded-[9px] bg-danger-tint px-[13px] py-[11px] text-[13px] text-danger-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
