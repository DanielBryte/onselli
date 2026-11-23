/** Normalize a phone for contact matching. Production callers should use libphonenumber-js before persistence. */
export function normalizePhone(value: string, defaultCountryCode = '234') {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (value.trim().startsWith('+')) return `+${digits}`;
  const local = digits.replace(/^0+/, '');
  return `+${defaultCountryCode}${local}`;
}

export function normalizeEmail(value: string | null | undefined) {
  const email = value?.trim().toLowerCase();
  return email || null;
}
