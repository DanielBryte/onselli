export function validateExternalDownloadUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || value !== value.trim() || /[\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** @param {{ product: any, entitlement: any, order: any, userId?: string | null, guestBuyerId?: string | null }} input */
export function getAuthorizedExternalDownload({ product, entitlement, order, userId = null, guestBuyerId = null }) {
  if (!product || product.type !== 'download' || product.downloadDeliveryMode !== 'external_link') return null;
  const principalMatches = userId ? entitlement?.userId === userId && order?.buyerUserId === userId
    : Boolean(guestBuyerId && entitlement?.guestBuyerId === guestBuyerId && order?.guestBuyerId === guestBuyerId);
  if (!entitlement || entitlement.status !== 'active' || !principalMatches || entitlement.productId !== product.id) return null;
  if (!order || order.id !== entitlement.orderId || order.status !== 'paid') return null;
  return validateExternalDownloadUrl(product.downloadExternalUrl);
}
