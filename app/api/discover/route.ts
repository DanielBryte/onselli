import { desc, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getDatabase } from '@/src/server/db';
import { creators } from '@/src/server/db/schema';

export async function GET() {
  try {
    const rows = await getDatabase().select({ id: creators.id, display_name: creators.displayName, slug: creators.slug, headline: creators.headline, bio: creators.bio }).from(creators).where(eq(creators.status, 'active')).orderBy(desc(creators.createdAt)).limit(100);
    return NextResponse.json({ creators: rows }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } });
  } catch (error) { console.error('Creator directory unavailable', error); return NextResponse.json({ error: 'Creator discovery is temporarily unavailable.' }, { status: 503 }); }
}
