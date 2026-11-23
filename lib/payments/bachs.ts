import 'server-only';
import { selectBachsPaymentMethods } from './bachs-methods.mjs';

const baseUrl = process.env.BACHS_ENV === 'live'
  ? 'https://api.bachs.io'
  : 'https://sandbox-api.bachs.io';

export async function createBachsCheckout(input: {
  orderId: string;
  title: string;
  amount: string;
  currency: string;
  billing_currency?: string;
  email: string;
  name?: string;
  successUrl: string;
  cancelUrl: string;
  destinationAccountId: string;
  platformFee: string;
  paymentMethodTypes: string[];
  currencyOptions?: Array<{ currency: string; amount: string }>;
  billingCurrency?: string;
}) {
  const key = process.env.BACHS_API_KEY;
  if (!key) throw new Error('Bachs payments are not configured.');
  if (process.env.BACHS_ENV === 'live' && (process.env.PAYMENTS_LIVE_ENABLED !== 'true' || process.env.BACHS_PLATFORM_READY !== 'true')) {
    throw new Error('Live checkout is disabled until Onselli platform collections and settlement operations are approved.');
  }
  if (process.env.BACHS_ENV === 'live' && !process.env.BACHS_WEBHOOK_SECRET) {
    throw new Error('Live Bachs checkout requires a webhook signing secret.');
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.orderId };
  const checkoutBody: Record<string, unknown> = {
    pricing: { amount: input.amount, currency: input.currency, name: input.title },
    ...(input.currencyOptions?.length ? { currency_options: Object.fromEntries(input.currencyOptions.map((item) => [item.currency, item.amount])) } : {}),
    ...(input.billingCurrency ? { billing_currency: input.billingCurrency } : {}),
    customer: { email: input.email, ...(input.name ? { name: input.name } : {}) },
    customer_creation: 'always',
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    reference: input.orderId,
    metadata: { onselli_order_id: input.orderId },
    transfer_data: { destination: input.destinationAccountId },
    platform_fee: input.platformFee,
    // Restrict the hosted page to rails enabled on the Onselli Bachs account
    // for this checkout currency. Bachs still owns collection and confirmation.
    payment_method_types: input.paymentMethodTypes,
  };
  const response = await fetch(`${baseUrl}/v1/checkout-sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(checkoutBody),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  const checkoutId = typeof payload.checkout_id === 'string' ? payload.checkout_id : typeof payload.id === 'string' ? payload.id : null;
  const checkoutUrl = typeof payload.checkout_url === 'string' ? payload.checkout_url : typeof payload.url === 'string' ? payload.url : null;
  if (!response.ok || !checkoutId || !checkoutUrl) {
    throw new Error(payload.detail || payload.message || 'Could not start secure checkout.');
  }
  return { checkoutId, checkoutUrl };
}

type BachsCheckoutSettings = {
  organization_id: string;
  adaptive_pricing?: boolean;
  enabled_payment_methods?: Record<string, { enabled?: boolean; currencies?: Record<string, boolean> }>;
  available_currencies?: Record<string, string[]>;
};

/** Return only account-enabled payment corridors that can collect the supplied currency. */
export async function getBachsPaymentMethods(currency: string, options: { includeAdaptiveCurrencies?: boolean } = {}) {
  const settings = await bachsRequest<BachsCheckoutSettings>('/v1/accounts/checkout/settings');
  return selectBachsPaymentMethods(settings, currency, {
    includeAdaptiveCurrencies: options.includeAdaptiveCurrencies,
    platformAccountId: process.env.BACHS_PLATFORM_ACCOUNT_ID,
  });
}

export async function createBachsSubscriptionCheckout(input: {
  productId: string; email: string; name?: string; userId: string; planId: 'pro' | 'studio'; billingInterval: 'month' | 'year'; reference: string;
  successUrl?: string; cancelUrl?: string;
}) {
  const key = process.env.BACHS_API_KEY;
  if (!key) throw new Error('Bachs payments are not configured.');
  if (process.env.BACHS_ENV === 'live' && process.env.PAYMENTS_LIVE_ENABLED !== 'true') {
    throw new Error('Live billing is disabled until payment operations are approved.');
  }
  if (process.env.BACHS_ENV === 'live' && !process.env.BACHS_WEBHOOK_SECRET) {
    throw new Error('Live subscription checkout requires a Bachs webhook signing secret.');
  }
  const response = await fetch(`${baseUrl}/v1/checkout-sessions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': input.reference },
    body: JSON.stringify({
      product_cart: [{ product_id: input.productId, quantity: 1 }],
      customer: { email: input.email, ...(input.name ? { name: input.name } : {}) },
      billing_currency: 'USD',
      reference: input.reference,
      metadata: { onselli_user_id: input.userId, onselli_plan_id: input.planId, onselli_billing_interval: input.billingInterval, onselli_billing_reference: input.reference },
      ...(input.successUrl ? { success_url: input.successUrl } : {}),
      ...(input.cancelUrl ? { cancel_url: input.cancelUrl } : {}),
    }),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.checkout_url !== 'string' || typeof payload.checkout_id !== 'string') {
    throw new Error(payload.detail || payload.message || 'Could not start secure subscription checkout.');
  }
  return { checkoutId: payload.checkout_id as string, checkoutUrl: payload.checkout_url as string };
}

