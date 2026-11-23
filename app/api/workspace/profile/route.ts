import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { getDatabaseErrorInfo } from '@/src/server/db/error-info';
import { auditLogs, creatorSlugHistory, creators, users } from '@/src/server/db/schema';
import { getCreatorLogoUrl, validateCreatorLogoKey } from '@/src/server/workspaces/logo';

export const runtime = 'nodejs';

const fields = {
  displayName: z.string().trim().min(2, 'Use at least 2 characters.').max(100, 'Use 100 characters or fewer.'),
  slug: z.string().trim().toLowerCase().min(3, 'Use at least 3 characters.').max(30, 'Use 30 characters or fewer.')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only.')
    .refine((value) => !new Set(['admin', 'api', 'dashboard', 'login', 'signup', 'checkout', 'library', 'learn', 'legal', 'blog', 'book', 'p', 'f', 'settings', 'support']).has(value), 'That address is reserved.'),
  headline: z.string().trim().max(160, 'Use 160 characters or fewer.'),
  bio: z.string().trim().max(2000, 'Use 2,000 characters or fewer.'),
  whatsappE164: z.union([z.string().regex(/^\+[1-9]\d{7,14}$/, 'Enter a phone number with country code.'), z.literal('')]),
  timezone: z.string().trim().min(1).max(64).refine((value) => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; }
    catch { return false; }
  }, 'Choose a valid time zone.'),
  avatarKey: z.string().max(500),
  persona: z.enum(['creator', 'entrepreneur', 'coach', 'small_business', 'educator', 'service_provider']),
} as const;

type ProfileField = keyof typeof fields;

export async function PATCH(request: Request) {
  try {
    const { creator, session } = await requireCreator();
    const body = await request.json().catch(() => null) as { field?: unknown; value?: unknown } | null;
    if (!body || typeof body.field !== 'string' || !Object.hasOwn(fields, body.field)) {
      return NextResponse.json({ error: 'Choose a profile field to update.' }, { status: 400 });
    }
    const field = body.field as ProfileField;
    const parsed = fields[field].safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check this value and try again.' }, { status: 400 });

    const value = field === 'avatarKey'
      ? await validateCreatorLogoKey(session.user.id, parsed.data)
      : parsed.data;
    const db = getDatabase();
    await db.transaction(async (tx) => {
      if (field === 'persona') {
        await tx.update(users).set({ persona: value, updatedAt: new Date() }).where(eq(users.id, session.user.id));
      } else {
        const [current] = await tx.select({ slug: creators.slug }).from(creators).where(eq(creators.id, creator.id)).for('update');
        if (!current) throw new Error('Workspace not found.');
        if (field === 'slug' && current.slug !== value) {
          await tx.insert(creatorSlugHistory).values({ creatorId: creator.id, slug: current.slug }).onConflictDoNothing();
        }
        await tx.update(creators).set({ [field]: value === '' && (field === 'headline' || field === 'bio' || field === 'whatsappE164') ? null : value, updatedAt: new Date() }).where(eq(creators.id, creator.id));
      }
      await tx.insert(auditLogs).values({
        actorUserId: session.user.id, action: `creator.profile.${field}.update`, entityType: 'creator', entityId: creator.id,
        after: { field, value: field === 'bio' || field === 'whatsappE164' ? '[updated]' : value },
      });
    });
    return NextResponse.json({ field, value, ...(field === 'avatarKey' ? { avatarUrl: getCreatorLogoUrl(value) } : {}) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const info = getDatabaseErrorInfo(error);
    if (info.code === '23505' && (info.constraint === 'creators_slug_unique' || (info.table === 'creators' && info.column === 'slug'))) {
      return NextResponse.json({ error: 'That workspace URL is already in use.' }, { status: 409 });
    }
    if (error instanceof Error && /Choose a logo|logo storage|uploaded to this account|invalid or has expired/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Workspace profile update failed', error);
    return NextResponse.json({ error: 'We couldn’t save this change. Try again.' }, { status: 503 });
  }
}
