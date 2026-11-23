import test from 'node:test';
import assert from 'node:assert/strict';
import { isPayoutSourceAllowed } from '../lib/payments/payout-source-rules.mjs';

test('allows USD proceeds to be converted to an NGN creator bank account', () => {
  assert.equal(isPayoutSourceAllowed('USD', 'NGN'), true);
});

test('allows a same-currency NGN payout', () => {
  assert.equal(isPayoutSourceAllowed('NGN', 'NGN'), true);
});

test('requires USD proceeds for non-NGN destinations', () => {
  assert.equal(isPayoutSourceAllowed('USD', 'GBP'), true);
  assert.equal(isPayoutSourceAllowed('NGN', 'GBP'), false);
});

test('rejects unsupported source currencies', () => {
  assert.equal(isPayoutSourceAllowed('EUR', 'NGN'), false);
  assert.equal(isPayoutSourceAllowed('EUR', 'GBP'), false);
});
