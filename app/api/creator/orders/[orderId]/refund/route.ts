import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { createBachsRefund } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to manage this order.' }, { status: 401 });
  const { orderId } = await params;
  const admin = getAdminSupabase();
  const { data: creator } = await admin.from('creators').select('id').eq('user_id', user.id).maybeSingle();
  if (!creator) return NextResponse.json({ error: 'Creator profile not found.' }, { status: 404 });
  const { data: order } = await admin.from('creator_orders').select('id,status,payment_provider,provider_charge_id,provider_account_id,creator_id').eq('id', orderId).eq('creator_id', creator.id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (order.payment_provider !== 'bachs' || !order.provider_charge_id || !order.provider_account_id) return NextResponse.json({ error: 'This sale is not eligible for a connected Bachs refund.' }, { status: 409 });
  if (!['PAID', 'REFUND_PENDING'].includes(order.status)) return NextResponse.json({ error: 'Only a paid order without an open dispute can be refunded.' }, { status: 409 });

  const reference = `onselli_refund_${order.id}`;
  if (order.status === 'PAID') {
    const { data: reserved, error: reserveError } = await admin.from('creator_orders').update({ status: 'REFUND_PENDING' }).eq('id', order.id).eq('status', 'PAID').select('id').maybeSingle();
    if (reserveError || !reserved) return NextResponse.json({ error: 'Order changed while the refund was being requested. Refresh and try again.' }, { status: 409 });
  }
  try {
    const refund = await createBachsRefund({ chargeId: order.provider_charge_id, reference, accountId: order.provider_account_id, reason: 'Creator approved customer refund' });
    const { error } = await admin.from('creator_refunds').upsert({ order_id: order.id, provider_refund_id: refund.refund_id, provider_reference: reference, status: refund.status?.toUpperCase() === 'FAILED' ? 'FAILED' : 'PROCESSING', requested_amount: refund.requested_amount ?? null, updated_at: new Date().toISOString() }, { onConflict: 'order_id', ignoreDuplicates: true });
    if (error) throw error;
    return NextResponse.json({ status: 'PROCESSING', message: 'Refund request accepted. The order will update when Bachs confirms the result.' });
  } catch (error) {
    return NextResponse.json({ error: `${error instanceof Error ? error.message : 'Bachs could not confirm this refund.'} The order remains on hold while the payment status is reconciled; retrying uses the same idempotency reference.` }, { status: 502 });
  }
}
