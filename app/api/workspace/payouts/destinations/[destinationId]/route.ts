import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { bankAccounts, creators, payoutDestinations } from '@/src/server/db/schema';

export const runtime = 'nodejs';
export async function PATCH(request: Request, { params }: { params: Promise<{ destinationId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { destinationId } = await params;
    const body = await request.json().catch(() => null);
    if (body?.isDefault !== true) return NextResponse.json({ error: 'Choose a valid default payout method.' }, { status: 400 });
    const db = getDatabase();
    const [remote] = await db.select().from(payoutDestinations).where(and(eq(payoutDestinations.id, destinationId), eq(payoutDestinations.creatorId, creator.id))).limit(1);
    if (remote) {
      if (!remote.isUsable) return NextResponse.json({ error: 'This payout destination must be approved before it can be used.' }, { status: 409 });
      await db.transaction(async (tx) => {
        await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, creator.id)).for('update');
        await tx.update(payoutDestinations).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(payoutDestinations.creatorId, creator.id), eq(payoutDestinations.currency, remote.currency), eq(payoutDestinations.method, remote.method), eq(payoutDestinations.isDefault, true)));
        await tx.update(bankAccounts).set({ isDefault: false }).where(and(eq(bankAccounts.creatorId, creator.id), eq(bankAccounts.isDefault, true)));
        await tx.update(payoutDestinations).set({ isDefault: true, updatedAt: new Date() }).where(eq(payoutDestinations.id, destinationId));
      });
      return NextResponse.json({ id: destinationId, isDefault: true });
    }
    const [legacy] = await db.select().from(bankAccounts).where(and(eq(bankAccounts.id, destinationId), eq(bankAccounts.creatorId, creator.id))).limit(1);
    if (!legacy) return NextResponse.json({ error: 'Payout method not found.' }, { status: 404 });
    if (!legacy.verifiedAt) return NextResponse.json({ error: 'This bank account must be verified before it can be used.' }, { status: 409 });
    await db.transaction(async (tx) => {
      await tx.select({ id: creators.id }).from(creators).where(eq(creators.id, creator.id)).for('update');
      await tx.update(bankAccounts).set({ isDefault: false }).where(and(eq(bankAccounts.creatorId, creator.id), eq(bankAccounts.isDefault, true)));
      await tx.update(payoutDestinations).set({ isDefault: false, updatedAt: new Date() }).where(and(eq(payoutDestinations.creatorId, creator.id), eq(payoutDestinations.isDefault, true)));
      await tx.update(bankAccounts).set({ isDefault: true }).where(eq(bankAccounts.id, destinationId));
    });
    return NextResponse.json({ id: destinationId, isDefault: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Payout method update failed', error);
    return NextResponse.json({ error: 'Could not update payout method.' }, { status: 503 });
  }
}
