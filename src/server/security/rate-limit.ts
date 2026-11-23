import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';
import { getEnv } from '../config/env';

let limiter: Ratelimit | null | undefined;
function getLimiter() {
  if (limiter !== undefined) return limiter;
  const env = getEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) return (limiter = null);
  limiter = new Ratelimit({ redis: new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }), limiter: Ratelimit.slidingWindow(20, '1 m'), analytics: true, prefix: 'onselli:public' });
  return limiter;
}

export async function checkPublicRateLimit(key: string) {
  const service = getLimiter();
  if (!service) {
    if (getEnv().NODE_ENV === 'production') throw new Error('Public endpoint rate limiting is not configured.');
    return { success: true, limit: 20, remaining: 20, reset: Date.now() + 60_000 };
  }
  return service.limit(key);
}
