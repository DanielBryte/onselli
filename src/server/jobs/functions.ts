import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import type { WorkflowContext } from '@upstash/workflow';
import { getDatabase } from '../db';
import { contacts, creators, emailCampaignCredits, emailCampaignRecipients, emailCampaigns, formSubmissions, forms, orders, users } from '../db/schema';
import { getEnv } from '../config/env';
import { triggerWorkflow } from './client';
import { randomUUID } from 'node:crypto';
import { decimalToMinor, getBachsPayout, getBachsPayoutByReference } from '@/lib/payments/bachs-payouts';
import { auditLogs, ledgerEntries, payouts, webhookEvents } from '../db/schema';
import { reconcileBachsSale } from '../payments/bachs-settlement';

type CampaignPayload = { campaignId: string; creatorId: string };
type FormPayload = { formId: string; creatorId: string; submissionId: string };

export async function dispatchCampaign(context: WorkflowContext<CampaignPayload>) {
  const data = context.requestPayload;
  const db = getDatabase();
  await context.run('mark-campaign-sending', async () => {
    await db.update(emailCampaigns).set({ status: 'sending', updatedAt: new Date() })
      .where(and(eq(emailCampaigns.id, data.campaignId), eq(emailCampaigns.creatorId, data.creatorId), sql`${emailCampaigns.status} IN ('queued','sending')`));
  });

  const batch = await context.run('claim-recipient-batch', async () => db.transaction(async (tx) => {
      const rows = await tx.select().from(emailCampaignRecipients)
        .where(and(eq(emailCampaignRecipients.campaignId, data.campaignId), eq(emailCampaignRecipients.creatorId, data.creatorId), eq(emailCampaignRecipients.status, 'queued')))
        .orderBy(emailCampaignRecipients.createdAt).limit(10).for('update', { skipLocked: true });
      for (const row of rows) await tx.update(emailCampaignRecipients).set({ status: 'sending', attempts: sql`${emailCampaignRecipients.attempts} + 1`, updatedAt: new Date() }).where(eq(emailCampaignRecipients.id, row.id));
      return rows;
  }));

  if (!batch.length) {
    await context.run('finish-campaign', async () => {
        const [remaining] = await db.select({ count: sql<number>`count(*)::int` }).from(emailCampaignRecipients)
          .where(and(eq(emailCampaignRecipients.campaignId, data.campaignId), sql`${emailCampaignRecipients.status} IN ('queued','sending')`));
        if (!remaining?.count) await db.update(emailCampaigns).set({ status: 'sent', updatedAt: new Date() }).where(eq(emailCampaigns.id, data.campaignId));
        return { pending: remaining?.count ?? 0 };
    });
    return { complete: true };
  }

  for (let index = 0; index < batch.length; index += 1) {
    const row = batch[index];
    if (!row) continue;
    const consented = await context.run(`check-consent-${row.id}`, async () => {
      const [contact] = row.contactId ? await db.select().from(contacts).where(and(eq(contacts.id, row.contactId), eq(contacts.creatorId, data.creatorId))).limit(1) : [];
      return Boolean(contact?.marketingConsentAt && !contact.unsubscribedAt && !contact.emailSuppressedAt && !contact.deletedAt && contact.email?.trim().toLowerCase() === row.email.toLowerCase());
    });
    if (!consented) {
      await context.run(`mark-unsubscribed-${row.id}`, async () => db.transaction(async (tx) => {
        const updated = await tx.update(emailCampaignRecipients).set({ status: 'unsubscribed', error: 'Consent withdrawn before dispatch.', updatedAt: new Date() })
          .where(and(eq(emailCampaignRecipients.id, row.id), eq(emailCampaignRecipients.status, 'sending'))).returning({ id: emailCampaignRecipients.id });
        if (updated.length) await tx.update(emailCampaignCredits).set({ available: sql`${emailCampaignCredits.available} + 1`, reserved: sql`greatest(0, ${emailCampaignCredits.reserved} - 1)`, updatedAt: new Date() }).where(eq(emailCampaignCredits.creatorId, data.creatorId));
        return { updated: updated.length > 0 };
      }));
    } else {
      const [campaign] = await db.select().from(emailCampaigns).where(and(eq(emailCampaigns.id, data.campaignId), eq(emailCampaigns.creatorId, data.creatorId))).limit(1);
      if (!campaign) throw new Error('Campaign was removed.');
      const delivery = await context.run(`deliver-email-${row.id}`, async () => {
        try {
          const { sendCampaignEmail } = await import('../emails/campaigns');
          const providerId = await sendCampaignEmail({ recipientId: row.id, campaignId: data.campaignId, to: row.email, subject: campaign.subject, html: campaign.html, previewText: campaign.previewText });
          return { providerId };
        } catch (error) {
          return { error: error instanceof Error ? error.message.slice(0, 1000) : 'Campaign delivery provider failed.' };
        }
      });
      await context.run(`record-delivery-${row.id}`, async () => db.transaction(async (tx) => {
        const updated = await tx.update(emailCampaignRecipients).set('providerId' in delivery
          ? { status: 'sent', providerId: delivery.providerId, sentAt: new Date(), error: null, updatedAt: new Date() }
          : { status: 'failed', error: delivery.error, updatedAt: new Date() })
          .where(and(eq(emailCampaignRecipients.id, row.id), eq(emailCampaignRecipients.status, 'sending'))).returning({ id: emailCampaignRecipients.id });
        if (!updated.length) return { updated: false };
        if ('providerId' in delivery) {
          await tx.update(emailCampaigns).set({ sentCount: sql`${emailCampaigns.sentCount} + 1`, updatedAt: new Date() }).where(eq(emailCampaigns.id, data.campaignId));
          await tx.update(emailCampaignCredits).set({ reserved: sql`greatest(0, ${emailCampaignCredits.reserved} - 1)`, updatedAt: new Date() }).where(eq(emailCampaignCredits.creatorId, data.creatorId));
        } else {
          await tx.update(emailCampaignCredits).set({ available: sql`${emailCampaignCredits.available} + 1`, reserved: sql`greatest(0, ${emailCampaignCredits.reserved} - 1)`, updatedAt: new Date() }).where(eq(emailCampaignCredits.creatorId, data.creatorId));
        }
        return { updated: true };
      }));
    }
    if (index < batch.length - 1) await context.sleep(`campaign-recipient-throttle-${index}`, '1s');
  }
  await context.run('enqueue-next-campaign-batch', async () => triggerWorkflow(
    '/api/workflows/campaign-dispatch', data, {
      delay: '2s',
      workflowRunId: `campaign-${data.campaignId}-${randomUUID()}`,
      flowControl: { key: `campaign-${data.campaignId}`, parallelism: 1 },
    },
  ));
  return { processed: batch.length, queuedNext: true };
}

