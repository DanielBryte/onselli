import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server-supabase';
import { verifyBachsWebhook } from '@/lib/payments/webhook';
import { refreshBachsAccount } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.BACHS_WEBHOOK_SECRET;
  if (!secret || !verifyBachsWebhook(rawBody, request.headers.get('x-bachs-timestamp'), request.headers.get('x-bachs-signature-v2') ?? request.headers.get('x-bachs-signature'), secret)) {
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }
  let event: { id?: string; type?: string; account?: string; organization_id?: string; data?: { account?: string; checkout_id?: string; status?: string; payment_status?: string; amount?: string; requested_amount?: string; currency?: string; charge_id?: string; refund_id?: string; reference?: string; reason?: string; response_due_at?: string; evidence_editable?: boolean; dispute_id?: string; charge?: { id?: string; status?: string } } };
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (!event.id || !event.type) return NextResponse.json({ error: 'Missing event identity.' }, { status: 400 });
  const admin = getAdminSupabase();
  const { error: eventError } = await admin.from('payment_webhook_events').insert({ provider: 'bachs', provider_event_id: event.id, event_type: event.type, payload: { id: event.id, type: event.type, account: event.account ?? event.organization_id ?? event.data?.account, data: { checkout_id: event.data?.checkout_id, status: event.data?.status, payment_status: event.data?.payment_status, charge_id: event.data?.charge?.id ?? event.data?.charge_id, refund_id: event.data?.refund_id, dispute_id: event.data?.dispute_id, reference: event.data?.reference } } });
  if (eventError?.code === '23505') return NextResponse.json({ received: true, duplicate: true });
  if (eventError) return NextResponse.json({ error: 'Could not record webhook.' }, { status: 500 });
  if (['account.updated', 'capability.updated'].includes(event.type)) {
    const accountId = event.data?.account ?? event.account ?? event.organization_id;
    if (accountId) {
      try {
        const state = await refreshBachsAccount(accountId);
        const { error } = await admin.from('creator_payment_accounts').update({ connect_status: state.connectStatus, capabilities: state.capabilities, requirements: state.requirements }).eq('provider_account_id', accountId);
        if (error) throw error;
      } catch {
        await admin.from('payment_webhook_events').delete().eq('provider', 'bachs').eq('provider_event_id', event.id);
        return NextResponse.json({ error: 'Could not synchronize connected account.' }, { status: 500 });
      }
    }
    return NextResponse.json({ received: true });
  }
  const eventAccountId = event.account ?? event.organization_id ?? event.data?.account;
  if (['refund.created', 'refund.paid', 'refund.failed'].includes(event.type)) {
    const chargeId = event.data?.charge_id;
    if (!chargeId || !event.data?.refund_id) return NextResponse.json({ error: 'Refund event is missing its payment identity.' }, { status: 422 });
    const { data: order } = await admin.from('creator_orders').select('id,status,provider_account_id').eq('payment_provider', 'bachs').eq('provider_charge_id', chargeId).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Refund order not found.' }, { status: 404 });
    if (!order.provider_account_id || eventAccountId !== order.provider_account_id) return NextResponse.json({ error: 'Refund account does not match order.' }, { status: 422 });
    const incomingStatus = event.type === 'refund.paid' ? 'PAID' : event.type === 'refund.failed' ? 'FAILED' : 'PROCESSING';
    const { data: existingRefund } = await admin.from('creator_refunds').select('status').eq('order_id', order.id).maybeSingle();
    const finalStatus = existingRefund?.status && existingRefund.status !== 'PROCESSING' ? existingRefund.status : incomingStatus;
    const { error } = await admin.from('creator_refunds').upsert({ order_id: order.id, provider_refund_id: event.data.refund_id, provider_reference: event.data.reference ?? `bachs_${event.data.refund_id}`, status: finalStatus, requested_amount: event.data.requested_amount ?? event.data.amount ?? null, updated_at: new Date().toISOString() }, { onConflict: 'order_id' });
    if (error) {
      await admin.from('payment_webhook_events').delete().eq('provider', 'bachs').eq('provider_event_id', event.id);
      return NextResponse.json({ error: 'Could not update refund record.' }, { status: 500 });
    }
    if (event.type === 'refund.created') await admin.from('creator_orders').update({ status: 'REFUND_PENDING' }).eq('id', order.id).in('status', ['PAID', 'REFUND_PENDING']);
    if (event.type === 'refund.failed') await admin.from('creator_orders').update({ status: 'PAID' }).eq('id', order.id).eq('status', 'REFUND_PENDING');
    if (event.type === 'refund.paid') {
      await admin.from('creator_orders').update({ status: 'REFUNDED' }).eq('id', order.id).in('status', ['PAID', 'REFUND_PENDING']);
      await admin.from('creator_entitlements').update({ revoked_at: new Date().toISOString() }).eq('order_id', order.id).is('revoked_at', null);
    }
    return NextResponse.json({ received: true });
  }
  if (['dispute.created', 'dispute.updated'].includes(event.type)) {
    const disputeId = event.data?.dispute_id;
    const chargeId = event.data?.charge_id;
    if (!disputeId || !chargeId) return NextResponse.json({ error: 'Dispute event is missing its payment identity.' }, { status: 422 });
    const { data: order } = await admin.from('creator_orders').select('id,provider_account_id').eq('payment_provider', 'bachs').eq('provider_charge_id', chargeId).maybeSingle();
    if (!order) return NextResponse.json({ error: 'Dispute order not found.' }, { status: 404 });
    if (!order.provider_account_id || eventAccountId !== order.provider_account_id) return NextResponse.json({ error: 'Dispute account does not match order.' }, { status: 422 });
    const disputeStatus = String(event.data?.status ?? 'open').toLowerCase();
    const { error } = await admin.from('creator_disputes').upsert({ order_id: order.id, provider_dispute_id: disputeId, status: disputeStatus, amount: event.data?.amount ?? null, currency: event.data?.currency?.toUpperCase() ?? null, reason: event.data?.reason ?? null, response_due_at: event.data?.response_due_at ?? null, evidence_due: event.data?.evidence_editable ?? null, updated_at: new Date().toISOString() }, { onConflict: 'provider_dispute_id' });
    if (error) {
      await admin.from('payment_webhook_events').delete().eq('provider', 'bachs').eq('provider_event_id', event.id);
      return NextResponse.json({ error: 'Could not update dispute record.' }, { status: 500 });
    }
    if (['won', 'warning_closed'].includes(disputeStatus)) {
      await admin.from('creator_orders').update({ status: 'DISPUTED_WON' }).eq('id', order.id).eq('status', 'DISPUTED');
      await admin.from('creator_entitlements').update({ revoked_at: null }).eq('order_id', order.id);
    }
    else if (['lost', 'warning_needs_response'].includes(disputeStatus)) {
      await admin.from('creator_orders').update({ status: disputeStatus === 'lost' ? 'DISPUTED_LOST' : 'DISPUTED' }).eq('id', order.id).in('status', ['PAID', 'DISPUTED']);
      if (disputeStatus === 'lost') await admin.from('creator_entitlements').update({ revoked_at: new Date().toISOString() }).eq('order_id', order.id).is('revoked_at', null);
    } else {
      await admin.from('creator_orders').update({ status: 'DISPUTED' }).eq('id', order.id).eq('status', 'PAID');
      await admin.from('creator_entitlements').update({ revoked_at: new Date().toISOString() }).eq('order_id', order.id).is('revoked_at', null);
    }
    return NextResponse.json({ received: true });
  }
  if (!['checkout.completed', 'collection.succeeded', 'collection.failed', 'collection.underpaid'].includes(event.type) || !event.data?.checkout_id) return NextResponse.json({ received: true });

  const { data: order } = await admin.from('creator_orders').select('id,product_id,amount,currency,status,provider_account_id').eq('payment_provider', 'bachs').eq('provider_checkout_id', event.data.checkout_id).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (!order.provider_account_id || eventAccountId !== order.provider_account_id) return NextResponse.json({ error: 'Payment account does not match order.' }, { status: 422 });
  if (event.type === 'collection.failed' || event.type === 'collection.underpaid') {
    await admin.from('creator_orders').update({ status: 'FAILED' }).eq('id', order.id).eq('status', 'PENDING');
    return NextResponse.json({ received: true });
  }
  const chargeSucceeded = event.type === 'checkout.completed'
    ? event.data.payment_status === 'paid' && event.data.charge?.status?.toLowerCase() === 'succeeded'
    : event.type === 'collection.succeeded' && event.data.status === 'SUCCEEDED';
  const paidAmount = Number(event.data.amount);
  if (!chargeSucceeded || !Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(order.amount)) > 0.01 || event.data.currency?.toUpperCase() !== String(order.currency).trim().toUpperCase()) {
    return NextResponse.json({ error: 'Payment does not match order.' }, { status: 422 });
  }
  const { error: paymentError } = await admin.rpc('fulfill_creator_order', {
    order_id_input: order.id,
    provider_charge_id_input: event.data.charge?.id ?? event.data.charge_id ?? null,
  });
  if (paymentError) {
    await admin.from('payment_webhook_events').delete().eq('provider', 'bachs').eq('provider_event_id', event.id);
    return NextResponse.json({ error: 'Could not fulfill order.' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
