import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';
import { createBachsCheckout, refreshBachsAccount } from '@/lib/payments/bachs';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const user = await getUserFromRequest(request);
    if (!user?.email) return NextResponse.json({ error: 'Sign in to continue to checkout.' }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.productId !== 'string') return NextResponse.json({ error: 'Choose a valid offer.' }, { status: 400 });
    const admin = getAdminSupabase();
    const { data: product } = await admin.from('creator_products').select('id,creator_id,title,slug,price_amount,currency,status').eq('id', body.productId).eq('status', 'PUBLISHED').maybeSingle();
    if (!product) return NextResponse.json({ error: 'This offer is unavailable.' }, { status: 404 });
    const { data: creator } = await admin.from('creators').select('id,display_name,slug,status').eq('id', product.creator_id).eq('status', 'PUBLISHED').maybeSingle();
    if (!creator) return NextResponse.json({ error: 'This creator is unavailable.' }, { status: 404 });
    if (Number(product.price_amount) <= 0) return NextResponse.json({ error: 'Free offers do not need checkout yet.' }, { status: 400 });
    const currency = String(product.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) return NextResponse.json({ error: 'This offer has an invalid currency.' }, { status: 400 });
    const provider = 'bachs';
    const { data: creatorPayment } = await admin.from('creator_payment_accounts').select('provider_account_id').eq('creator_id', creator.id).maybeSingle();
    if (!creatorPayment?.provider_account_id) return NextResponse.json({ error: 'This creator has not completed payout setup.' }, { status: 409 });
    const connect = await refreshBachsAccount(creatorPayment.provider_account_id);
    const requiredCapability = currency === 'NGN' ? 'ngn_card_collection' : currency === 'USD' ? 'card_collection' : null;
    if (!requiredCapability) return NextResponse.json({ error: 'Checkout is currently available only for USD and NGN offers.' }, { status: 400 });
    if (connect.account.is_active !== true || connect.capabilities[requiredCapability]?.status !== 'active' || connect.capabilities.payouts?.status !== 'active') {
      await admin.from('creator_payment_accounts').update({ connect_status: connect.connectStatus, capabilities: connect.capabilities, requirements: connect.requirements }).eq('creator_id', creator.id);
      return NextResponse.json({ error: `This creator is not yet approved for ${currency} checkout and payouts.` }, { status: 409 });
    }
    const feeBps = Number(process.env.ONSELLI_PLATFORM_FEE_BPS ?? 1000);
    if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5000) return NextResponse.json({ error: 'Onselli platform fee configuration is invalid.' }, { status: 503 });
    const amount = Number(product.price_amount);
    const fee = Math.round((amount * feeBps) / 100) / 100;
    if (fee >= amount) return NextResponse.json({ error: 'This offer price is too low for the configured platform fee.' }, { status: 400 });
    const { data: order, error: orderError } = await admin.from('creator_orders').insert({
      buyer_user_id: user.id, buyer_email: user.email, creator_id: creator.id, product_id: product.id,
      amount: product.price_amount, platform_fee_amount: fee, currency, status: 'PENDING', payment_provider: provider, provider_account_id: creatorPayment.provider_account_id,
    }).select('id').single();
    if (orderError || !order) throw new Error('Could not create your order. Please try again.');
    const origin = new URL(request.url).origin;
    let session: { checkoutId: string; checkoutUrl: string };
    try {
      session = await createBachsCheckout({
          orderId: order.id, title: product.title, amount: amount.toFixed(2), currency,
          email: user.email, successUrl: `${origin}/checkout/complete?order=${order.id}`,
          cancelUrl: `${origin}/c/${creator.slug}/${product.slug}?checkout=cancelled`,
          accountId: creatorPayment.provider_account_id, platformFee: fee.toFixed(2),
        });
    } catch (error) {
      await admin.from('creator_orders').update({ status: 'FAILED' }).eq('id', order.id).eq('status', 'PENDING');
      throw error;
    }
    const { error: updateError } = await admin.from('creator_orders').update({ provider_checkout_id: session.checkoutId }).eq('id', order.id);
    if (updateError) throw new Error('Could not prepare the checkout session. Please try again.');
    await admin.rpc('record_creator_product_metric', { product_id_input: product.id, metric_input: 'CHECKOUT_START' });
    return NextResponse.json({ checkoutUrl: session.checkoutUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Checkout is temporarily unavailable.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