export async function notifyFormSubmission(context: WorkflowContext<FormPayload>) {
  const data = context.requestPayload;
  const [record] = await getDatabase().select({ form: forms, submission: formSubmissions, creator: creators, owner: users })
    .from(formSubmissions).innerJoin(forms, eq(formSubmissions.formId, forms.id))
    .innerJoin(creators, eq(forms.creatorId, creators.id)).innerJoin(users, eq(creators.userId, users.id))
    .where(and(eq(formSubmissions.id, data.submissionId), eq(forms.id, data.formId), eq(creators.id, data.creatorId))).limit(1);
  if (!record) return { skipped: true, reason: 'submission-not-found' };
  const settings = record.form.settings as { notificationEmails?: string[]; confirmationEmail?: boolean; confirmationMessage?: string } | null;
  const appUrl = getEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const formEmail = { creatorName: record.creator.displayName, formTitle: record.form.title, formUrl: `${appUrl}/workspace/forms/${record.form.id}/submissions` };
  const { sendFormEmail } = await import('../emails/send');
  const targets = settings?.notificationEmails?.length ? settings.notificationEmails : [record.owner.email];
  await Promise.all(targets.map((to, index) => context.run(`notify-creator-${index}`, async () => {
    await sendFormEmail({ to, ...formEmail });
    return true;
  })));
  if (settings?.confirmationEmail) {
    const fields = record.form.fields as { id: string; type: string }[];
    const values = (record.submission.data as { values?: Record<string, unknown> } | null)?.values ?? {};
    const emailField = fields.find((field) => field.type === 'email');
    const email = emailField && typeof values[emailField.id] === 'string' ? String(values[emailField.id]) : '';
    if (email) await context.run('send-submitter-confirmation', async () => {
      await sendFormEmail({ to: email, ...formEmail, confirmation: settings.confirmationMessage || 'Thank you. Your response has been sent.' });
      return true;
    });
  }
  return { notified: targets.length, formId: record.form.id };
}

