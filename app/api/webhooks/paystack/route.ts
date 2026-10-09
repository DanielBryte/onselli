import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server-supabase';
import { verifyPaystackWebhook } from '@/lib/payments/paystack';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !verifyPaystackWebhook(rawBody, request.headers.get('x-paystack-signature'), secret)) return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  let event: { event?: string; data?: { reference?: string; status?: string; amount?: number; currency?: string; id?: string } };
  try { event = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  if (!event.event || !event.data?.reference) return NextResponse.json({ error: 'Missing event identity.' }, { status: 400 });
  const admin = getAdminSupabase();
  const eventId = `${event.event}:${event.data.id ?? event.data.reference}`;
  const { error: eventError } = await admin.from('payment_webhook_events').insert({ provider: 'paystack', provider_event_id: eventId, event_type: event.event, payload: { event: event.event, reference: event.data.reference, status: event.data.status, amount: event.data.amount, currency: event.data.currency } });
  if (eventError?.code === '23505') return NextResponse.json({ received: true, duplicate: true });
  if (eventError) return NextResponse.json({ error: 'Could not record webhook.' }, { status: 500 });
  if (event.event !== 'charge.success') return NextResponse.json({ received: true });
  const { data: order } = await admin.from('creator_orders').select('id,amount,currency,status').eq('payment_provider', 'paystack').eq('provider_checkout_id', event.data.reference).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  if (event.data.status !== 'success' || Math.abs(Number(event.data.amount) / 100 - Number(order.amount)) > 0.01 || event.data.currency?.toUpperCase() !== String(order.currency).trim().toUpperCase()) return NextResponse.json({ error: 'Payment does not match order.' }, { status: 422 });
  const { error } = await admin.rpc('fulfill_creator_order', { order_id_input: order.id, provider_charge_id_input: String(event.data.id ?? event.data.reference) });
  if (error) {
    await admin.from('payment_webhook_events').delete().eq('provider', 'paystack').eq('provider_event_id', eventId);
    return NextResponse.json({ error: 'Could not fulfill order.' }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
