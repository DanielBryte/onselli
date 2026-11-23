import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getPayoutSupportedCurrencies } from '@/lib/payments/bachs-payouts';

export const runtime = 'nodejs';
export async function GET() {
  try {
    await requireCreator();
    const result = await getPayoutSupportedCurrencies();
    const bankCurrencies = new Set(['NGN','GHS','KES','TZS','UGX','GBP','EUR','USD','CAD']);
    const mobileCurrencies = new Set(['GHS','KES','TZS']);
    const currencies = [
      ...(result.fiat ?? []).map((currency) => ({ currency: currency.toUpperCase(), methods: [...(bankCurrencies.has(currency.toUpperCase()) ? ['bank_account'] : []), ...(mobileCurrencies.has(currency.toUpperCase()) ? ['mobile_money'] : [])] })),
      ...(result.crypto ?? []).map((currency) => ({ currency: currency.toUpperCase(), methods: ['crypto_wallet'] })),
    ];
    return NextResponse.json({ currencies }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Payout currency lookup failed', error);
    return NextResponse.json({ error: 'Supported payout currencies are temporarily unavailable.' }, { status: 503 });
  }
}
