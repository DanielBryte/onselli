/** Convert an NGN decimal string to the integer minor unit without floats. */
export function nairaToKobo(value) {
  const amount = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) throw new Error('Amount must be a non-negative decimal with at most two places.');
  const minor = BigInt(match[1] ?? '0') * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large.');
  return Number(minor);
}

export function koboToDecimal(minor) {
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Minor amount must be a non-negative safe integer.');
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

/** Return the ISO 4217 minor-unit scale for a currency (for example UGX=1, USD=100). */
export function currencyScale(currency) {
  const code = String(currency).toUpperCase();
  const digits = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
  return 10 ** digits;
}

/** True when an integer minor-unit amount is safe for the app's numeric fee math. */
export function isSafeMinorAmount(value) {
  return typeof value === 'bigint' && value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER);
}

/** Convert a decimal amount to the currency's integer minor unit without float arithmetic. */
export function decimalToCurrencyMinor(value, currency) {
  const scale = currencyScale(currency);
  const digits = Math.round(Math.log10(scale));
  const amount = String(value).trim();
  const pattern = digits === 0 ? /^(\d+)$/ : new RegExp(`^(\\d+)(?:\\.(\\d{1,${digits}}))?$`);
  const match = pattern.exec(amount);
  if (!match) throw new Error(`Amount must have at most ${digits} decimal places for ${currency}.`);
  const minor = BigInt(match[1] ?? '0') * BigInt(scale) + BigInt((match[2] ?? '').padEnd(digits, '0') || '0');
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount is too large.');
  return minor;
}

/** Convert integer minor units to a provider-safe decimal string. */
export function currencyMinorToDecimal(minor, currency) {
  const value = BigInt(minor);
  const scale = BigInt(currencyScale(currency));
  const digits = Math.round(Math.log10(Number(scale)));
  return digits ? `${value / scale}.${String(value % scale).padStart(digits, '0')}` : String(value);
}

/** Parse an API decimal as integer minor units. */
export function currencyDecimalToMinor(value, currency) {
  return decimalToCurrencyMinor(value, currency);
}

/** Apply positive basis points with round-half-up semantics using integer math. */
export function roundBasisPoints(amountMinor, basisPoints) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || !Number.isInteger(basisPoints) || basisPoints < 0) {
    throw new Error('Amount and basis points must be non-negative integers.');
  }
  return Number((BigInt(amountMinor) * BigInt(basisPoints) + 5000n) / 10000n);
}
