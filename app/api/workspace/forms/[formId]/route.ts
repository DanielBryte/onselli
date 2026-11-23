import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, forms } from '@/src/server/db/schema';
import { formSettingsSchema } from '@/src/server/forms/validation';

export const runtime = 'nodejs';

export async function GET(_request: Request, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { formId } = await params;
    const [form] = await getDatabase().select().from(forms).where(and(eq(forms.id, formId), eq(forms.creatorId, creator.id))).limit(1);
    if (!form) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });
    return NextResponse.json({ form, creatorSlug: creator.slug }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Creator form lookup failed', error);
    return NextResponse.json({ error: 'Form could not be loaded.' }, { status: 503 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { formId } = await params;
    const parsed = formSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the form details.' }, { status: 400 });
    const db = getDatabase();
    const [saved] = await db.update(forms).set({ title: parsed.data.title, slug: parsed.data.slug, status: parsed.data.status, fields: parsed.data.fields, settings: parsed.data.settings, updatedAt: new Date() }).where(and(eq(forms.id, formId), eq(forms.creatorId, creator.id))).returning();
    if (!saved) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'form.update', entityType: 'form', entityId: saved.id, after: { title: saved.title, status: saved.status } });
    return NextResponse.json({ form: saved });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'A form already uses this page address.' }, { status: 409 });
    console.error('Creator form update failed', error);
    return NextResponse.json({ error: 'Your form could not be saved.' }, { status: 503 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ formId: string }> }) {
  try {
    const { session, creator } = await requireCreator();
    const { formId } = await params;
    const db = getDatabase();
    const [removed] = await db.delete(forms).where(and(eq(forms.id, formId), eq(forms.creatorId, creator.id))).returning({ id: forms.id, title: forms.title });
    if (!removed) return NextResponse.json({ error: 'Form not found.' }, { status: 404 });
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'form.delete', entityType: 'form', entityId: removed.id, before: removed });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Creator form delete failed', error);
    return NextResponse.json({ error: 'Your form could not be deleted.' }, { status: 503 });
  }
}
