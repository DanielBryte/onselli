import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeProductDescription, serializeProductDescription } from '../lib/product-description.mjs';
import { getSafeNextPath } from '../lib/navigation/safe-next-path.mjs';
import { selectBachsPaymentMethods } from '../lib/payments/bachs-methods.mjs';

test('normalizes legacy and structured descriptions without stringifying objects', () => {
  assert.equal(normalizeProductDescription('A course description'), 'A course description');
  assert.equal(normalizeProductDescription({ schemaVersion: 1, text: 'Structured description' }), 'Structured description');
  assert.equal(normalizeProductDescription({ schemaVersion: 1, text: { value: 'nested' } }), '');
  assert.equal(normalizeProductDescription({ schemaVersion: 1 }), '');
  assert.equal(normalizeProductDescription(['description']), '');
  assert.deepEqual(serializeProductDescription('  Course  '), { schemaVersion: 1, text: '  Course  ' });
});

test('auth next paths preserve same-origin paths and reject external or malformed destinations', () => {
  const origin = 'https://onselli.example';
  assert.equal(getSafeNextPath('/c/studio/course?ref=checkout', origin), '/c/studio/course?ref=checkout');
  assert.equal(getSafeNextPath('//attacker.example/path', origin), null);
  assert.equal(getSafeNextPath('https://attacker.example/path', origin), null);
  assert.equal(getSafeNextPath('/\\attacker.example', origin), null);
  assert.equal(getSafeNextPath(null, origin), null);
});

test('Bachs methods are limited to the account-enabled methods and supported currencies', () => {
  const settings = {
    organization_id: 'platform_account',
    enabled_payment_methods: {
      NGN_CARD: { enabled: true, currencies: { NGN: true } },
      NGN_BANK_TRANSFER: { enabled: true, currencies: { NGN: true } },
      USD_CARD: { enabled: false, currencies: { USD: true } },
    },
    available_currencies: { NGN_CARD: ['NGN'], NGN_BANK_TRANSFER: [] },
  };
  assert.deepEqual(selectBachsPaymentMethods(settings, 'NGN', { platformAccountId: 'platform_account' }), {
    methods: ['NGN_CARD'],
    cryptoAssets: [],
  });
  assert.throws(() => selectBachsPaymentMethods(settings, 'NGN', { platformAccountId: 'another_account' }), /do not match/);
});

test('Bachs adaptive currencies require account adaptive pricing and enabled local methods', () => {
  const settings = {
    organization_id: 'platform_account',
    adaptive_pricing: true,
    enabled_payment_methods: {
      USD_CARD: { enabled: true, currencies: { USD: true } },
      MOMO_GHS: { enabled: true, currencies: { GHS: true } },
      MOMO_KES: { enabled: false, currencies: { KES: true } },
      CRYPTO: { enabled: true, currencies: { USDC_SOL: true, UNSUPPORTED: false } },
    },
    available_currencies: { USD_CARD: ['USD'], MOMO_GHS: ['GHS'], MOMO_KES: ['KES'], CRYPTO: ['USDC_SOL'] },
  };
  assert.deepEqual(selectBachsPaymentMethods(settings, 'USD', { includeAdaptiveCurrencies: false }).methods, ['USD_CARD', 'CRYPTO']);
  assert.deepEqual(selectBachsPaymentMethods(settings, 'USD', { includeAdaptiveCurrencies: true }).methods, ['USD_CARD', 'MOMO_GHS', 'CRYPTO']);
  assert.deepEqual(selectBachsPaymentMethods(settings, 'USD', { includeAdaptiveCurrencies: true }).cryptoAssets, ['USDC_SOL']);
  assert.throws(() => selectBachsPaymentMethods({ organization_id: 'platform_account' }, 'NGN'), /No Bachs payment method/);
});
