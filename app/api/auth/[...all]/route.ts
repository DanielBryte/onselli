import { toNextJsHandler } from 'better-auth/next-js';
import { sql } from 'drizzle-orm';
import { auth } from '@/src/server/auth';
import { getDatabase } from '@/src/server/db';
import { users } from '@/src/server/db/schema';
import { checkPublicRateLimit } from '@/src/server/security/rate-limit';

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

export async function POST(request: Request) {
  const isEmailSignup = new URL(request.url).pathname.endsWith('/sign-up/email');
  let existingEmail = false;
  let normalizedEmail: string | null = null;

  // Rate-limit before checking for an account so the duplicate response cannot
  // be used as an unrestricted email-enumeration endpoint.
  if (isEmailSignup) {
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    try {
      const limit = await checkPublicRateLimit(`auth-sign-up:${address}`);
      if (!limit.success) {
        return Response.json({ code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Wait a little and try again.' }, {
          status: 429,
          headers: { 'cache-control': 'no-store' },
        });
      }
    } catch {
      return Response.json({ code: 'SERVICE_UNAVAILABLE', message: 'Account creation is temporarily unavailable. Please try again shortly.' }, {
        status: 503,
        headers: { 'cache-control': 'no-store' },
      });
    }

    // Record only whether the normalized address already exists. Better Auth
    // still handles validation, origin checks, its own throttling, and hashing.
    try {
      const body = await request.clone().json() as { email?: unknown };
      if (typeof body.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
        normalizedEmail = body.email.trim().toLowerCase();
        const [match] = await getDatabase().select({ id: users.id }).from(users)
          .where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);
        existingEmail = Boolean(match);
      }
    } catch {
      // Let Better Auth return its normal validation or database error.
    }
  }

  const response = await handlers.POST(request);
  if (!isEmailSignup || !normalizedEmail || !response.ok) return response;

  if (!existingEmail) {
    // Handle concurrent attempts too: a synthetic duplicate response carries
    // a generated user id, while a newly created account returns its DB id.
    try {
      const result = await response.clone().json() as { user?: { id?: unknown } };
      const [account] = await getDatabase().select({ id: users.id }).from(users)
        .where(sql`lower(${users.email}) = ${normalizedEmail}`).limit(1);
      existingEmail = Boolean(account && result.user?.id !== account.id);
    } catch {
      return response;
    }
  }

  if (!existingEmail) return response;

  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  headers.delete('content-length');
  return new Response(JSON.stringify({
    code: 'USER_ALREADY_EXISTS',
    message: 'An account with this email already exists. Please log in.',
  }), { status: 409, headers });
}
