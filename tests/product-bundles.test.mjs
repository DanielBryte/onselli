import test from 'node:test';
import assert from 'node:assert/strict';
import { bundleEntitlementProductIds, shouldRevokeOrderEntitlements, snapshotBundleContents, validateBundleComposition } from '../lib/bundles/rules.mjs';

const products = [
  { id: 'course-1', creatorId: 'creator-1', type: 'course', title: 'Design course', status: 'published', currency: 'NGN', priceMinor: 250000n, amountType: 'fixed', courseReady: true },
  { id: 'download-1', creatorId: 'creator-1', type: 'download', title: 'Template pack', status: 'published', currency: 'NGN', priceMinor: 45000n, amountType: 'fixed', deliveryReady: true },
];
const validInput = { bundleProductId: 'bundle-1', creatorId: 'creator-1', currency: 'NGN', selectedIds: ['course-1', 'download-1'], products };

test('bundle composition allows only distinct, published, ready, same-workspace one-time courses and downloads', () => {
  assert.equal(validateBundleComposition(validInput), null);
  assert.match(validateBundleComposition({ ...validInput, selectedIds: ['course-1'] }), /2 to 20/i);
  assert.match(validateBundleComposition({ ...validInput, selectedIds: [] }), /2 to 20/i);
  assert.match(validateBundleComposition({ ...validInput, selectedIds: ['course-1', 'course-1'] }), /once/i);
  assert.match(validateBundleComposition({ ...validInput, products: [...products, { id: 'bundle-child', creatorId: 'creator-1', type: 'bundle', status: 'published', currency: 'NGN' }], selectedIds: ['course-1', 'bundle-child'] }), /other bundles/i);
  assert.match(validateBundleComposition({ ...validInput, products: [...products, { id: 'link', creatorId: 'creator-1', type: 'payment_link', status: 'published', currency: 'NGN' }], selectedIds: ['course-1', 'link'] }), /only courses/i);
  assert.match(validateBundleComposition({ ...validInput, products: [{ ...products[0], status: 'archived' }, products[1]] }), /published/i);
  assert.match(validateBundleComposition({ ...validInput, products: [{ ...products[0], creatorId: 'creator-2' }, products[1]] }), /this workspace/i);
  assert.match(validateBundleComposition({ ...validInput, products: [{ ...products[0], currency: 'USD' }, products[1]] }), /bundle currency/i);
  assert.match(validateBundleComposition({ ...validInput, products: [{ ...products[0], courseReady: false }, products[1]] }), /published lesson/i);
  assert.match(validateBundleComposition({ ...validInput, products: [{ ...products[0], amountType: 'customer_chooses' }, products[1]] }), /fixed-price/i);
});

test('bundle purchase snapshots preserve included ids, names, types, list prices, and order', () => {
  const snapshot = snapshotBundleContents(products.map((product) => ({ ...product })));
  assert.deepEqual(snapshot, [
    { productIdSnapshot: 'course-1', productTypeSnapshot: 'course', titleSnapshot: 'Design course', currencySnapshot: 'NGN', priceMinorSnapshot: '250000', position: 0 },
    { productIdSnapshot: 'download-1', productTypeSnapshot: 'download', titleSnapshot: 'Template pack', currencySnapshot: 'NGN', priceMinorSnapshot: '45000', position: 1 },
  ]);
  products[0].title = 'Renamed course'; products[0].priceMinor = 999n;
  assert.equal(snapshot[0].titleSnapshot, 'Design course'); assert.equal(snapshot[0].priceMinorSnapshot, '250000');
});

test('verified bundle fulfillment grants unique eligible products and refund/dispute outcomes revoke order-scoped grants', () => {
  assert.deepEqual(bundleEntitlementProductIds([{ productIdSnapshot: 'course-1', productTypeSnapshot: 'course' }, { productIdSnapshot: 'download-1', productTypeSnapshot: 'download' }, { productIdSnapshot: 'download-1', productTypeSnapshot: 'download' }, { productIdSnapshot: 'link-1', productTypeSnapshot: 'payment_link' }]), ['course-1', 'download-1']);
  assert.equal(shouldRevokeOrderEntitlements({ outcome: 'refund_paid' }), true);
  assert.equal(shouldRevokeOrderEntitlements({ outcome: 'dispute_lost' }), true);
  assert.equal(shouldRevokeOrderEntitlements({ outcome: 'dispute_under_review' }), false);
  assert.equal(shouldRevokeOrderEntitlements({ outcome: 'refund_failed' }), false);
});
