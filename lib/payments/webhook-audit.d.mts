export function createBachsWebhookAuditPayload(event: any): Record<string, unknown>;
export function createVerifiedPaymentAuditSnapshot(input: {
  checkoutId: string; reference: string | null; status: string; paymentStatus?: string | null;
  amount: string; currency: string; charge?: Record<string, unknown> | null; platformFee?: string | null;
}): Record<string, unknown>;
