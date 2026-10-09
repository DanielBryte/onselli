import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyBachsWebhook(rawBody: string, timestampHeader: string | null, signatureHeader: string | null, secret: string) {
  if (!timestampHeader || !signatureHeader || !/^\d+$/.test(timestampHeader)) return false;
  const timestamp = Number(timestampHeader);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const candidates = signatureHeader.split(',').flatMap(value => {
    const match = value.trim().match(/^(?:v1=)?([a-f0-9]{64})$/i);
    return match ? [match[1]] : [];
  });
  return candidates.some(candidate => {
    if (!candidate) return false;
    const a = Buffer.from(expected, 'hex'); const b = Buffer.from(candidate, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
