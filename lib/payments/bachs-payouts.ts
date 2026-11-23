import 'server-only';
import { z } from 'zod';
import { bachsRequest } from './bachs';

export const payoutCurrencies = ['NGN','GHS','KES','TZS','UGX','GBP','EUR','USD','CAD','USDT_TRC20','USDT_BEP20','USDT_ERC20','USDT_SOL','USDC_ERC20','USDC_BEP20','USDC_SOL','USDC_BASE'] as const;
export const mobileMoneyCountries = ['GH','KE','TZ'] as const;
export function payoutDestinationLimitsMinor(currency: string, method: string) {
  if (method.toLowerCase() !== 'mobile_money') return null;
  const limits: Record<string, { min: bigint; max: bigint }> = { GHS: { min: 500n, max: 2_500_000n }, KES: { min: 2_000n, max: 25_000_000n }, TZS: { min: 100_000n, max: 500_000_000n } };
  return limits[currency.toUpperCase()] ?? null;
}
const supportedNetworks = {
  USDT_TRC20: 'TRC20', USDT_BEP20: 'BEP20', USDT_ERC20: 'ERC20', USDT_SOL: 'SOL',
  USDC_ERC20: 'ERC20', USDC_BEP20: 'BEP20', USDC_SOL: 'SOL', USDC_BASE: 'BASE',
} as const;
const sepaCountries = new Set(['AT','BE','CY','DE','EE','ES','FI','FR','GR','HR','IE','IT','LT','LU','LV','MT','NL','PT','SI','SK']);
const currencySchema = z.enum(payoutCurrencies);
const name = z.string().trim().min(2).max(100);
const accountNumber = z.string().trim().min(4).max(34).regex(/^[a-zA-Z0-9]+$/);
const country = z.string().trim().length(2).transform((v) => v.toUpperCase());
const addressSchema = z.object({ line1: z.string().trim().min(2).max(120), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), postal_code: z.string().trim().min(2).max(20), country: z.literal('US') }).strict();

const bankSchema = z.object({ type: z.literal('bank_account'), name, currency: currencySchema, country_code: country.optional(), account_name: name, bank_name: name.optional(), bank_code: z.string().trim().min(2).max(30).optional(), account_number: accountNumber.optional(), sort_code: z.string().regex(/^\d{6}$/).optional(), iban: z.string().trim().min(15).max(34).optional(), swift_bic: z.string().trim().regex(/^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/).optional(), routing_number: z.string().regex(/^\d{9}$/).optional(), bank_address: addressSchema.optional(), scheme: z.enum(['ach','wire','rtp','eft','interac_account','interac_email']).optional(), institution_number: z.string().trim().min(3).max(10).optional(), transit_number: z.string().trim().min(3).max(10).optional(), interac_email: z.string().email().max(254).optional() }).strict();
const mobileSchema = z.object({ type: z.literal('mobile_money'), name, currency: z.enum(['GHS','KES','TZS']), country_code: z.enum(mobileMoneyCountries), phone_number: z.string().trim().regex(/^\d{9,15}$/), mobile_provider: z.string().trim().min(2).max(50) }).strict();
const cryptoSchema = z.object({ type: z.literal('crypto_wallet'), name, currency: z.enum(['USDT_TRC20','USDT_BEP20','USDT_ERC20','USDT_SOL','USDC_ERC20','USDC_BEP20','USDC_SOL','USDC_BASE']), wallet_address: z.string().trim().min(20).max(200), network: z.string().trim().min(2).max(20) }).strict();

