export type CreatorRiskPolicy = { version: string; reserveBps: bigint; holdDays: number };

export function getCreatorRiskPolicy(): CreatorRiskPolicy | null {
  const version = process.env.BACHS_CREATOR_RISK_POLICY_VERSION?.trim();
  const rawBps = process.env.BACHS_CREATOR_RESERVE_BPS;
  const rawDays = process.env.BACHS_CREATOR_RESERVE_HOLD_DAYS;
  if (!version || !rawBps || !rawDays || !/^\d+$/.test(rawBps) || !/^\d+$/.test(rawDays)) return null;
  const reserveBps = BigInt(rawBps);
  const holdDays = Number(rawDays);
  if (reserveBps > 10_000n || !Number.isSafeInteger(holdDays) || holdDays < 1 || holdDays > 365) return null;
  return { version, reserveBps, holdDays };
}
