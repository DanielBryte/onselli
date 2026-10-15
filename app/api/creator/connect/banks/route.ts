import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { bachsRequest } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to view payout options.' }, { status: 401 });
  try {
    const admin = getAdminSupabase();
    const { data: creator } = await admin.from('creators').select('id').eq('user_id', user.id).maybeSingle();
    if (!creator) return NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 });
    const { data: account } = await admin.from('creator_payment_accounts').select('country').eq('creator_id', creator.id).maybeSingle();
    const country = account?.country ?? 'NG';
    const payload = await bachsRequest<{ banks?: Array<{ name: string; code: string }> }>(`/v1/reference/banks?country=${encodeURIComponent(country)}`);
    return NextResponse.json({ country, banks: payload.banks ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load payout options.' }, { status: 503 });
  }
}
