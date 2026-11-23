'use client';

import WorkspaceSelect from '@/app/components/ui/WorkspaceSelect';

export default function PublicCurrencySelect({
  creatorSlug,
  currency,
  onChange,
}: {
  creatorSlug: string;
  currency: 'NGN' | 'USD';
  onChange?: (currency: 'NGN' | 'USD') => void;
}) {
  return (
    <div className="public-currency-select bs-currency-select public-product-currency-select">
      <WorkspaceSelect
        value={currency}
        onChange={(event) => {
          const nextCurrency = event.target.value === 'USD' ? 'USD' : 'NGN';
          if (onChange) {
            onChange(nextCurrency);
          } else {
            window.location.assign(`/c/${encodeURIComponent(creatorSlug)}?currency=${nextCurrency}`);
          }
        }}
        className="public-currency-select__trigger bs-currency-select__trigger"
        menuClassName="public-currency-select__menu public-product-currency-select__menu"
        aria-label="Choose catalog currency"
        hideCheckmark={false}
      >
        <option value="NGN">NGN</option>
        <option value="USD">USD</option>
      </WorkspaceSelect>
    </div>
  );
}

