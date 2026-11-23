import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeMinorAmount, koboToDecimal, nairaToKobo, roundBasisPoints } from '../lib/money.mjs';

test('converts decimal Naira to exact integer kobo', () => {
  assert.equal(nairaToKobo('100'), 10000);
  assert.equal(nairaToKobo('100.5'), 10050);
  assert.equal(nairaToKobo('100.01'), 10001);
  assert.equal(koboToDecimal(10001), '100.01');
});

test('rejects ambiguous and unsafe monetary values', () => {
  assert.throws(() => nairaToKobo('1.001'));
  assert.throws(() => nairaToKobo('-1'));
  assert.throws(() => nairaToKobo('1e3'));
  assert.throws(() => nairaToKobo('90071992547409.92'));
});

test('rounds fees half up without floating-point arithmetic', () => {
  assert.equal(roundBasisPoints(10050, 500), 503);
  assert.equal(roundBasisPoints(199, 2500), 50);
  assert.equal(roundBasisPoints(10001, 0), 0);
});

test('accepts only non-negative safe integer minor-unit amounts', () => {
  assert.equal(isSafeMinorAmount(0n), true);
  assert.equal(isSafeMinorAmount(BigInt(Number.MAX_SAFE_INTEGER)), true);
  assert.equal(isSafeMinorAmount(BigInt(Number.MAX_SAFE_INTEGER) + 1n), false);
  assert.equal(isSafeMinorAmount(-1n), false);
  assert.equal(isSafeMinorAmount(100), false);
});
