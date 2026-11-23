export type ExternalDownloadProduct = {
  id: string;
  type: string;
  downloadDeliveryMode: string;
  downloadExternalUrl: string | null;
};
export function validateExternalDownloadUrl(value: unknown): string | null;
export function getAuthorizedExternalDownload(input: {
  product: ExternalDownloadProduct | null | undefined;
  entitlement: { status: string; userId: string | null; guestBuyerId?: string | null; productId: string; orderId: string } | null | undefined;
  order: { id: string; status: string; buyerUserId: string | null; guestBuyerId?: string | null } | null | undefined;
  userId?: string | null;
  guestBuyerId?: string | null;
}): string | null;
