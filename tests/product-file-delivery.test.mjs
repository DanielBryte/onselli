import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canDownloadProductFile,
  getDeliverableProductFiles,
  ownsProductFile,
  validateProductFileCompletion,
} from '../lib/storage/product-file-rules.mjs';
import { getAuthorizedExternalDownload, validateExternalDownloadUrl } from '../lib/storage/external-download.mjs';

const owner = { creatorId: 'creator-a', productId: 'product-a' };
const file = { id: 'file-a', creatorId: owner.creatorId, productId: owner.productId, status: 'pending', name: 'guide.pdf', sizeBytes: 8n, contentType: 'application/pdf' };

test('file ownership is scoped to both creator and product', () => {
  assert.equal(ownsProductFile(file, owner), true);
  assert.equal(ownsProductFile(file, { ...owner, creatorId: 'creator-b' }), false);
  assert.equal(ownsProductFile(file, { ...owner, productId: 'product-b' }), false);
});

test('upload completion requires exact size, expected MIME and matching file signature', () => {
  const pdf = new TextEncoder().encode('%PDF-1.7');
  const valid = { contentLength: 8, contentType: 'application/pdf', signatureBytes: pdf };
  assert.equal(validateProductFileCompletion(file, valid, 100), null);
  assert.match(validateProductFileCompletion(file, { ...valid, contentLength: 9 }, 100), /size/i);
  assert.match(validateProductFileCompletion(file, { ...valid, contentType: 'text/plain' }, 100), /type/i);
  assert.match(validateProductFileCompletion(file, { ...valid, signatureBytes: new TextEncoder().encode('not pdf!') }, 100), /content/i);
  assert.match(validateProductFileCompletion(file, valid, 7), /size/i);
});

test('download needs a ready file, active entitlement, and the buyer’s linked paid order', () => {
  const readyFile = { ...file, status: 'ready' };
  const entitlement = { id: 'entitlement-a', userId: 'buyer-a', productId: owner.productId, orderId: 'order-a', status: 'active' };
  const order = { id: 'order-a', buyerUserId: 'buyer-a', status: 'paid' };
  assert.equal(canDownloadProductFile({ file: readyFile, entitlement, order, userId: 'buyer-a' }), true);
  assert.equal(canDownloadProductFile({ file: readyFile, entitlement: { ...entitlement, status: 'revoked' }, order, userId: 'buyer-a' }), false);
  assert.equal(canDownloadProductFile({ file: readyFile, entitlement, order: { ...order, status: 'pending' }, userId: 'buyer-a' }), false);
  assert.equal(canDownloadProductFile({ file: readyFile, entitlement, order: { ...order, buyerUserId: 'buyer-b' }, userId: 'buyer-a' }), false);
  assert.equal(canDownloadProductFile({ file: { ...readyFile, status: 'pending' }, entitlement, order, userId: 'buyer-a' }), false);
});

test('buyer delivery returns every ready file owned by the entitled product', () => {
  const files = [
    { id: '1', ...owner, status: 'ready' },
    { id: '2', ...owner, status: 'ready' },
    { id: '3', ...owner, status: 'pending' },
    { id: '4', creatorId: 'creator-b', productId: owner.productId, status: 'ready' },
    { id: '5', creatorId: owner.creatorId, productId: 'product-b', status: 'ready' },
  ];
  assert.deepEqual(getDeliverableProductFiles(files, owner).map((item) => item.id), ['1', '2']);
});

test('external download links accept only well-formed HTTPS URLs without credentials', () => {
  assert.equal(validateExternalDownloadUrl('https://files.example.com/get?id=123'), 'https://files.example.com/get?id=123');
  for (const unsafe of [
    'javascript:alert(1)', 'data:text/html,hello', 'http://files.example.com/file',
    'https://user:pass@files.example.com/file', 'https://files.example.com/has space',
    'https://', 'not a url', ' https://files.example.com/file',
  ]) assert.equal(validateExternalDownloadUrl(unsafe), null, `${unsafe} should be rejected`);
});

test('external download URL is disclosed only after an active entitlement and its own paid order', () => {
  const product = { id: 'product-a', type: 'download', downloadDeliveryMode: 'external_link', downloadExternalUrl: 'https://files.example.com/get?id=123' };
  const entitlement = { id: 'entitlement-a', userId: 'buyer-a', productId: 'product-a', orderId: 'order-a', status: 'active' };
  const order = { id: 'order-a', buyerUserId: 'buyer-a', status: 'paid' };
  const access = { product, entitlement, order, userId: 'buyer-a' };
  assert.equal(getAuthorizedExternalDownload({ ...access, entitlement: null }), null);
  assert.equal(getAuthorizedExternalDownload({ ...access, entitlement: { ...entitlement, status: 'revoked' } }), null);
  assert.equal(getAuthorizedExternalDownload({ ...access, order: { ...order, status: 'pending' } }), null);
  assert.equal(getAuthorizedExternalDownload({ ...access, order: { ...order, buyerUserId: 'buyer-b' } }), null);
  assert.equal(getAuthorizedExternalDownload({ ...access, userId: 'buyer-b' }), null);
  assert.equal(getAuthorizedExternalDownload({ ...access, product: { ...product, downloadDeliveryMode: 'uploaded_files' } }), null);
  assert.equal(getAuthorizedExternalDownload(access), 'https://files.example.com/get?id=123');
});
