import { and, eq, isNull, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { entitlements, guestAccessSessions, guestBuyers, lessonProgress, orders, quizAttempts } from '@/src/server/db/schema';
import { GUEST_ACCESS_COOKIE } from '@/src/server/purchases/guest-access';
import { canClaimGuestPurchase, hashGuestToken } from '@/lib/purchases/guest-access.mjs';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export async function POST() {
  const session = await getCurrentSession();
  if (!session?.user || !(session.user as typeof session.user & { emailVerified?: boolean }).emailVerified) return NextResponse.json({ error: 'Sign in with a verified Onselli account using the same email as your purchase.' }, { status: 401 });
  const raw = (await cookies()).get(GUEST_ACCESS_COOKIE)?.value;
  if (!raw) return NextResponse.json({ error: 'Open your verified purchase link first, then try linking your account.' }, { status: 400 });
  const tokenHash = hashGuestToken(raw);
  const db = getDatabase();
  try {
    await db.transaction(async (tx) => {
      const [access] = await tx.select({ guestBuyerId: guestAccessSessions.guestBuyerId, email: guestBuyers.email, verified: guestBuyers.emailVerifiedAt, expiresAt: guestAccessSessions.expiresAt, revokedAt: guestAccessSessions.revokedAt }).from(guestAccessSessions).innerJoin(guestBuyers, eq(guestAccessSessions.guestBuyerId, guestBuyers.id)).where(and(eq(guestAccessSessions.tokenHash, tokenHash), isNull(guestAccessSessions.revokedAt), sql`${guestAccessSessions.expiresAt} > now()`)).for('update');
      const appUser = session.user as typeof session.user & { emailVerified?: boolean };
      if (!access || !canClaimGuestPurchase({ sessionUser: { email: appUser.email, emailVerified: appUser.emailVerified }, guestBuyer: { id: access.guestBuyerId, email: access.email, emailVerifiedAt: access.verified }, accessSession: { guestBuyerId: access.guestBuyerId, revokedAt: access.revokedAt, expiresAt: access.expiresAt } })) throw Object.assign(new Error('The account email does not match this verified purchase.'), { statusCode: 403 });
      const guestRows = await tx.select().from(entitlements).where(eq(entitlements.guestBuyerId, access.guestBuyerId));
      for (const grant of guestRows) {
        if (grant.status === 'active') {
          const [duplicate] = await tx.select({ id: entitlements.id }).from(entitlements).where(and(eq(entitlements.userId, session.user.id), eq(entitlements.productId, grant.productId), eq(entitlements.status, 'active'))).limit(1);
          if (duplicate) await tx.update(entitlements).set({ status: 'revoked', revokedAt: new Date() }).where(eq(entitlements.id, grant.id));
          else await tx.update(entitlements).set({ userId: session.user.id, guestBuyerId: null }).where(eq(entitlements.id, grant.id));
        } else await tx.update(entitlements).set({ userId: session.user.id, guestBuyerId: null }).where(eq(entitlements.id, grant.id));
      }
      const guestProgress = await tx.select().from(lessonProgress).where(eq(lessonProgress.guestBuyerId, access.guestBuyerId));
      for (const row of guestProgress) {
        const [existing] = await tx.select().from(lessonProgress).where(and(eq(lessonProgress.userId, session.user.id), eq(lessonProgress.lessonId, row.lessonId))).limit(1);
        if (existing) {
          await tx.update(lessonProgress).set({ completedAt: existing.completedAt ?? row.completedAt, lastPositionSeconds: Math.max(existing.lastPositionSeconds, row.lastPositionSeconds), updatedAt: new Date() }).where(eq(lessonProgress.id, existing.id));
          await tx.delete(lessonProgress).where(eq(lessonProgress.id, row.id));
        } else await tx.update(lessonProgress).set({ userId: session.user.id, guestBuyerId: null }).where(eq(lessonProgress.id, row.id));
      }
      const attempts = await tx.select().from(quizAttempts).where(eq(quizAttempts.guestBuyerId, access.guestBuyerId));
      for (const attempt of attempts) {
        const collision = attempt.status === 'in_progress' ? await tx.select({ id: quizAttempts.id }).from(quizAttempts).where(and(eq(quizAttempts.userId, session.user.id), eq(quizAttempts.quizId, attempt.quizId), eq(quizAttempts.status, 'in_progress'))).limit(1) : [];
        if (collision.length) await tx.update(quizAttempts).set({ status: 'submitted', submittedAt: attempt.submittedAt ?? new Date(), guestBuyerId: null, userId: session.user.id, updatedAt: new Date() }).where(eq(quizAttempts.id, attempt.id));
        else await tx.update(quizAttempts).set({ userId: session.user.id, guestBuyerId: null }).where(eq(quizAttempts.id, attempt.id));
      }
      await tx.update(orders).set({ buyerUserId: session.user.id, guestBuyerId: null }).where(eq(orders.guestBuyerId, access.guestBuyerId));
      await tx.update(guestBuyers).set({ claimedUserId: session.user.id, updatedAt: new Date() }).where(eq(guestBuyers.id, access.guestBuyerId));
      await tx.update(guestAccessSessions).set({ revokedAt: new Date() }).where(eq(guestAccessSessions.guestBuyerId, access.guestBuyerId));
    });
    (await cookies()).delete(GUEST_ACCESS_COOKIE);
    return NextResponse.json({ claimed: true });
  } catch (error) {
    const statusCode = typeof error === 'object' && error && 'statusCode' in error ? Number(error.statusCode) : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Purchase could not be linked to this account.' }, { status: statusCode });
  }
}
