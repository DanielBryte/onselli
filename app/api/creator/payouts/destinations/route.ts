import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { bachsRequest, refreshBachsAccount } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

type BachsDestination = {
  id: string; name?: string | null; type: string; currency: string; status: string;
  status_reason?: string | null; is_usable: boolean; is_default: boolean;
  account_number?: string | null; account_name?: string | null; bank_name?: string | null;
  phone_number?: string | null; mobile_provider?: string | null; wallet_address?: string | null;
};

function present(destination: BachsDestination) {
  const accountNumber = destination.account_number ?? '';
  const phoneNumber = destination.phone_number ?? '';
  const wallet = destination.wallet_address ?? '';
  const lastFour = accountNumber.slice(-4);
  return {
    id: destination.id,
    name: destination.name ?? destination.bank_name ?? destination.mobile_provider ?? 'Payout destination',
    type: destination.type,
    currency: destination.currency,
    status: destination.status,
    statusReason: destination.status_reason ?? null,
    isUsable: destination.is_usable,
    isDefault: destination.is_default,
    bankName: destination.bank_name ?? null,
    maskedDetails: accountNumber ? `•••• ${lastFour}` : phoneNumber ? `•••• ${phoneNumber.slice(-4)}` : wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : null,
  };
}

async function getCreatorAccount(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return { response: NextResponse.json({ error: 'Sign in to manage payout methods.' }, { status: 401 }) };
  const admin = getAdminSupabase();
  const { data: creator } = await admin.from('creators').select('id').eq('user_id', user.id).maybeSingle();
  if (!creator) return { response: NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 }) };
  const { data: paymentAccount } = await admin.from('creator_payment_accounts').select('provider_account_id,country').eq('creator_id', creator.id).maybeSingle();
  if (!paymentAccount) return { response: NextResponse.json({ error: 'Connect your Bachs payout account first.' }, { status: 409 }) };
  const current = await refreshBachsAccount(paymentAccount.provider_account_id);
  if (current.capabilities.payouts?.status !== 'active') return { response: NextResponse.json({ error: 'Finish Bachs payout onboarding before managing withdrawal methods.' }, { status: 409 }) };
  return { accountId: paymentAccount.provider_account_id, country: paymentAccount.country, creatorId: creator.id };
}

export async function GET(request: Request) {
  try {
    const account = await getCreatorAccount(request);
    if ('response' in account) return account.response;
    const payload = await bachsRequest<{ destinations?: BachsDestination[] }>('/v1/payouts/destinations?limit=100', { headers: { 'X-Account-Id': account.accountId } });
    return NextResponse.json({ destinations: (payload.destinations ?? []).map(present) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load payout methods.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const account = await getCreatorAccount(request);
    if ('response' in account) return account.response;
    if (account.country !== 'NG') return NextResponse.json({ error: 'Bank payout setup for this country is not available in Onselli yet. Contact support for help.' }, { status: 422 });
    const body = await request.json().catch(() => null);
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const accountNumber = typeof body?.accountNumber === 'string' ? body.accountNumber.replace(/\s/g, '') : '';
    const bankCode = typeof body?.bankCode === 'string' ? body.bankCode.trim() : '';
    if (!name || name.length > 100 || !/^\d{10}$/.test(accountNumber) || !/^\d{3,6}$/.test(bankCode)) {
      return NextResponse.json({ error: 'Enter a destination name, a valid 10-digit Nigerian account number, and choose a bank.' }, { status: 400 });
    }
    const created = await bachsRequest<BachsDestination>('/v1/payouts/destinations', {
      method: 'POST',
      headers: { 'X-Account-Id': account.accountId, 'Idempotency-Key': `onselli-destination-${createHash('sha256').update(`${account.creatorId}:${bankCode}:${accountNumber}`).digest('hex').slice(0, 48)}` },
      body: JSON.stringify({ name, type: 'bank_account', currency: 'NGN', account_number: accountNumber, bank_code: bankCode }),
    });
    return NextResponse.json({ destination: present(created) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save payout method.' }, { status: 503 });
  }
}