export type BachsCheckoutSession = {
  checkout_id: string;
  status: string;
  payment_status: string | null;
  amount: string;
  currency: string;
  billing_currency?: string;
  reference: string | null;
  platform_fee?: string | null;
  destination_amount?: string | null;
  charge: { id?: string; payment_id?: string; status?: string; amount?: string; currency?: string; fee_usd?: string } | null;
};

export async function getBachsCheckout(checkoutId: string, accountId?: string) {
  return bachsRequest<BachsCheckoutSession>(`/v1/checkout-sessions/${encodeURIComponent(checkoutId)}`, {
    headers: accountId ? { 'X-Account-Id': accountId } : {},
  });
}

export async function bachsRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.BACHS_API_KEY;
  if (!key) throw new Error('Bachs payments are not configured.');
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init?.headers },
      cache: 'no-store',
    });
  } catch (cause) {
    throw new BachsApiError('Bachs request outcome is uncertain.', 0, 'NETWORK_ERROR', { cause });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorBody = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const code = typeof errorBody.code === 'string' ? errorBody.code : typeof errorBody.error_code === 'string' ? errorBody.error_code : undefined;
    const message = typeof errorBody.detail === 'string' ? errorBody.detail : typeof errorBody.message === 'string' ? errorBody.message : 'Bachs Connect request failed.';
    throw new BachsApiError(message, response.status, code);
  }
  return payload as T;
}

export class BachsApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'BachsApiError';
  }
}

export async function createBachsRefund(input: { chargeId: string; reference: string; accountId?: string; reason: string }) {
  return bachsRequest<{ refund_id: string; status: string; requested_amount?: string }>(`/v1/refunds`, {
    method: 'POST',
    headers: { ...(input.accountId ? { 'X-Account-Id': input.accountId } : {}), 'Idempotency-Key': input.reference },
    body: JSON.stringify({ charge_id: input.chargeId, reference: input.reference, idempotency_key: input.reference, reason: input.reason }),
  });
}

export type BachsDisputeEvidence = Partial<Record<'access_activity_log' | 'billing_address' | 'cancellation_policy_attachment_id' | 'cancellation_policy_disclosure' | 'customer_communication_attachment_id' | 'customer_email_address' | 'customer_name' | 'notes' | 'product_description' | 'refund_policy_attachment_id' | 'refund_policy_disclosure' | 'refund_refusal_explanation' | 'service_date' | 'uncategorized_attachment_id', string>>;
export type BachsDispute = { dispute_id: string; charge_id: string; amount: string; currency: string; status: string; is_response_editable: boolean; reason?: string | null; response_deadline_at?: string | null; evidence?: BachsDisputeEvidence | null; latest_submission?: { submission_id?: string; status?: string; submitted_at?: string | null } | null };

export async function getBachsDispute(disputeId: string) {
  return bachsRequest<BachsDispute>(`/v1/disputes/${encodeURIComponent(disputeId)}`);
}

