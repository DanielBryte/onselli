import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Sign in to view this purchase.' }, { status: 401 });
  const { id } = await params;
  const { data, error } = await getAdminSupabase().from('creator_orders')
    .select('id,status,amount,currency,product_id,creator_products(title,slug),creators(display_name,slug)')
    .eq('id', id).eq('buyer_user_id', user.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: 'Purchase not found.' }, { status: 404 });
  return NextResponse.json({ order: data });
}
