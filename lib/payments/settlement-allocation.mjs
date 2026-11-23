/** Split a settled creator share into immediately available and held reserve amounts. */
export function creatorSettlementAllocation(grossMinor, platformFeeMinor, reserveBps = null) {
  const gross = BigInt(grossMinor);
  const platformFee = BigInt(platformFeeMinor);
  if (gross < 0n || platformFee < 0n || platformFee > gross) {
    throw new RangeError('The settled platform fee must be between zero and the sale gross.');
  }
  if (reserveBps !== null) {
    const bps = BigInt(reserveBps);
    if (bps < 0n || bps > 10_000n) throw new RangeError('Reserve basis points must be between 0 and 10,000.');
  }
  const earned = gross - platformFee;
  const reserve = reserveBps === null ? earned : (earned * BigInt(reserveBps)) / 10_000n;
  return { earned, reserve, available: earned - reserve };
}