export async function updateBachsDisputeEvidence(disputeId: string, evidence: BachsDisputeEvidence) {
  return bachsRequest<{ dispute_id: string; status: string; is_response_editable: boolean; evidence_updated_at: string }>(`/v1/disputes/${encodeURIComponent(disputeId)}/evidence`, { method: 'PATCH', body: JSON.stringify(evidence) });
}

export async function submitBachsDispute(disputeId: string) {
  return bachsRequest<{ dispute_id: string; status: string; is_response_editable: boolean; submission: { submission_id: string; submission_status: string; submitted_at: string } }>(`/v1/disputes/${encodeURIComponent(disputeId)}/submit`, { method: 'POST', body: JSON.stringify({}) });
}

export type BachsAccount = {
  id: string;
  is_active?: boolean;
  capabilities?: Record<string, { status?: string; requested?: boolean; international?: boolean; status_details?: string | null }>;
  requirements?: { currently_due?: string[]; past_due?: string[]; errors?: Array<{ requirement?: string; code?: string } | string>; pending_verification?: string[] };
};

export async function createBachsRecipientAccount(input: { email: string; displayName: string; country: string; idempotencyKey: string }) {
  return bachsRequest<BachsAccount>('/v1/accounts', {
    method: 'POST',
    headers: { 'Idempotency-Key': input.idempotencyKey },
    body: JSON.stringify({
      contact_email: input.email,
      display_name: input.displayName,
      country: input.country,
      entity_type: 'individual',
      configuration: { recipient: { capabilities: { transfers: { requested: true }, payouts: { requested: true, international: true } } } },
    }),
  });
}

export async function requestBachsInternationalPayouts(accountId: string) {
  return bachsRequest<BachsAccount>(`/v1/accounts/${encodeURIComponent(accountId)}`, {
    method: 'POST',
    body: JSON.stringify({ configuration: { recipient: { capabilities: { payouts: { international: true } } } } }),
  });
}

export async function createBachsAccountLink(accountId: string, input: { refreshUrl: string; returnUrl: string }) {
  return bachsRequest<{ id: string; url: string; expires_at: string; previous_link_superseded?: boolean }>(`/v1/accounts/${encodeURIComponent(accountId)}/account-links`, {
    method: 'POST',
    body: JSON.stringify({ type: 'onboarding', refresh_url: input.refreshUrl, return_url: input.returnUrl }),
  });
}

export function bachsCreatorAccountState(account: BachsAccount) {
  const requirements = account.requirements ?? {};
  const due = [...(requirements.currently_due ?? []), ...(requirements.past_due ?? [])];
  const errors = requirements.errors ?? [];
  const pending = requirements.pending_verification ?? [];
  const capabilityStatus = (name: string) => account.capabilities?.[name]?.status ?? 'unknown';
  const status = account.is_active === false || capabilityStatus('payouts') === 'rejected' ? 'rejected'
    : errors.length || due.length ? 'needs_action'
    : pending.length || capabilityStatus('payouts') === 'pending' || capabilityStatus('payouts') === 'restricted' ? 'pending_review'
    : capabilityStatus('payouts') === 'active' ? 'approved'
    : 'needs_action';
  return {
    status,
    transfersStatus: capabilityStatus('transfers'),
    payoutsStatus: capabilityStatus('payouts'),
    internationalPayouts: account.capabilities?.payouts?.international === true,
    requirements: { currentlyDue: due, pendingVerification: pending, errors: errors.map((item) => typeof item === 'string' ? item : item.requirement ?? item.code ?? 'review_required') },
    onboarded: status === 'approved',
  };
}

export async function refreshBachsAccount(accountId: string) {
  const account = await bachsRequest<BachsAccount>(`/v1/accounts/${encodeURIComponent(accountId)}`);
  const capabilities = account.capabilities ?? {};
  const requirements = account.requirements ?? {};
  const hasDue = Boolean(requirements.currently_due?.length || requirements.past_due?.length || requirements.errors?.length);
  const ready = account.is_active === true && !hasDue && capabilities.transfers?.status === 'active' && capabilities.payouts?.status === 'active';
  const connectStatus = ready ? 'READY' : hasDue ? 'NEEDS_INFO' : capabilities.payouts?.status === 'restricted' ? 'IN_REVIEW' : 'RESTRICTED';
  return { account, capabilities, requirements, connectStatus };
}
