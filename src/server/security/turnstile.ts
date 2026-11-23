import { getEnv } from '../config/env';

export async function verifyTurnstile(token: string | undefined, remoteIp?: string) {
  const secret = getEnv().TURNSTILE_SECRET_KEY;
  if (!secret) return getEnv().NODE_ENV !== 'production';
  if (!token) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, cache: 'no-store' });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}
