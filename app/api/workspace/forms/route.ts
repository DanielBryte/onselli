import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, forms } from '@/src/server/db/schema';
import { formSettingsSchema } from '@/src/server/forms/validation';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { creator } = await requireCreator();
    const result = await getDatabase().select().from(forms).where(eq(forms.creatorId, creator.id)).orderBy(desc(forms.createdAt));
    return NextResponse.json({ creatorSlug: creator.slug, forms: result }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Creator forms list failed', error);
    return NextResponse.json({ error: 'Forms could not be loaded.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, creator } = await requireCreator();
    const parsed = formSettingsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check the form details.' }, { status: 400 });
    const result = await getDatabase().insert(forms).values({
      creatorId: creator.id, title: parsed.data.title, slug: parsed.data.slug, status: parsed.data.status,
      fields: parsed.data.fields, settings: parsed.data.settings,
    }).returning({ id: forms.id, title: forms.title, slug: forms.slug, status: forms.status });
    const form = result[0];
    if (!form) throw new Error('Form was not created.');
    await getDatabase().insert(auditLogs).values({ actorUserId: session.user.id, action: 'form.create', entityType: 'form', entityId: form.id, after: { title: form.title, status: form.status } });
    return NextResponse.json({ form }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'A form already uses this page address.' }, { status: 409 });
    console.error('Creator form create failed', error);
    return NextResponse.json({ error: 'Your form could not be created.' }, { status: 503 });
  }
}
