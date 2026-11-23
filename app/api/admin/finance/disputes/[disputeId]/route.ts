import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBachsDispute, submitBachsDispute, updateBachsDisputeEvidence } from '@/lib/payments/bachs';
import { AuthorizationError, requireAdmin } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, disputes } from '@/src/server/db/schema';

export const runtime = 'nodejs';

const evidenceSchema = z.object({
  customer_name: z.string().trim().max(200).optional(),
  customer_email_address: z.string().trim().email().max(320).optional().or(z.literal('')),
  product_description: z.string().trim().max(2000).optional(),
  service_date: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(4000).optional(),
  access_activity_log: z.string().trim().max(4000).optional(),
  billing_address: z.string().trim().max(1000).optional(),
  refund_policy_disclosure: z.string().trim().max(2000).optional(),
  refund_refusal_explanation: z.string().trim().max(2000).optional(),
  cancellation_policy_disclosure: z.string().trim().max(2000).optional(),
  refund_policy_attachment_id: z.string().trim().max(200).optional(),
  cancellation_policy_attachment_id: z.string().trim().max(200).optional(),
  customer_communication_attachment_id: z.string().trim().max(200).optional(),
  uncategorized_attachment_id: z.string().trim().max(200).optional(),
}).strict();

type Context = { params: Promise<{ disputeId: string }> };

export async function GET(_request: Request, { params }: Context) {
  try {
    await requireAdmin('process_refunds');
    const { disputeId } = await params;
    const db = getDatabase();
    const [local] = await db.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1);
    if (!local) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });
    const remote = await getBachsDispute(local.providerRef);
    if (remote.dispute_id !== local.providerRef) return NextResponse.json({ error: 'Provider dispute reference did not match.' }, { status: 502 });
    await db.update(disputes).set({ status: remote.status, reason: remote.reason ?? local.reason, isResponseEditable: remote.is_response_editable, dueAt: remote.response_deadline_at ? new Date(remote.response_deadline_at) : local.dueAt, updatedAt: new Date() }).where(eq(disputes.id, local.id));
    return NextResponse.json({ dispute: remote }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Admin dispute refresh failed');
    return NextResponse.json({ error: 'Could not load the provider dispute. Retry before taking action.' }, { status: 503 });
  }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const session = await requireAdmin('process_refunds');
    const { disputeId } = await params;
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || !('action' in body)) return NextResponse.json({ error: 'Choose a valid dispute action.' }, { status: 400 });
    const db = getDatabase();
    const [local] = await db.select().from(disputes).where(eq(disputes.id, disputeId)).limit(1);
    if (!local) return NextResponse.json({ error: 'Dispute not found.' }, { status: 404 });

    if (body.action === 'save_evidence') {
      const parsed = evidenceSchema.safeParse((body as Record<string, unknown>).evidence);
      if (!parsed.success) return NextResponse.json({ error: 'Check the evidence fields and try again.' }, { status: 400 });
      const evidence = Object.fromEntries(Object.entries(parsed.data).filter(([, value]) => value !== undefined && value !== ''));
      if (!Object.keys(evidence).length) return NextResponse.json({ error: 'Add at least one evidence field before saving.' }, { status: 400 });
      const remote = await getBachsDispute(local.providerRef);
      if (remote.dispute_id !== local.providerRef || !remote.is_response_editable) return NextResponse.json({ error: 'Bachs no longer accepts evidence for this dispute.' }, { status: 409 });
      const saved = await updateBachsDisputeEvidence(local.providerRef, evidence);
      const savedAt = new Date();
      await db.update(disputes).set({ status: saved.status, isResponseEditable: saved.is_response_editable, evidence: { fieldNames: Object.keys(evidence), savedAt: savedAt.toISOString() }, updatedAt: savedAt }).where(eq(disputes.id, local.id));
      await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'dispute.evidence_saved', entityType: 'dispute', entityId: local.id, after: { fieldNames: Object.keys(evidence), savedAt: savedAt.toISOString() } });
      return NextResponse.json({ savedAt: savedAt.toISOString(), fieldNames: Object.keys(evidence) });
    }

    if (body.action === 'submit_evidence') {
      if (!('confirm' in body) || body.confirm !== true) return NextResponse.json({ error: 'Confirm submission before sending evidence.' }, { status: 400 });
      const priorStatus = local.status;
      const locked = await db.transaction(async (tx) => {
        const [row] = await tx.select().from(disputes).where(eq(disputes.id, local.id)).for('update');
        if (!row?.isResponseEditable || row.status === 'evidence_submitting') return false;
        await tx.update(disputes).set({ status: 'evidence_submitting', updatedAt: new Date() }).where(eq(disputes.id, row.id));
        return true;
      });
      if (!locked) return NextResponse.json({ error: 'This dispute cannot be submitted again. Refresh its provider status.' }, { status: 409 });
      try {
        const remote = await getBachsDispute(local.providerRef);
        if (remote.dispute_id !== local.providerRef || !remote.is_response_editable || !remote.evidence || Object.values(remote.evidence).every((value) => !value)) {
          await db.update(disputes).set({ status: remote.status, isResponseEditable: remote.is_response_editable, updatedAt: new Date() }).where(eq(disputes.id, local.id));
          return NextResponse.json({ error: 'The dispute has no saved evidence or the response window has closed.' }, { status: 409 });
        }
        const submitted = await submitBachsDispute(local.providerRef);
        const submittedAt = submitted.submission?.submitted_at ?? new Date().toISOString();
        await db.update(disputes).set({ status: submitted.status, isResponseEditable: submitted.is_response_editable, evidence: { ...((local.evidence && typeof local.evidence === 'object') ? local.evidence as Record<string, unknown> : {}), submittedAt, submissionId: submitted.submission?.submission_id }, updatedAt: new Date(submittedAt) }).where(eq(disputes.id, local.id));
        await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'dispute.evidence_submitted', entityType: 'dispute', entityId: local.id, after: { status: submitted.status, submissionId: submitted.submission?.submission_id, submittedAt } });
        return NextResponse.json({ status: submitted.status, submittedAt });
      } catch (error) {
        // A failed transport may still mean Bachs accepted the submission. Keep the lock for uncertain outcomes.
        if (error instanceof Error && 'status' in error && typeof error.status === 'number' && error.status > 0 && error.status < 500 && ![408, 409, 425, 429].includes(error.status)) {
          await db.update(disputes).set({ status: priorStatus, isResponseEditable: true, updatedAt: new Date() }).where(eq(disputes.id, local.id));
        }
        throw error;
      }
    }
    return NextResponse.json({ error: 'Choose a valid dispute action.' }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 403 });
    console.error('Admin dispute action failed');
    return NextResponse.json({ error: 'Dispute action could not be completed. Refresh provider status before retrying.' }, { status: 503 });
  }
}
