import { createHash } from 'node:crypto';
import { and, count, eq, isNull, sql } from 'drizzle-orm';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/src/server/db';
import { contacts, formSubmissions, forms, creators } from '@/src/server/db/schema';
import { submissionSchema } from '@/src/server/forms/validation';
import { checkPublicRateLimit } from '@/src/server/security/rate-limit';
import { verifyTurnstile } from '@/src/server/security/turnstile';
import { triggerWorkflow } from '@/src/server/jobs/client';
import { getAccountEntitlements } from '@/src/server/billing/entitlements';
import { getCreatorIdForSlug } from '@/src/server/workspaces/resolve-slug';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ creatorSlug: string; formSlug: string }> }) {
  const { creatorSlug, formSlug } = await params;
  const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = createHash('sha256').update(ip).digest('hex');
  try {
    const creatorId = await getCreatorIdForSlug(creatorSlug);
    const [record] = creatorId ? await getDatabase().select({ creator: creators, form: forms }).from(forms).innerJoin(creators, eq(forms.creatorId, creators.id))
      .where(and(eq(creators.id, creatorId), eq(creators.status, 'active'), eq(forms.slug, formSlug), eq(forms.status, 'published'))).limit(1) : [];
    if (!record) return NextResponse.json({ error: 'This form is not available.' }, { status: 404 });
    const ipLimit = await checkPublicRateLimit('form-ip:' + ipHash);
    const formLimit = await checkPublicRateLimit('form:' + record.form.id);
    if (!ipLimit.success || !formLimit.success) return NextResponse.json({ error: 'Too many submissions. Please try again shortly.' }, { status: 429 });
    const body = await request.json().catch(() => null) as { data?: unknown; website?: string; turnstileToken?: string; marketingConsent?: boolean; termsAccepted?: boolean; sourcePage?: string; utm?: Record<string, unknown> } | null;
    if (!body || body.website) return NextResponse.json({ ok: true }, { status: 202 });
    const remoteIp = ip === 'unknown' ? undefined : ip;
    if (!await verifyTurnstile(body.turnstileToken, remoteIp)) return NextResponse.json({ error: 'Please complete the security check and try again.' }, { status: 400 });
    if (body.termsAccepted !== true) return NextResponse.json({ error: 'Accept the privacy and terms notice before sending your response.' }, { status: 400 });
    const parsed = submissionSchema(record.form.fields).safeParse(body.data);
    if (!parsed.success) return NextResponse.json({ error: 'Check the form fields and try again.', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const settings = record.form.settings as { maxSubmissions?: number; closesAt?: string; onePerEmail?: boolean } | null;
    if (settings?.closesAt && new Date(settings.closesAt) <= new Date()) return NextResponse.json({ error: 'This form is closed.' }, { status: 410 });
    const submitted = parsed.data as Record<string, unknown>;
    const fieldDefinitions = record.form.fields as { id: string; type: string; label: string }[];
    const findValue = (type: string) => { const field = fieldDefinitions.find((item) => item.type === type); const value = field ? submitted[field.id] : undefined; return typeof value === 'string' ? value.trim() : ''; };
    const email = findValue('email').toLowerCase() || null;
    const rawPhone = findValue('phone');
    const parsedPhone = rawPhone ? parsePhoneNumberFromString(rawPhone, 'NG') : undefined;
    if (rawPhone && !parsedPhone?.isValid()) return NextResponse.json({ error: 'Enter a valid phone number, including its country code.' }, { status: 400 });
    const phone = parsedPhone?.number ?? null;
    const nameField = fieldDefinitions.find((field) => /name/i.test(field.label));
    const name = nameField && typeof submitted[nameField.id] === 'string' ? String(submitted[nameField.id]).trim() : null;
    if (!email && !phone) return NextResponse.json({ error: 'Add an email or phone field so the creator can follow up.' }, { status: 400 });
    const entitlements = await getAccountEntitlements(record.creator.userId);
    const emailFieldId = fieldDefinitions.find((field) => field.type === 'email')?.id;
    const result = await getDatabase().transaction(async (tx) => {
      const [lockedForm] = await tx.select().from(forms).where(and(eq(forms.id, record.form.id), eq(forms.creatorId, record.creator.id))).for('update');
      if (!lockedForm || lockedForm.status !== 'published') return { error: 'This form is not available.', status: 404 as const };
      if (settings?.maxSubmissions && lockedForm.submissionsCount >= settings.maxSubmissions) return { error: 'This form has reached its response limit.', status: 410 as const };
      if (settings?.onePerEmail && email) {
        const [duplicate] = emailFieldId ? await tx.select({ id: formSubmissions.id }).from(formSubmissions).where(and(eq(formSubmissions.creatorId, record.creator.id), eq(formSubmissions.formId, record.form.id), sql`${formSubmissions.data}->'values'->>${emailFieldId} = ${email}`)).limit(1) : [];
        if (duplicate) return { error: 'A response from this email address has already been received.', status: 409 as const };
      }
      const [existingContact] = email
        ? await tx.select().from(contacts).where(and(eq(contacts.creatorId, record.creator.id), sql`lower(${contacts.email}) = ${email}`)).limit(1)
        : await tx.select().from(contacts).where(and(eq(contacts.creatorId, record.creator.id), eq(contacts.phoneE164, phone!))).limit(1);
      let contactId = existingContact?.id ?? null;
      if (existingContact) {
        await tx.update(contacts).set({ name: existingContact.name || name, email: existingContact.email || email, phoneE164: existingContact.phoneE164 || phone, lastActivityAt: new Date(), marketingConsentAt: body.marketingConsent ? existingContact.marketingConsentAt ?? new Date() : existingContact.marketingConsentAt, updatedAt: new Date() }).where(and(eq(contacts.id, existingContact.id), eq(contacts.creatorId, record.creator.id)));
      } else {
        const [total] = Number.isFinite(entitlements.maxContacts) ? await tx.select({ value: count() }).from(contacts).where(and(eq(contacts.creatorId, record.creator.id), isNull(contacts.deletedAt))) : [{ value: 0 }];
        if (Number(total?.value ?? 0) < entitlements.maxContacts) {
          const [created] = await tx.insert(contacts).values({ creatorId: record.creator.id, name, email, phoneE164: phone, source: 'form: ' + record.form.title, stage: 'lead', status: 'new', marketingConsentAt: body.marketingConsent ? new Date() : null, lastActivityAt: new Date() }).returning({ id: contacts.id });
          contactId = created?.id ?? null;
        }
      }
      const [submission] = await tx.insert(formSubmissions).values({ creatorId: record.creator.id, formId: record.form.id, contactId, data: { schemaVersion: 1, values: submitted, consent: { termsAccepted: true, marketingConsent: body.marketingConsent === true, recordedAt: new Date().toISOString() } }, sourcePage: typeof body.sourcePage === 'string' ? body.sourcePage.slice(0, 500) : null, utm: body.utm ?? {}, status: 'new', ipHash }).returning({ id: formSubmissions.id });
      if (!submission) throw new Error('Submission could not be stored.');
      await tx.update(forms).set({ submissionsCount: sql`${forms.submissionsCount} + 1`, updatedAt: new Date() }).where(and(eq(forms.id, record.form.id), eq(forms.creatorId, record.creator.id)));
      return { submissionId: submission.id, contactId };
    });
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status });
    await triggerWorkflow('/api/workflows/form-notification', { formId: record.form.id, creatorId: record.creator.id, submissionId: result.submissionId }, {
      workflowRunId: `form-submission-${result.submissionId}`,
    }).catch((error: unknown) => console.error('Form notification queue failed', { formId: record.form.id, message: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ ok: true, message: (record.form.settings as { successMessage?: string } | null)?.successMessage ?? 'Thanks for reaching out.' }, { status: 201 });
  } catch (error) {
    console.error('Public form submission failed', error);
    return NextResponse.json({ error: 'Your response could not be submitted. Please try again.' }, { status: 503 });
  }
}
