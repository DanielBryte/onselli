import { NextResponse } from 'next/server';
import { getAdminSupabase } from '@/lib/server-supabase';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.productId !== 'string' || body.productId.length > 80) return NextResponse.json({ ok: false }, { status: 400 });
    const admin = getAdminSupabase();
    const { error } = await admin.rpc('record_creator_product_metric', { product_id_input: body.productId, metric_input: 'PAGE_VIEW' });
    if (error) return NextResponse.json({ ok: false }, { status: 503 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ ok: false }, { status: 503 }); }
}
