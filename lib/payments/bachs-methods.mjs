const fiatMethods = {
  USD: ['USD_CARD'],
  NGN: ['NGN_CARD', 'NGN_BANK_TRANSFER'],
  GHS: ['MOMO_GHS'],
  KES: ['MOMO_KES'],
  TZS: ['MOMO_TZS'],
  UGX: ['MOMO_UGX'],
  XAF: ['MOMO_XAF'],
  XOF: ['MOMO_XOF'],
  RWF: ['MOMO_RWF'],
  MWK: ['MOMO_MWK'],
  ZMW: ['MOMO_ZMW'],
};

function isMethodConfigured(method, currencies, configured, available) {
  const methodConfig = configured[method];
  if (methodConfig?.enabled !== true) return false;
  const availableForMethod = available[method];
  const configuredCurrencies = methodConfig.currencies;

  return currencies.some((currency) => {
    if (Array.isArray(availableForMethod) && !availableForMethod.includes(currency)) return false;
    if (configuredCurrencies && typeof configuredCurrencies === 'object' && configuredCurrencies[currency] !== true) return false;
    // Some Bachs accounts expose only an enabled flag. In that response, the
    // provider remains authoritative about whether the method can collect this currency.
    return true;
  });
}

/** Select only payment methods enabled for this Bachs account and currency. */
export function selectBachsPaymentMethods(settings, currency, options = {}) {
  const accountId = typeof settings?.organization_id === 'string' ? settings.organization_id : '';
  if (options.platformAccountId && accountId !== options.platformAccountId) {
    throw new Error('Bachs checkout settings do not match the configured platform account.');
  }

  const currencyCode = typeof currency === 'string' ? currency.toUpperCase() : '';
  const configured = settings?.enabled_payment_methods ?? {};
  const available = settings?.available_currencies ?? {};
  const currencies = options.includeAdaptiveCurrencies === true && currencyCode === 'USD' && settings?.adaptive_pricing === true
    ? Object.keys(fiatMethods)
    : [currencyCode];

  const methods = [...new Set(currencies.flatMap((code) => fiatMethods[code] ?? []).filter((method) => {
    const supportedCurrencies = currencies.filter((code) => fiatMethods[code]?.includes(method));
    return isMethodConfigured(method, supportedCurrencies, configured, available);
  }))];

  const crypto = configured.CRYPTO;
  const availableCrypto = available.CRYPTO;
  const cryptoAssets = Object.entries(crypto?.currencies ?? {})
    .filter(([asset, enabled]) => enabled === true && (!Array.isArray(availableCrypto) || availableCrypto.includes(asset)))
    .map(([asset]) => asset);
  if (crypto?.enabled === true && cryptoAssets.length) methods.push('CRYPTO');
  if (!methods.length) throw new Error(`No Bachs payment method is enabled for ${currencyCode || 'this currency'}. Contact support to enable a payment method for this currency.`);
  return { methods, cryptoAssets };
}
