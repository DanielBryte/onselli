import test from 'node:test';
import assert from 'node:assert/strict';
import { createBachsWebhookAuditPayload, createVerifiedPaymentAuditSnapshot } from '../lib/payments/webhook-audit.mjs';

test('webhook audit payload omits buyer identity and arbitrary provider data', () => {
  const safe = createBachsWebhookAuditPayload({
    id: 'evt_1', type: 'checkout.completed', account: 'acct_platform',
    data: { checkout_id: 'chk_1', reference: 'order_1', amount: '12.00', currency: 'USD', customer: { email: 'buyer@example.com' }, metadata: { secret: 'private' }, unexpected: 'private' },
  });
  assert.deepEqual(safe, { id: 'evt_1', type: 'checkout.completed', account: 'acct_platform', data: { checkout_id: 'chk_1', reference: 'order_1', amount: '12.00', currency: 'USD' } });
});

test('verified payment snapshot contains only the fields needed for audit', () => {
  const safe = createVerifiedPaymentAuditSnapshot({ checkoutId: 'chk_1', reference: 'order_1', status: 'completed', paymentStatus: 'paid', amount: '12.00', currency: 'USD', platformFee: '0.50', charge: { id: 'ch_1', status: 'succeeded', payment_id: 'pay_1', customer: { email: 'buyer@example.com' } } });
  assert.deepEqual(safe, { checkout_id: 'chk_1', reference: 'order_1', status: 'completed', payment_status: 'paid', amount: '12.00', currency: 'USD', platform_fee: '0.50', charge: { id: 'ch_1', status: 'succeeded', payment_id: 'pay_1' } });
});
