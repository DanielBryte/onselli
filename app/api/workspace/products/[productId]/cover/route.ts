import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { AuthorizationError, requireCreator } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { products } from '@/src/server/db/schema';
import { storeProductCover } from '@/src/server/workspaces/logo';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const { creator } = await requireCreator();
    const { productId } = await params;
    const [product] = await getDatabase().select({ id: products.id }).from(products)
      .where(and(eq(products.id, productId), eq(products.creatorId, creator.id))).limit(1);
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const form = await request.formData();
    const file = form.get('cover');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image to upload.' }, { status: 400 });
    const cover = await storeProductCover(creator.id, productId, file);
    await getDatabase().update(products).set({ coverKey: cover.key, updatedAt: new Date() })
      .where(and(eq(products.id, productId), eq(products.creatorId, creator.id)));
    return NextResponse.json({ cover });
  } catch (error) {
    if (error instanceof AuthorizationError) return NextResponse.json({ error: error.message }, { status: 401 });
    const message = error instanceof Error ? error.message : 'Cover upload failed.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
