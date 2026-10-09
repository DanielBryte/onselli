import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { bachsRequest } from '@/lib/payments/bachs';

export const runtime = 'nodejs';
const isoCountry = /^[A-Z]{2}$/;

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.email) return NextResponse.json({ error: 'Sign in to set up creator payments.' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const country = typeof body?.country === 'string' ? body.country.trim().toUpperCase() : '';
    const entityType = body?.entityType;
    if (!isoCountry.test(country) || !['individual', 'company'].includes(entityType)) return NextResponse.json({ error: 'Choose a valid country and account type.' }, { status: 400 });
    const admin = getAdminSupabase();
    const { data: creator } = await admin.from('creators').select('id,display_name').eq('user_id', user.id).maybeSingle();
    if (!creator) return NextResponse.json({ error: 'Finish your creator profile before setting up payouts.' }, { status: 404 });
    const { data: paymentAccount } = await admin.from('creator_payment_accounts').select('provider_account_id,country,entity_type').eq('creator_id', creator.id).maybeSingle();
    let accountId = paymentAccount?.provider_account_id as string | undefined;
    if (!accountId) {
      const account = await bachsRequest<{ id?: string }>('/v1/accounts', {
        method: 'POST',
        headers: { 'Idempotency-Key': `onselli-creator-${creator.id}-${country}-${entityType}` },
        body: JSON.stringify({
          contact_email: user.email,
          display_name: creator.display_name,
          country,
          entity_type: entityType,
          configuration: {
            merchant: { capabilities: { card_collection: { requested: true }, ...(country === 'NG' ? { ngn_card_collection: { requested: true } } : {}) } },
            recipient: { capabilities: { payouts: { requested: true }, transfers: { requested: true } } },
          },
        }),
      });
      if (!account.id) throw new Error('Bachs did not return a connected account ID.');
      accountId = account.id;
      const { error } = await admin.from('creator_payment_accounts').upsert({ creator_id: creator.id, provider_account_id: accountId, country, entity_type: entityType, connect_status: 'ONBOARDING' }, { onConflict: 'creator_id' });
      if (error) throw new Error('Could not save the payout account. Retry to continue onboarding.');
    } else if (paymentAccount?.country !== country || paymentAccount?.entity_type !== entityType) {
      return NextResponse.json({ error: 'This creator profile already has a payout account. Contact support if its legal country or account type needs correction.' }, { status: 409 });
    }
    const origin = new URL(request.url).origin;
    const link = await bachsRequest<{ url?: string }>(`/v1/accounts/${encodeURIComponent(accountId)}/account-links`, {
      method: 'POST',
      body: JSON.stringify({ type: 'onboarding', refresh_url: `${origin}/creator/payouts?refresh=1`, return_url: `${origin}/creator/payouts?returned=1` }),
    });
    if (!link.url) throw new Error('Bachs did not return an onboarding link.');
    return NextResponse.json({ onboardingUrl: link.url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not start Bachs onboarding.' }, { status: 503 });
  }
}