export async function recoverCampaignQueue() {
  const db = getDatabase();
  await db.transaction(async (tx) => {
    const stalled = await tx.update(emailCampaignRecipients)
      .set({ status: 'failed', error: 'Delivery outcome unknown after a workflow timeout; verify with the provider before retrying.', updatedAt: new Date() })
      .where(and(eq(emailCampaignRecipients.status, 'sending'), sql`${emailCampaignRecipients.updatedAt} <= now() - interval '30 minutes'`))
      .returning({ creatorId: emailCampaignRecipients.creatorId });
    const creditsByCreator = new Map<string, number>();
    for (const recipient of stalled) creditsByCreator.set(recipient.creatorId, (creditsByCreator.get(recipient.creatorId) ?? 0) + 1);
    for (const [creatorId, count] of creditsByCreator) {
      await tx.update(emailCampaignCredits).set({ available: sql`${emailCampaignCredits.available} + ${count}`, reserved: sql`greatest(0, ${emailCampaignCredits.reserved} - ${count})`, updatedAt: new Date() }).where(eq(emailCampaignCredits.creatorId, creatorId));
    }
  });
  const due = await db.update(emailCampaigns).set({ status: 'queued', updatedAt: new Date() })
    .where(and(eq(emailCampaigns.status, 'scheduled'), sql`${emailCampaigns.scheduledAt} <= now() - interval '5 minutes'`))
    .returning({ id: emailCampaigns.id, creatorId: emailCampaigns.creatorId });
  const stale = await db.update(emailCampaigns).set({ updatedAt: new Date() })
    .where(and(sql`${emailCampaigns.status} IN ('queued','sending')`, sql`${emailCampaigns.updatedAt} <= now() - interval '5 minutes'`, sql`NOT EXISTS (SELECT 1 FROM email_campaign_recipients r WHERE r.campaign_id = ${emailCampaigns.id} AND r.status = 'sending')`))
    .returning({ id: emailCampaigns.id, creatorId: emailCampaigns.creatorId });
  const unique = new Map([...due, ...stale].map((campaign) => [campaign.id, campaign]));
  const campaigns = [...unique.values()].slice(0, 50);
  await Promise.all(campaigns.map((campaign) => triggerWorkflow('/api/workflows/campaign-dispatch', campaign, {
    workflowRunId: `campaign-${campaign.id}-recovery-${Date.now()}`,
    flowControl: { key: `campaign-${campaign.id}`, parallelism: 1 },
  })));
  return { dispatched: campaigns.length };
}

