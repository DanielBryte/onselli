import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { auditLogs, sitePages, sites } from '@/src/server/db/schema';
import { siteDraftSchema } from '@/src/server/sites/validation';
import { z } from 'zod';

export const runtime = 'nodejs';

const newPageSchema = z.object({ title: z.string().trim().min(1).max(120), slug: z.string().trim().toLowerCase().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) });

export async function GET() {
  try {
    const { creator } = await requireCreator();
    const db = getDatabase();
    let [site] = await db.select().from(sites).where(eq(sites.creatorId, creator.id)).limit(1);
    if (!site) {
      const [created] = await db.insert(sites).values({ creatorId: creator.id, status: 'draft', theme: { template: 'studio', primary: '#014733', background: '#ffffff' }, seo: {} }).returning();
      site = created;
    }
    if (!site) return NextResponse.json({ error: 'The site workspace could not be initialized.' }, { status: 503 });
    let pages = await db.select().from(sitePages).where(and(eq(sitePages.creatorId, creator.id), eq(sitePages.siteId, site.id)));
    if (pages.length === 0) {
      const [home] = await db.insert(sitePages).values({ creatorId: creator.id, siteId: site.id, slug: 'home', title: 'Home', isHome: true, draftContent: { schemaVersion: 1, sections: [] }, publishedContent: { schemaVersion: 1, sections: [] }, seo: {} }).returning();
      if (home) pages = [home];
    }
    return NextResponse.json({ site, pages }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    console.error('Site workspace load failed', error);
    return NextResponse.json({ error: 'Your website settings could not be loaded.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, creator } = await requireCreator();
    const input = newPageSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: input.error.issues[0]?.message ?? 'Enter a page title and address.' }, { status: 400 });
    const db = getDatabase();
    const [site] = await db.select().from(sites).where(eq(sites.creatorId, creator.id)).limit(1);
    if (!site) return NextResponse.json({ error: 'Create your site workspace first.' }, { status: 404 });
    const [page] = await db.insert(sitePages).values({ creatorId: creator.id, siteId: site.id, title: input.data.title, slug: input.data.slug, isHome: false, draftContent: { schemaVersion: 1, sections: [] }, publishedContent: { schemaVersion: 1, sections: [] }, seo: {} }).returning();
    if (!page) throw new Error('Could not create page.');
    await db.insert(auditLogs).values({ actorUserId: session.user.id, action: 'site.page.create', entityType: 'site_page', entityId: page.id, after: { title: page.title, slug: page.slug } });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (typeof error === 'object' && error && 'code' in error && error.code === '23505') return NextResponse.json({ error: 'A page already uses that address.' }, { status: 409 });
    console.error('Site page create failed', error);
    return NextResponse.json({ error: 'A new page could not be added.' }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const { session, creator } = await requireCreator();
    const parsed = siteDraftSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Check your site content.' }, { status: 400 });
    const input = parsed.data;
    const db = getDatabase();
    const [site] = await db.select().from(sites).where(eq(sites.creatorId, creator.id)).limit(1);
    if (!site) return NextResponse.json({ error: 'Create your site workspace first.' }, { status: 404 });
    const [page] = await db.select({ id: sitePages.id }).from(sitePages).where(and(eq(sitePages.creatorId, creator.id), eq(sitePages.siteId, site.id), eq(sitePages.id, input.pageId))).limit(1);
    if (!page) return NextResponse.json({ error: 'That page does not belong to your site.' }, { status: 404 });
    const content = { schemaVersion: 1, sections: input.sections };
    const updated = await db.transaction(async (tx) => {
      const [savedPage] = await tx.update(sitePages).set({
        title: input.title, slug: input.slug, isHome: input.isHome, draftContent: content,
        ...(input.publish ? { publishedContent: content } : {}),
        seo: input.seo, updatedAt: new Date(),
      }).where(and(eq(sitePages.id, input.pageId), eq(sitePages.creatorId, creator.id))).returning();
      const [savedSite] = await tx.update(sites).set({
        theme: input.theme, seo: input.seo, status: input.publish ? 'published' : site.status,
        publishedAt: input.publish ? new Date() : site.publishedAt, updatedAt: new Date(),
      }).where(and(eq(sites.id, site.id), eq(sites.creatorId, creator.id))).returning();
      await tx.insert(auditLogs).values({ actorUserId: session.user.id, action: input.publish ? 'site.publish' : 'site.save', entityType: 'site_page', entityId: input.pageId, after: { title: input.title, slug: input.slug, published: input.publish } });
      return { page: savedPage, site: savedSite };
    });
    return NextResponse.json(updated, { headers: input.publish ? { 'Cache-Control': 'no-store' } : undefined });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
    if (code === '23505') return NextResponse.json({ error: 'A page already uses that address.' }, { status: 409 });
    console.error('Site save failed', error);
    return NextResponse.json({ error: 'Your website could not be saved.' }, { status: 503 });
  }
}
