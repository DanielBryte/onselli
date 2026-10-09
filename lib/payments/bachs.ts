import 'server-only';

const baseUrl = process.env.BACHS_ENV === 'live'
  ? 'https://api.bachs.io'
  : 'https://sandbox-api.bachs.io';

export async function createBachsCheckout(input: {
  orderId: string;
  title: string;
  amount: string;
  currency: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
  accountId: string;
  platformFee: string;
}) {
  const key = process.env.BACHS_API_KEY;
  if (!key) throw new Error('Bachs payments are not configured.');
  if (process.env.BACHS_ENV === 'live' && (process.env.PAYMENTS_LIVE_ENABLED !== 'true' || process.env.BACHS_CONNECT_READY !== 'true')) {
    throw new Error('Live checkout is disabled until Onselli payment operations and Bachs Connect creator settlements are approved.');
  }
  if (process.env.BACHS_ENV === 'live' && !process.env.BACHS_WEBHOOK_SECRET) {
    throw new Error('Live Bachs checkout requires a webhook signing secret.');
  }

  const response = await fetch(`${baseUrl}/v1/checkout-sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.orderId, 'X-Account-Id': input.accountId },
    body: JSON.stringify({
      pricing: { amount: input.amount, currency: input.currency },
      customer: { email: input.email },
      customer_creation: 'always',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      reference: input.orderId,
      metadata: { onselli_order_id: input.orderId },
      platform_fee: input.platformFee,
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.checkout_url !== 'string' || typeof payload.checkout_id !== 'string') {
    throw new Error(payload.detail || payload.message || 'Could not start secure checkout.');
  }
  return { checkoutId: payload.checkout_id as string, checkoutUrl: payload.checkout_url as string };
}

export async function bachsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.BACHS_API_KEY;
  if (!key) throw new Error('Bachs payments are not configured.');
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init?.headers },
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || payload.message || 'Bachs Connect request failed.');
  return payload as T;
}

export async function createBachsRefund(input: { chargeId: string; reference: string; accountId: string; reason: string }) {
  return bachsRequest<{ refund_id: string; status: string; requested_amount?: string }>(`/v1/refunds`, {
    method: 'POST',
    headers: { 'X-Account-Id': input.accountId, 'Idempotency-Key': input.reference },
    body: JSON.stringify({ charge_id: input.chargeId, reference: input.reference, idempotency_key: input.reference, reason: input.reason }),
  });
}

export type BachsAccount = {
  id: string;
  is_active?: boolean;
  capabilities?: Record<string, { status?: string; requested?: boolean; status_details?: string | null }>;
  requirements?: { currently_due?: string[]; past_due?: string[]; errors?: unknown[]; pending_verification?: string[] };
};

export async function refreshBachsAccount(accountId: string) {
  const account = await bachsRequest<BachsAccount>(`/v1/accounts/${encodeURIComponent(accountId)}`);
  const capabilities = account.capabilities ?? {};
  const requirements = account.requirements ?? {};
  const hasDue = Boolean(requirements.currently_due?.length || requirements.past_due?.length || requirements.errors?.length);
  const merchantCapabilities = Object.entries(capabilities).filter(([name, capability]) => ['card_collection', 'ngn_card_collection'].includes(name) && capability.requested);
  const hasMerchant = merchantCapabilities.length > 0;
  const merchantReady = hasMerchant && merchantCapabilities.every(([, capability]) => capability.status === 'active');
  const ready = account.is_active === true && !hasDue && merchantReady && capabilities.payouts?.status === 'active';
  const connectStatus = ready ? 'READY' : hasDue ? 'NEEDS_INFO' : hasMerchant ? 'IN_REVIEW' : 'RESTRICTED';
  return { account, capabilities, requirements, connectStatus };
}