export async function reconcileStalePayouts() {
  const db = getDatabase();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const rows = await db.select({ payout: payouts, creator: creators }).from(payouts).innerJoin(creators, eq(payouts.creatorId, creators.id)).where(and(eq(payouts.status, 'processing'), sql`${payouts.updatedAt} < ${cutoff}`, sql`${creators.bachsAccountId} IS NOT NULL`)).orderBy(desc(payouts.updatedAt)).limit(50);
  const outcomes: Array<{ id: string; status: string }> = [];
  for (const { payout, creator } of rows) {
    if (!creator.bachsAccountId || !payout.providerRef) continue;
    try {
      const remote = payout.providerPayoutId ? await getBachsPayout(payout.providerPayoutId, creator.bachsAccountId) : await getBachsPayoutByReference(payout.providerRef, creator.bachsAccountId);
      if (!remote || remote.reference !== payout.providerRef || (payout.providerPayoutId && remote.id !== payout.providerPayoutId)) continue;
      const total = decimalToMinor(remote.total_debited, payout.sourceCurrency);
      const fee = decimalToMinor(remote.fee, payout.sourceCurrency);
      const delivered = decimalToMinor(remote.amount, payout.currency);
      if (total !== payout.sourceAmountMinor + payout.feeMinor || fee !== payout.feeMinor || delivered !== payout.amountMinor || remote.source_currency !== payout.sourceCurrency || remote.currency !== payout.currency) {
        await db.update(payouts).set({ failureReason: 'Provider reconciliation mismatch; finance review required.', updatedAt: new Date() }).where(and(eq(payouts.id, payout.id), eq(payouts.status, 'processing')));
        await db.insert(auditLogs).values({ action: 'payout.reconciliation_mismatch', entityType: 'payout', entityId: payout.id, after: { providerPayoutId: remote.id, providerStatus: remote.status } });
        outcomes.push({ id: payout.id, status: 'mismatch' });
        continue;
      }
      const paid = ['paid','completed','succeeded'].includes(remote.status.toLowerCase());
      const failed = ['failed','rejected','cancelled','canceled'].includes(remote.status.toLowerCase());
      if (!paid && !failed) continue;
      await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(payouts).where(eq(payouts.id, payout.id)).for('update');
        if (!locked || locked.status !== 'processing') return;
        const key = `payout:${payout.id}:provider:${paid ? 'paid' : 'failed'}`;
        await tx.insert(ledgerEntries).values([
          { creatorId: payout.creatorId, type: paid ? 'payout_paid' : 'payout_failed', bucket: 'reserved', amountMinor: -total, currency: payout.sourceCurrency, refType: 'payout', refId: payout.id, idempotencyKey: `${key}:reserved` },
          ...(failed ? [{ creatorId: payout.creatorId, type: 'payout_reversal', bucket: 'available' as const, amountMinor: total, currency: payout.sourceCurrency, refType: 'payout', refId: payout.id, idempotencyKey: `${key}:available` }] : []),
        ]).onConflictDoNothing();
        await tx.update(payouts).set({ providerPayoutId: remote.id, status: paid ? 'paid' : 'failed', paidAt: paid ? new Date() : null, failureReason: failed ? remote.failure_reason ?? 'The payout failed.' : null, updatedAt: new Date() }).where(eq(payouts.id, payout.id));
        await tx.insert(auditLogs).values({ action: 'payout.scheduled_reconcile', entityType: 'payout', entityId: payout.id, after: { status: paid ? 'paid' : 'failed', providerPayoutId: remote.id } });
      });
      outcomes.push({ id: payout.id, status: paid ? 'paid' : 'failed' });
    } catch (error) {
      console.error('Scheduled payout reconciliation failed', { payoutId: payout.id, errorType: error instanceof Error ? error.name : 'UNKNOWN' });
    }
  }
  const [events] = await db.select({ count: sql<number>`count(*)::int` }).from(webhookEvents).where(sql`${webhookEvents.status} IN ('failed','received')`);
  if ((events?.count ?? 0) > 0) console.error('Bachs webhook events need attention', { count: events!.count });
  return { scanned: rows.length, outcomes, unprocessedWebhookEvents: events?.count ?? 0 };
}

export async function reconcilePendingSales() {
  const db = getDatabase();
  const rows = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.status, 'paid'), isNotNull(orders.providerTransferId), sql`${orders.providerSettledAt} IS NULL`)).orderBy(orders.updatedAt).limit(50);
  let settled = 0;
  for (const row of rows) {
    try { if (await reconcileBachsSale(row.id)) settled += 1; }
    catch (error) { console.error('Scheduled sale reconciliation failed', { orderId: row.id, errorType: error instanceof Error ? error.name : 'UNKNOWN' }); }
  }
  return { scanned: rows.length, settled };
}

export async function runMaintenanceTask(task: 'recover-campaigns' | 'expire-orders' | 'release-creator-holds' | 'reconcile-payouts') {
  if (task === 'reconcile-payouts') return { payouts: await reconcileStalePayouts(), sales: await reconcilePendingSales() };
  if (task === 'recover-campaigns') return recoverCampaignQueue();
  if (task === 'expire-orders') {
    const { expirePendingOrders } = await import('../ledger/release');
    return expirePendingOrders();
  }
  const { releaseMaturedEarnings } = await import('../ledger/release');
  return releaseMaturedEarnings();
}
