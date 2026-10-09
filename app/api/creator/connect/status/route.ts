import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { refreshBachsAccount } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to view creator payments.' }, { status: 401 });
  try {
    const admin = getAdminSupabase();
    const { data: creator } = await admin.from('creators').select('id').eq('user_id', user.id).maybeSingle();
    if (!creator) return NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 });
    const { data: paymentAccount } = await admin.from('creator_payment_accounts').select('provider_account_id,country,entity_type,connect_status').eq('creator_id', creator.id).maybeSingle();
    if (!paymentAccount) return NextResponse.json({ status: 'NOT_STARTED' });
    const current = await refreshBachsAccount(paymentAccount.provider_account_id);
    await admin.from('creator_payment_accounts').update({ connect_status: current.connectStatus, capabilities: current.capabilities, requirements: current.requirements }).eq('creator_id', creator.id);
    return NextResponse.json({ status: current.connectStatus, country: paymentAccount.country, entityType: paymentAccount.entity_type, capabilities: current.capabilities, requirements: current.requirements, platformFeeBps: Number(process.env.ONSELLI_PLATFORM_FEE_BPS ?? 1000) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not refresh payment status.' }, { status: 503 });
  }
}
