import { and, desc, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, orders, payments, refunds } from '@/src/server/db/schema';

export const runtime = 'nodejs';
const requestSchema = z.object({ reason: z.string().trim().min(8).max(500) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { orderId } = await params;
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Add a short reason for the refund request.' }, { status: 400 });
    const db = getDatabase();
    const outcome = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.creatorId, creator.id))).for('update');
      if (!order || order.status !== 'paid') throw new Error('Only a completed sale can be submitted for refund review.');
      const [payment] = await tx.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.status, 'succeeded'))).orderBy(desc(payments.createdAt)).limit(1);
      if (!payment?.chargeId) throw new Error('The payment provider has not confirmed a refundable charge.');
      const [existing] = await tx.select().from(refunds).where(and(eq(refunds.orderId, orderId), inArray(refunds.status, ['requested', 'processing', 'paid', 'failed']))).orderBy(desc(refunds.createdAt)).limit(1);
      if (existing) return { existing: true, status: existing.status };
      const [record] = await tx.insert(refunds).values({ creatorId: creator.id, orderId, requestedBy: session.user.id, reason: parsed.data.reason, status: 'requested' }).returning({ id: refunds.id });
      if (!record) throw new Error('Refund request could not be recorded.');
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: 'refund.review_requested', entityType: 'refund', entityId: record.id, after: { status: 'requested' } });
      return { existing: false, status: 'requested' };
    });
    if (outcome.existing) return NextResponse.json({ status: outcome.status, message: outcome.status === 'failed' ? 'A previous refund attempt needs staff review. Contact Onselli support before submitting another request.' : 'A refund request already exists for this order.' }, { status: 409 });
    return NextResponse.json({ status: 'requested', message: 'Your refund request was sent to Onselli for review.' }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof Error && /completed sale|provider has not confirmed/.test(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error('Refund review request failed', error);
    return NextResponse.json({ error: 'Refund request could not be recorded.' }, { status: 503 });
  }
}
