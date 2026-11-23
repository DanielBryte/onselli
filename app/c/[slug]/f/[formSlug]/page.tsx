import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDatabase } from '@/src/server/db';
import { creators, forms } from '@/src/server/db/schema';
import { PublicForm } from './PublicForm';
import { getCreatorIdForSlug } from '@/src/server/workspaces/resolve-slug';

export const revalidate = 300;

export default async function PublicFormPage({ params }: { params: Promise<{ slug: string; formSlug: string }> }) {
  const { slug, formSlug } = await params;
  const creatorId = await getCreatorIdForSlug(slug);
  const [result] = creatorId ? await getDatabase().select({ creator: creators, form: forms }).from(forms).innerJoin(creators, eq(forms.creatorId, creators.id))
    .where(and(eq(creators.id, creatorId), eq(creators.status, 'active'), eq(forms.slug, formSlug), eq(forms.status, 'published'))).limit(1) : [];
  if (!result) notFound();
  return <PublicForm creatorSlug={result.creator.slug} creatorName={result.creator.displayName} formSlug={result.form.slug} title={result.form.title} fields={result.form.fields} settings={result.form.settings} />;
}
