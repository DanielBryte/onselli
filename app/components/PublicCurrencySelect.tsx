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
    <div className="relative inline-flex">
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
        className="!inline-flex !h-9 !min-h-9 !cursor-pointer !items-center !gap-1.5 !rounded-[9px] !border !border-border !bg-white !px-3 !text-[13px] !font-semibold !text-ink !shadow-none !transition-[border-color,background-color] hover:!border-border-hover hover:!bg-surface focus:!border-[#087653] focus:!outline-none focus:!shadow-none focus-visible:!border-[#087653] focus-visible:!outline-none focus-visible:!shadow-none"
        aria-label="Choose catalog currency"
        hideCheckmark={false}
      >
        <option value="NGN">NGN</option>
        <option value="USD">USD</option>
      </WorkspaceSelect>
    </div>
  );
}