export type PayoutDestinationInput = z.infer<typeof bankSchema> | z.infer<typeof mobileSchema> | z.infer<typeof cryptoSchema>;
export function parsePayoutDestination(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { success: false as const, error: 'Provide payout destination details.' };
  const type = (input as { type?: unknown }).type;
  const parsed = type === 'bank_account' ? bankSchema.safeParse(input) : type === 'mobile_money' ? mobileSchema.safeParse(input) : type === 'crypto_wallet' ? cryptoSchema.safeParse(input) : null;
  if (!parsed) return { success: false as const, error: 'Choose a supported payout destination type.' };
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Check the payout destination details.' };
  const value = parsed.data as PayoutDestinationInput;
  if (value.type === 'bank_account') {
    const currency = value.currency;
    if (!['NGN','GHS','KES','TZS','UGX','GBP','EUR','USD','CAD'].includes(currency)) return { success: false as const, error: 'Choose a supported bank payout currency.' };
    if (currency === 'NGN' || ['GHS','KES','TZS','UGX'].includes(currency)) {
      const expectedCountry = currency === 'NGN' ? 'NG' : currency === 'GHS' ? 'GH' : currency === 'KES' ? 'KE' : currency === 'TZS' ? 'TZ' : 'UG';
      if (!value.bank_code || !value.country_code || !value.account_number) return { success: false as const, error: 'Bank code, account number, and country are required for this route.' };
      if (value.country_code !== expectedCountry) return { success: false as const, error: 'The bank country must match the payout currency.' };
      if (currency === 'NGN' && value.country_code !== 'NG') return { success: false as const, error: 'NGN payouts can only be sent to a Nigerian bank account.' };
      if (currency !== 'NGN' && value.country_code === 'NG') return { success: false as const, error: 'NGN balance cannot fund an international payout.' };
    }
    if (currency === 'GBP' && (value.country_code !== 'GB' || !value.account_number || !value.sort_code || !value.bank_name)) return { success: false as const, error: 'GBP Faster Payments requires a UK bank, account holder, bank name, six-digit sort code, and account number.' };
    if (currency === 'EUR' && (!value.country_code || !sepaCountries.has(value.country_code) || !value.iban || !value.swift_bic || !value.bank_name)) return { success: false as const, error: 'SEPA requires an eligible country, bank name, IBAN, and BIC.' };
    if (currency === 'USD' && (value.country_code !== 'US' || !value.account_number || !value.scheme || !['ach','wire','rtp'].includes(value.scheme) || !value.routing_number || !value.bank_address || !value.bank_name)) return { success: false as const, error: 'USD payouts require a US bank, scheme, bank name, nine-digit routing number, account number, and US bank branch address.' };
    if (currency === 'CAD' && (value.country_code !== 'CA' || !value.scheme || !['eft','interac_account','interac_email'].includes(value.scheme) || !value.bank_name || (value.scheme === 'interac_email' ? !value.interac_email : (!value.account_number || !value.institution_number || !value.transit_number)))) return { success: false as const, error: 'Complete the required Canadian EFT or Interac details.' };
  }
  if (value.type === 'mobile_money') {
    const expectedCountry = value.currency === 'GHS' ? 'GH' : value.currency === 'KES' ? 'KE' : 'TZ';
    if (value.country_code !== expectedCountry) return { success: false as const, error: 'The mobile money country must match its payout currency.' };
    const callingCode = value.country_code === 'GH' ? '233' : value.country_code === 'KE' ? '254' : '255';
    if (!value.phone_number.startsWith(callingCode)) return { success: false as const, error: 'Enter the phone number with its country calling code.' };
  }
  if (value.type === 'crypto_wallet' && supportedNetworks[value.currency] !== value.network.toUpperCase()) return { success: false as const, error: 'The selected asset and network combination is not supported.' };
  return { success: true as const, data: value };
}

export function payoutMethod(input: PayoutDestinationInput) {
  return input.type === 'mobile_money' ? 'MOBILE_MONEY' : input.type === 'crypto_wallet' ? 'CRYPTO' : 'BANK_TRANSFER';
}

