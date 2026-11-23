/** Whether a creator balance can fund a payout destination through Bachs. */
export function isPayoutSourceAllowed(sourceCurrency, destinationCurrency) {
  const source = String(sourceCurrency).toUpperCase();
  const destination = String(destinationCurrency).toUpperCase();
  if (destination === 'NGN') return source === 'NGN' || source === 'USD';
  return source === 'USD';
}
