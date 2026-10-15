import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to view your learning library.' }, { status: 401 });
  const admin = getAdminSupabase();
  const { data: rights, error } = await admin.from('creator_entitlements').select('product_id,order_id,granted_at').eq('buyer_user_id', user.id).is('revoked_at', null).order('granted_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Could not load your library.' }, { status: 500 });
  const ids = (rights ?? []).map(right => right.product_id);
  if (!ids.length) return NextResponse.json({ items: [] });
  const [{ data: products }, { data: contents }, { data: files }] = await Promise.all([
    admin.from('creator_products').select('id,title,slug,kind,creator_id').in('id', ids),
    admin.from('creator_product_content').select('product_id,content_body').in('product_id', ids),
    admin.from('creator_product_files').select('id,product_id,file_name,size_bytes,status').in('product_id', ids).eq('status', 'READY'),
  ]);
  const creatorIds = [...new Set((products ?? []).map(product => product.creator_id))];
  const { data: creators } = await admin.from('creators').select('id,display_name,slug').in('id', creatorIds);
  const contentById = new Map((contents ?? []).map(item => [item.product_id, item.content_body]));
  const creatorById = new Map((creators ?? []).map(creator => [creator.id, creator]));
  const { data: orders } = await admin.from('creator_orders').select('id,amount,currency').in('id', (rights ?? []).map(right => right.order_id));
  const orderById = new Map((orders ?? []).map(order => [order.id, order]));
  const entitlementByProductId = new Map((rights ?? []).map(right => [right.product_id, right]));
  const filesByProductId = new Map((files ?? []).map(file => [file.product_id, [{ id: file.id, file_name: file.file_name, size_bytes: file.size_bytes }]]));
  return NextResponse.json({ items: (products ?? []).map(product => {
    const entitlement = entitlementByProductId.get(product.id);
    return { ...product, content_body: contentById.get(product.id) ?? '', files: filesByProductId.get(product.id) ?? [], creator: creatorById.get(product.creator_id) ?? null, order: entitlement ? orderById.get(entitlement.order_id) ?? null : null };
  }) });
}
