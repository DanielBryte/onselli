export type BachsPaymentSettings = {
  organization_id?: string;
  adaptive_pricing?: boolean;
  enabled_payment_methods?: Record<string, { enabled?: boolean; currencies?: Record<string, boolean> }>;
  available_currencies?: Record<string, string[]>;
};
export function selectBachsPaymentMethods(
  settings: BachsPaymentSettings,
  currency: string,
  options?: { includeAdaptiveCurrencies?: boolean; platformAccountId?: string },
): { methods: string[]; cryptoAssets: string[] };
