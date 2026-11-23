export function generateProductSlug(): string {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(10));
    for (let i = 0; i < 10; i++) {
      result += chars[(bytes[i] ?? 0) % chars.length];
    }
  } else {
    for (let i = 0; i < 10; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  return result;
}