export function toProviderDestination(input: PayoutDestinationInput) {
  const payload: Record<string, unknown> = { type: input.type, currency: input.currency, name: input.name };
  for (const [key, value] of Object.entries(input)) if (key !== 'type' && key !== 'currency' && key !== 'name' && value !== undefined) payload[key] = value;
  return payload;
}

export type BachsDestination = { id: string; name?: string; type: string; currency: string; country_code?: string; status?: string; status_reason?: string | null; is_usable?: boolean; bank_name?: string; account_number?: string; phone_number?: string; wallet_address?: string; account_name?: string; mobile_provider?: string; network?: string };
export async function createBachsPayoutDestination(input: PayoutDestinationInput, accountId: string) {
  return bachsRequest<BachsDestination>('/v1/payouts/destinations', { method: 'POST', headers: { 'X-Account-Id': accountId }, body: JSON.stringify(toProviderDestination(input)) });
}
export async function getBachsPayoutDestination(id: string, accountId: string) {
  return bachsRequest<BachsDestination>(`/v1/payouts/destinations/${encodeURIComponent(id)}`, { headers: { 'X-Account-Id': accountId } });
}

export type BachsPayoutQuote = { quote_id: string; from_currency: string; to_currency: string; from_amount: string; to_amount: string; exchange_rate?: string; expires_at: string; fee?: string; fee_currency?: string; withdrawal_fee?: string; total_debited?: string };
export async function createBachsPayoutQuote(input: { fromCurrency: string; toCurrency: string; amount: string; method: string; accountId: string }) {
  return bachsRequest<BachsPayoutQuote>('/v1/payouts/quotes', { method: 'POST', headers: { 'X-Account-Id': input.accountId }, body: JSON.stringify({ from_currency: input.fromCurrency, to_currency: input.toCurrency, amount: input.amount, payout_method: input.method }) });
}
export type BachsPayoutResult = { id: string; status: string; amount: string; currency: string; source_currency: string; fee: string; total_debited: string; reference: string; failure_reason?: string };
export async function createBachsPayout(input: { destination: string; reference: string; idempotencyKey: string; amount?: string; quoteId?: string; accountId: string }) {
  return bachsRequest<BachsPayoutResult>('/v1/payouts', { method: 'POST', headers: { 'X-Account-Id': input.accountId, 'Idempotency-Key': input.idempotencyKey }, body: JSON.stringify({ destination: input.destination, reference: input.reference, ...(input.quoteId ? { quote_id: input.quoteId } : { amount: input.amount }) }) });
}
export async function getBachsPayout(id: string, accountId: string) {
  return bachsRequest<BachsPayoutResult>(`/v1/payouts/${encodeURIComponent(id)}`, { headers: { 'X-Account-Id': accountId } });
}
export async function getBachsPayoutByReference(reference: string, accountId: string) {
  const result = await bachsRequest<{ total: number; items: BachsPayoutResult[] }>(`/v1/payouts?reference=${encodeURIComponent(reference)}`, { headers: { 'X-Account-Id': accountId } });
  if (!Array.isArray(result.items) || result.items.length > 1) throw new Error('Bachs returned an ambiguous payout reference.');
  const payout = result.items[0] ?? null;
  if (payout && payout.reference !== reference) throw new Error('Bachs returned a different payout reference.');
  return payout;
}

export type BachsTransfer = { id: string; source: string; destination: string; amount: string; currency: string; status: string; kind: string; source_charge_id?: string | null };
export async function getBachsTransfer(id: string) {
  return bachsRequest<BachsTransfer>(`/v1/transfers/${encodeURIComponent(id)}`);
}

export async function getBachsAccountBalances(accountId?: string) {
  return bachsRequest<{ account_id: string; balances: Array<{ currency: string; available_balance: string; pending_balance: string }> }>('/v1/balances', { headers: accountId ? { 'X-Account-Id': accountId } : {} });
}

