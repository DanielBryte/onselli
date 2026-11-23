import 'server-only';
import { eq } from 'drizzle-orm';
import { getDatabase } from '@/src/server/db';
import { creatorSlugHistory, creators } from '@/src/server/db/schema';

export async function getCreatorIdForSlug(slug: string) {
  const db = getDatabase();
  const [current] = await db.select({ id: creators.id }).from(creators).where(eq(creators.slug, slug)).limit(1);
  if (current) return current.id;
  const [historic] = await db.select({ creatorId: creatorSlugHistory.creatorId }).from(creatorSlugHistory).where(eq(creatorSlugHistory.slug, slug)).limit(1);
  return historic?.creatorId ?? null;
}
