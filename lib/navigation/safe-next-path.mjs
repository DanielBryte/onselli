/** Return a same-origin path for auth redirects, or null for untrusted input. */
export function getSafeNextPath(value, origin) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  try {
    const base = new URL(origin);
    const target = new URL(value, base);
    return target.origin === base.origin ? `${target.pathname}${target.search}${target.hash}` : null;
  } catch {
    return null;
  }
}
