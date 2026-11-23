export const MAX_BUNDLE_PRODUCTS = 20;

export function validateBundleComposition({ bundleProductId, creatorId, currency, selectedIds, products }) {
  if (!Array.isArray(selectedIds) || selectedIds.length < 2 || selectedIds.length > MAX_BUNDLE_PRODUCTS) return 'Choose 2 to 20 products for this bundle.';
  if (new Set(selectedIds).size !== selectedIds.length) return 'A product can only appear once in a bundle.';
  if (selectedIds.includes(bundleProductId)) return 'A bundle cannot contain itself.';
  const byId = new Map((Array.isArray(products) ? products : []).map((product) => [product.id, product]));
  for (const id of selectedIds) {
    const product = byId.get(id);
    if (!product) return 'One or more selected products could not be found in this workspace.';
    if (product.creatorId !== creatorId) return 'A bundle can only contain products from this workspace.';
    if (product.id === bundleProductId || product.type === 'bundle') return 'Bundles cannot contain other bundles.';
    if (product.type !== 'course' && product.type !== 'download') return 'Only courses and digital downloads can be added to a bundle.';
    if (product.status !== 'published') return 'Every included product must be published.';
    if (product.amountType && product.amountType !== 'fixed') return 'Only fixed-price, one-time products can be included in bundles.';
    if (product.currency !== currency) return `Included products must use the bundle currency (${currency}).`;
    if (product.type === 'download' && product.deliveryReady === false) return 'Every download needs a ready delivery method before it can be bundled.';
    if (product.type === 'course' && product.courseReady === false) return 'Every course needs a published lesson before it can be bundled.';
  }
  return null;
}

export function snapshotBundleContents(products) {
  return products.map((product, position) => ({
    productIdSnapshot: product.id,
    productTypeSnapshot: product.type,
    titleSnapshot: product.title,
    currencySnapshot: product.currency,
    priceMinorSnapshot: String(product.priceMinor),
    position,
  }));
}

export function bundleEntitlementProductIds(contents) {
  return [...new Set((Array.isArray(contents) ? contents : [])
    .filter((item) => item && (item.productTypeSnapshot === 'course' || item.productTypeSnapshot === 'download') && typeof item.productIdSnapshot === 'string')
    .map((item) => item.productIdSnapshot))];
}

export function shouldRevokeOrderEntitlements({ outcome }) {
  return outcome === 'refund_paid' || outcome === 'dispute_lost';
}
