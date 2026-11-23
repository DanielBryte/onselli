import { eq } from 'drizzle-orm';
import { getDatabase } from '@/src/server/db';
import { settings } from '@/src/server/db/schema';

export type PayoutPause = { reason: string; pausedAt: string; pausedBy: string };
export type PayoutControls = { global: PayoutPause | null; accounts: Record<string, PayoutPause>; routes: Record<string, PayoutPause> };
const controlKey = 'creator_payout_controls';

export function normalizePayoutControls(value: unknown): PayoutControls {
  if (!value || typeof value !== 'object') return { global: null, accounts: {}, routes: {} };
  const row = value as Record<string, unknown>;
  const parse = (item: unknown): PayoutPause | null => {
    if (!item || typeof item !== 'object') return null;
    const pause = item as Record<string, unknown>;
    if (typeof pause.reason !== 'string' || typeof pause.pausedAt !== 'string' || typeof pause.pausedBy !== 'string') return null;
    return { reason: pause.reason, pausedAt: pause.pausedAt, pausedBy: pause.pausedBy };
  };
  const parseMap = (item: unknown) => {
    const map: Record<string, PayoutPause> = {};
    if (!item || typeof item !== 'object' || Array.isArray(item)) return map;
    for (const [key, pause] of Object.entries(item)) { const parsed = parse(pause); if (parsed) map[key] = parsed; }
    return map;
  };
  return { global: parse(row.global), accounts: parseMap(row.accounts), routes: parseMap(row.routes) };
}

export function payoutRouteControlKey(input: { sourceCurrency: string; destinationCurrency: string; method: string }) {
  return `${input.sourceCurrency.toUpperCase()}:${input.method.toLowerCase()}:${input.destinationCurrency.toUpperCase()}`;
}

export async function readPayoutControls() {
  const [row] = await getDatabase().select({ value: settings.value }).from(settings).where(eq(settings.key, controlKey)).limit(1);
  return normalizePayoutControls(row?.value);
}

export async function payoutPauseReason(input: { accountId: string; sourceCurrency: string; destinationCurrency: string; method: string }) {
  const controls = await readPayoutControls();
  return controls.global?.reason ?? controls.accounts[input.accountId]?.reason ?? controls.routes[payoutRouteControlKey(input)]?.reason ?? null;
}

export { controlKey as payoutControlsSettingKey };