export function configuredPayoutFeeMinor(currency: string, method?: string, destinationCurrency?: string): bigint | null {
  try {
    const routeConfig = JSON.parse(process.env.BACHS_PAYOUT_FEE_MINOR_BY_ROUTE ?? '{}') as Record<string, unknown>;
    const config = JSON.parse(process.env.BACHS_PAYOUT_FEE_MINOR_BY_CURRENCY ?? '{}') as Record<string, unknown>;
    const normalizedMethod = method?.toLowerCase();
    const value = method
      ? routeConfig[`${currency}:${normalizedMethod}:${destinationCurrency ?? currency}`] ?? routeConfig[`${currency}:${normalizedMethod}`]
      : config[currency];
    return typeof value === 'string' && /^\d+$/.test(value) ? BigInt(value) : null;
  } catch { return null; }
}

export type BachsPayment = { id: string; status: string; amount: string; currency: string; is_refundable?: boolean; fees?: { amount?: string; currency?: string } | null; fee_paid_by?: string | null };
export async function getBachsPayment(id: string) {
  return bachsRequest<BachsPayment>(`/v1/payments/${encodeURIComponent(id)}`);
}

export function amountToDecimal(minor: bigint | number, currency = 'USD') {
  const value = BigInt(minor); const sign = value < 0n ? '-' : ''; const absolute = value < 0n ? -value : value;
  const digits = currencyDigits(currency);
  const scale = 10n ** BigInt(digits);
  return digits ? `${sign}${absolute / scale}.${(absolute % scale).toString().padStart(digits, '0')}` : `${sign}${absolute}`;
}
export function decimalToMinor(value: string, currency = 'USD') {
  const digits = currencyDigits(currency);
  const expression = digits ? new RegExp(`^\\d+(?:\\.\\d{1,${digits}})?$`) : /^\\d+$/;
  if (!expression.test(value)) throw new Error('Provider returned an invalid payout amount.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole ?? '0') * (10n ** BigInt(digits)) + BigInt(fraction.padEnd(digits, '0') || '0');
}
function currencyDigits(currency: string) {
  if (/^(USDT|USDC)_/.test(currency)) return 6;
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
}
export function sanitizeBachsDestination(row: BachsDestination, creatorId: string, isDefault = false) {
  const raw = row.account_number ?? row.phone_number ?? row.wallet_address ?? '';
  const maskedDetails = raw ? `•••• ${raw.slice(-4)}` : null;
  return { creatorId, providerDestinationId: row.id, name: row.name?.slice(0,100) || row.bank_name || row.mobile_provider || row.network || row.currency, type: row.type, currency: row.currency, countryCode: row.country_code ?? null, method: row.type === 'mobile_money' ? 'mobile_money' : row.type === 'crypto_wallet' ? 'crypto' : 'bank_transfer', status: row.status ?? 'pending_review', statusReason: row.status_reason ?? null, isUsable: row.is_usable === true, maskedDetails, isDefault };
}

export async function getPayoutSupportedCurrencies() {
  return bachsRequest<{ fiat?: string[]; crypto?: string[] }>('/v1/currencies/payout-supported');
}
export async function getMobileMoneyProviders(countryCode: typeof mobileMoneyCountries[number]) {
  return bachsRequest<{ country?: string; providers?: Array<{ name: string; country?: string }> }>(`/v1/payouts/mobile-money-providers?country_code=${countryCode}`);
}

export async function getBachsBanks(country = 'NG') {
  return bachsRequest<{ country: string; banks: Array<{ name: string; code: string }> }>(`/v1/reference/banks?country=${encodeURIComponent(country)}`);
}

export async function resolveBachsBankAccount(input: { accountNumber: string; bankCode: string; country: string }) {
  return bachsRequest<{ resolved: boolean; account_name: string | null; account_number: string | null; message: string | null }>('/v1/misc/bank-accounts/resolve', {
    method: 'POST', body: JSON.stringify({ account_number: input.accountNumber, bank_code: input.bankCode, country: input.country }),
  });
}
