import test from 'node:test';
import assert from 'node:assert/strict';
import { canClaimGuestPurchase, createGuestToken, hashGuestToken, isGuestTokenUsable, matchesGuestPurchasePrincipal, normalizeBuyerEmail } from '../lib/purchases/guest-access.mjs';
import { canDownloadProductFile } from '../lib/storage/product-file-rules.mjs';
import { getAuthorizedExternalDownload } from '../lib/storage/external-download.mjs';
import { canAccessHostedVideo } from '../lib/courses/bunny-stream.mjs';
import { canAccessLessonResource } from '../lib/courses/curriculum-rules.mjs';
import { canUpdateLessonProgress } from '../lib/courses/learner-progress.mjs';
import { canAccessCourseQuiz } from '../lib/courses/quizzes.mjs';

test('guest access tokens are high entropy and stored as one-way hashes', () => {
  const token = createGuestToken();
  assert.equal(Buffer.from(token, 'base64url').byteLength, 32);
  assert.notEqual(hashGuestToken(token), token);
  assert.equal(hashGuestToken(token), hashGuestToken(token));
  assert.notEqual(hashGuestToken(token), hashGuestToken(createGuestToken()));
});

test('guest access token rejects used and expired links', () => {
  const expiresAt = new Date(10_000);
  assert.equal(isGuestTokenUsable({ tokenHash: 'digest', usedAt: null, expiresAt }, 9_999), true);
  assert.equal(isGuestTokenUsable({ tokenHash: 'digest', usedAt: new Date(1), expiresAt }, 9_999), false);
  assert.equal(isGuestTokenUsable({ tokenHash: 'digest', usedAt: null, expiresAt }, 10_000), false);
});

test('checkout email is normalized and invalid values are rejected', () => {
  assert.equal(normalizeBuyerEmail('  Buyer@Example.COM '), 'buyer@example.com');
  for (const value of ['', 'not an email', 'buyer@local', 'a'.repeat(255) + '@example.com']) assert.equal(normalizeBuyerEmail(value), null);
});

test('guest principal needs a paid order and active grant in the same guest identity', () => {
  const guestBuyerId = 'guest-1';
  const entitlement = { guestBuyerId, userId: null, status: 'active', orderId: 'order-1' };
  const order = { guestBuyerId, buyerUserId: null, status: 'paid', id: 'order-1' };
  assert.equal(matchesGuestPurchasePrincipal({ guestBuyerId, entitlement, order }), true);
  assert.equal(matchesGuestPurchasePrincipal({ guestBuyerId, entitlement, order: { ...order, status: 'pending' } }), false);
  assert.equal(matchesGuestPurchasePrincipal({ guestBuyerId: 'other-guest', entitlement, order }), false);
  assert.equal(matchesGuestPurchasePrincipal({ guestBuyerId, entitlement: { ...entitlement, status: 'revoked' }, order }), false);
});

test('guest access works across purchases, downloads, course media, progress, and quizzes only for its verified order principal', () => {
  const guestBuyerId = 'guest-1';
  const product = { id: 'course-1', creatorId: 'creator-1', type: 'course', status: 'published' };
  const lesson = { id: 'lesson-1', creatorId: 'creator-1', sectionId: 'section-1', type: 'video', status: 'published', deletedAt: null, bunnyVideoId: 'video-1', videoStatus: 'ready' };
  const section = { id: 'section-1', productId: product.id, creatorId: product.creatorId, status: 'published' };
  const order = { id: 'order-1', buyerUserId: null, guestBuyerId, status: 'paid' };
  const entitlement = { orderId: order.id, userId: null, guestBuyerId, productId: product.id, creatorId: product.creatorId, status: 'active' };
  assert.equal(canAccessHostedVideo({ product, lesson, entitlement, order, guestBuyerId }), true);
  assert.equal(canUpdateLessonProgress({ guestBuyerId, entitlement, order, product, section, lesson }), true);
  assert.equal(canAccessCourseQuiz({ guestBuyerId, product, section, lesson: { ...lesson, type: 'quiz' }, quiz: { lessonId: lesson.id, creatorId: product.creatorId }, entitlement, order }), true);
  assert.equal(canAccessHostedVideo({ product, lesson, entitlement, order, guestBuyerId: 'guest-2' }), false);

  const file = { creatorId: product.creatorId, productId: 'download-1', status: 'ready' };
  const download = { id: 'download-1', creatorId: product.creatorId, type: 'download', downloadDeliveryMode: 'external_link', downloadExternalUrl: 'https://files.example.com/guide' };
  const downloadEntitlement = { ...entitlement, productId: download.id };
  assert.equal(canDownloadProductFile({ file, entitlement: downloadEntitlement, order, guestBuyerId }), true);
  assert.equal(getAuthorizedExternalDownload({ product: download, entitlement: downloadEntitlement, order, guestBuyerId }), download.downloadExternalUrl);
  const resource = { status: 'ready', creatorId: product.creatorId, lessonId: lesson.id };
  assert.equal(canAccessLessonResource({ resource, lesson, product, section, entitlement, order, guestBuyerId }), true);
  assert.equal(canAccessLessonResource({ resource, lesson, product, section, entitlement, order, guestBuyerId: 'guest-2' }), false);
});

test('account claim requires a verified matching account and valid guest session', () => {
  const sessionUser = { email: 'Buyer@Example.com', emailVerified: true };
  const guestBuyer = { id: 'guest-1', email: 'buyer@example.com', emailVerifiedAt: new Date() };
  const accessSession = { guestBuyerId: 'guest-1', revokedAt: null, expiresAt: new Date(Date.now() + 60_000) };
  assert.equal(canClaimGuestPurchase({ sessionUser, guestBuyer, accessSession }), true);
  assert.equal(canClaimGuestPurchase({ sessionUser: { ...sessionUser, emailVerified: false }, guestBuyer, accessSession }), false);
  assert.equal(canClaimGuestPurchase({ sessionUser, guestBuyer: { ...guestBuyer, email: 'attacker@example.com' }, accessSession }), false);
  assert.equal(canClaimGuestPurchase({ sessionUser, guestBuyer, accessSession: { ...accessSession, revokedAt: new Date() } }), false);
});
