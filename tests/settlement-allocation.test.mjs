import test from 'node:test';
import assert from 'node:assert/strict';
import { creatorSettlementAllocation } from '../lib/payments/settlement-allocation.mjs';

test('settlement sends creator share minus the approved reserve to available balance', () => {
  assert.deepEqual(creatorSettlementAllocation(10_000n, 1_500n, 1_000n), {
    earned: 8_500n,
    reserve: 850n,
    available: 7_650n,
  });
});

test('settlement holds the full creator share when reserve policy is missing', () => {
  assert.deepEqual(creatorSettlementAllocation(10_000n, 1_500n), {
    earned: 8_500n,
    reserve: 8_500n,
    available: 0n,
  });
});

test('settlement rejects negative amounts and a fee greater than the gross', () => {
  assert.throws(() => creatorSettlementAllocation(1_000n, 1_001n, 0n), RangeError);
  assert.throws(() => creatorSettlementAllocation(-1n, 0n, 0n), RangeError);
  assert.throws(() => creatorSettlementAllocation(1_000n, 0n, 10_001n), RangeError);
});
