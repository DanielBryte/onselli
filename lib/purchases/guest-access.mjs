import { createHash, randomBytes } from 'node:crypto';

export function createGuestToken() { return randomBytes(32).toString('base64url'); }
export function hashGuestToken(token) { return createHash('sha256').update(token).digest('hex'); }
export function isGuestTokenUsable(token, now = Date.now()) {
  return Boolean(token && typeof token.tokenHash === 'string' && token.usedAt == null && new Date(token.expiresAt).getTime() > now);
}
export function normalizeBuyerEmail(value) {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function matchesGuestPurchasePrincipal({ guestBuyerId, entitlement, order }) {
  return Boolean(guestBuyerId && entitlement?.guestBuyerId === guestBuyerId && order?.guestBuyerId === guestBuyerId
    && entitlement?.userId == null && order?.buyerUserId == null && entitlement?.status === 'active'
    && order?.status === 'paid' && entitlement?.orderId === order?.id);
}
export function canClaimGuestPurchase({ sessionUser, guestBuyer, accessSession, now = Date.now() }) {
  return Boolean(sessionUser?.emailVerified && guestBuyer?.emailVerifiedAt
    && sessionUser.email?.trim().toLowerCase() === guestBuyer.email?.trim().toLowerCase()
    && accessSession?.guestBuyerId === guestBuyer?.id && accessSession.revokedAt == null
    && new Date(accessSession.expiresAt).getTime() > now);
}
