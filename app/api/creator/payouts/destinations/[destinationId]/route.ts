import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { bachsRequest, refreshBachsAccount } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function PATCH(request: Request, context: { params: Promise<{ destinationId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to manage payout methods.' }, { status: 401 });
  try {
    const { destinationId } = await context.params;
    if (!/^pd_[A-Za-z0-9_-]+$/.test(destinationId)) return NextResponse.json({ error: 'Payout destination not found.' }, { status: 404 });
    const admin = getAdminSupabase();
    const { data: creator } = await admin.from('creators').select('id').eq('user_id', user.id).maybeSingle();
    if (!creator) return NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 });
    const { data: paymentAccount } = await admin.from('creator_payment_accounts').select('provider_account_id').eq('creator_id', creator.id).maybeSingle();
    if (!paymentAccount) return NextResponse.json({ error: 'Connect your Bachs payout account first.' }, { status: 409 });
    const current = await refreshBachsAccount(paymentAccount.provider_account_id);
    if (current.capabilities.payouts?.status !== 'active') return NextResponse.json({ error: 'Finish Bachs payout onboarding first.' }, { status: 409 });
    const { isDefault } = await request.json().catch(() => ({}));
    if (typeof isDefault !== 'boolean') return NextResponse.json({ error: 'Choose whether this method should be the default.' }, { status: 400 });
    const payload = await bachsRequest<{ id: string; is_default: boolean }>(`/v1/payouts/destinations/${encodeURIComponent(destinationId)}`, {
      method: 'PATCH',
      headers: { 'X-Account-Id': paymentAccount.provider_account_id },
      body: JSON.stringify({ is_default: isDefault }),
    });
    return NextResponse.json({ id: payload.id, isDefault: payload.is_default });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update the payout method.' }, { status: 503 });
  }
}
