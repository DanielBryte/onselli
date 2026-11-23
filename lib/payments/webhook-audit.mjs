const common = (event) => ({
  id: event.id,
  type: event.type,
  ...(event.created_at ? { created_at: event.created_at } : {}),
  ...(event.account ? { account: event.account } : {}),
  ...(event.organization_id ? { organization_id: event.organization_id } : {}),
});

const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source?.[key] !== undefined).map((key) => [key, source[key]]));

export function createBachsWebhookAuditPayload(event) {
  const base = common(event);
  const data = event.data ?? {};
  let safeData = {};
  if (event.type?.startsWith('checkout.') || event.type?.startsWith('collection.')) {
    safeData = pick(data, ['checkout_id', 'charge_id', 'reference', 'status', 'amount', 'currency', 'fee', 'total_debited', 'source_currency']);
    if (data.charge) safeData.charge = pick(data.charge, ['id', 'status']);
  } else if (event.type === 'refund.created' || event.type === 'refund.paid' || event.type === 'refund.failed') {
    safeData = pick(data, ['refund_id', 'charge_id', 'reference', 'status', 'requested_amount', 'refunded_amount']);
  } else if (event.type === 'dispute.created' || event.type === 'dispute.updated') {
    safeData = pick(data, ['dispute_id', 'charge_id', 'amount', 'currency', 'status', 'response_deadline_at', 'charge_amount', 'charge_currency', 'is_response_editable']);
  } else if (event.type === 'payout.paid' || event.type === 'payout.failed') {
    safeData = pick(data, ['id', 'payout_id', 'reference', 'status']);
  } else if (event.type === 'transfer.created') {
    safeData = pick(data, ['transfer_id', 'source', 'destination', 'amount', 'currency', 'kind', 'source_charge_id']);
  } else if (event.type === 'account.updated' || event.type === 'capability.updated') {
    safeData = pick(data, ['id', 'capability', 'status']);
  } else if (event.type?.startsWith('customer.subscription.') || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    safeData = pick(data, ['id', 'subscription_id', 'status', 'current_period_end', 'period_end', 'cancel_at_period_end', 'product_id', 'reference']);
  }
  return { ...base, data: safeData };
}

export function createVerifiedPaymentAuditSnapshot({ checkoutId, reference, status, paymentStatus, amount, currency, charge, platformFee }) {
  return {
    checkout_id: checkoutId,
    reference,
    status,
    payment_status: paymentStatus,
    amount,
    currency,
    charge: pick(charge, ['id', 'payment_id', 'status', 'amount', 'currency']),
    platform_fee: platformFee,
  };
}
