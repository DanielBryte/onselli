import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export async function createPaystackCheckout(input: { orderId: string; amount: string; currency: string; email: string; callbackUrl: string }) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('Paystack is not configured.');
  if (key.startsWith('sk_live_') && (process.env.PAYMENTS_LIVE_ENABLED !== 'true' || process.env.PAYSTACK_CREATOR_SETTLEMENT_READY !== 'true')) {
    throw new Error('Live checkout is disabled until Onselli payment operations and creator settlements are approved.');
  }
  if (!['NGN', 'GHS', 'ZAR', 'KES', 'USD'].includes(input.currency)) throw new Error(`Paystack does not support ${input.currency} in this checkout.`);
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: input.email, amount: Math.round(Number(input.amount) * 100), currency: input.currency, reference: input.orderId, callback_url: input.callbackUrl, metadata: { onselli_order_id: input.orderId } }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.status || !payload.data?.authorization_url || !payload.data?.reference) throw new Error(payload.message || 'Could not start Paystack checkout.');
  return { checkoutId: payload.data.reference as string, checkoutUrl: payload.data.authorization_url as string };
}

export function verifyPaystackWebhook(rawBody: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
