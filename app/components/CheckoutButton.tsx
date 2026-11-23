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
    <div className="checkout-form checkout-form--product">
      {amountType === 'customer_chooses' && (
        <label className="checkout-amount-field">
          <span className="checkout-amount-field__label">Your amount</span>
          <span className="checkout-amount-field__input-wrap">
            <b>{symbol}</b>
            <input
              type="number"
              min={minimumAmount}
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-label={`Enter your payment amount in ${currency}`}
            />
          </span>
          <small>
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
        <div className="checkout-email-field">
          <label htmlFor="checkout-email-input">Email for receipt and access</label>
          <input
            id="checkout-email-input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <small className="checkout-email-helper">
            We’ll send your receipt and access link here. Guest checkout is available.
          </small>
          <div className="checkout-account-prompt">
            <span>Already have an Onselli account?</span>{' '}
            <a href={`/login?next=${encodeURIComponent(returnPath || '')}`}>Sign in</a>
          </div>
        </div>
      )}

      <button className="checkout-submit checkout-submit--filled" type="button" onClick={continueToCheckout}>
        {Number(amountType === 'customer_chooses' ? toMinor(amount) ?? '0' : priceMinor) === 0
          ? 'Get free access'
          : 'Continue to checkout'}{' '}
        <ArrowRight size={16} />
      </button>
      {secondaryAction}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
