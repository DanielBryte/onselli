export type FeeBreakdown = { totalMinor: bigint; platformFeeMinor: bigint; processorFeeMinor: bigint; netToCreatorMinor: bigint };

/** Round a non-negative fraction to the nearest kobo, with exact half values rounded up. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  if (numerator < 0n || denominator <= 0n) throw new RangeError('Expected a non-negative numerator and positive denominator.');
  return (numerator + denominator / 2n) / denominator;
}

export function calculateFees(totalMinor: bigint, platformFeeBps: number, processorFeeBps: number): FeeBreakdown {
  if (totalMinor < 0n) throw new RangeError('Order totals cannot be negative.');
  for (const rate of [platformFeeBps, processorFeeBps]) {
    if (!Number.isInteger(rate) || rate < 0 || rate > 10_000) throw new RangeError('Fee rates must be whole basis points from 0 to 10,000.');
  }
  const platformFeeMinor = roundHalfUp(totalMinor * BigInt(platformFeeBps), 10_000n);
  const processorFeeMinor = roundHalfUp(totalMinor * BigInt(processorFeeBps), 10_000n);
  return { totalMinor, platformFeeMinor, processorFeeMinor, netToCreatorMinor: totalMinor > platformFeeMinor + processorFeeMinor ? totalMinor - platformFeeMinor - processorFeeMinor : 0n };
}

/** A refund reverses only the net amount originally credited for its order. */
export function refundLedgerEntry(netCreditedMinor: bigint, currentBucket: 'pending' | 'available') {
  if (netCreditedMinor < 0n) throw new RangeError('Refund amounts cannot be negative.');
  return { bucket: currentBucket, amountMinor: -netCreditedMinor } as const;
}
