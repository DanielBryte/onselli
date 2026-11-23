import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, formSubmissions } from '@/src/server/db/schema';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ formId: string; submissionId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { formId, submissionId } = await params;
    const body = await request.json().catch(() => null);
    const status = body?.status;
    if (!['new','read','archived'].includes(status)) return NextResponse.json({ error: 'Choose a valid response status.' }, { status: 400 });
    const [updated] = await getDatabase().update(formSubmissions).set({ status, updatedAt: new Date() }).where(and(eq(formSubmissions.id, submissionId), eq(formSubmissions.formId, formId), eq(formSubmissions.creatorId, creator.id))).returning({ id: formSubmissions.id, status: formSubmissions.status });
    if (!updated) return NextResponse.json({ error: 'Submission not found.' }, { status: 404 });
    await getDatabase().insert(auditLogs).values({ actorUserId: session.user.id, action: 'form_submission.status', entityType: 'form_submission', entityId: updated.id, after: { status: updated.status } });
    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Form submission status update failed', error);
    return NextResponse.json({ error: 'Response could not be updated.' }, { status: 503 });
  }
}
