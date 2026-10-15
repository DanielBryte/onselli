import { NextResponse } from 'next/server';
import { getAdminSupabase, getUserFromRequest } from '@/lib/server-supabase';

export const runtime = 'nodejs';

function databaseMessage(error: { code?: string; message?: string }) {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return 'Creator setup is not ready yet. Please contact support so the creator database migration can be applied.';
  }
  if (error.code === '42501' || error.code === 'PGRST301') {
    return 'Your session could not save this page. Sign out, sign back in, and try again.';
  }
  if (error.code === '23503') {
    return 'Your account profile is still being prepared. Please try again in a moment.';
  }
  return 'We couldn’t save your creator page. Your answers are still here—please try again.';
}

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Your session has expired. Sign in again to continue.' }, { status: 401 });

  try {
    const admin = getAdminSupabase();
    const { data, error } = await admin.from('creators').select('id').eq('user_id', user.id).maybeSingle();
    if (error) {
      console.error('Creator setup lookup failed', { code: error.code, message: error.message });
      return NextResponse.json({ error: databaseMessage(error) }, { status: 503 });
    }
    return NextResponse.json({ exists: Boolean(data) });
  } catch (error) {
    console.error('Creator setup lookup unavailable', error);
    return NextResponse.json({ error: 'Creator setup is temporarily unavailable. Check your connection and try again.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Your session has expired. Sign in again to continue.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const headline = typeof body?.headline === 'string' ? body.headline.trim() : '';
  const bio = typeof body?.bio === 'string' ? body.bio.trim() : '';
  if (displayName.length < 2 || displayName.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 70 || headline.length > 160 || bio.length > 1500) {
    return NextResponse.json({ error: 'Check the page name, address, and introduction, then try again.' }, { status: 400 });
  }

  try {
    const admin = getAdminSupabase();
    // Older or manually provisioned auth accounts may not have the matching app profile row.
    // Insert only when absent; never overwrite a user's existing role or profile details.
    const { error: profileError } = await admin.from('users').upsert(
      { id: user.id, full_name: displayName },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (profileError) {
      console.error('Creator app profile preparation failed', { code: profileError.code, message: profileError.message });
      return NextResponse.json({ error: databaseMessage(profileError) }, { status: 503 });
    }

    const { data: existing, error: lookupError } = await admin.from('creators').select('id').eq('user_id', user.id).maybeSingle();
    if (lookupError) {
      console.error('Creator setup pre-save lookup failed', { code: lookupError.code, message: lookupError.message });
      return NextResponse.json({ error: databaseMessage(lookupError) }, { status: 503 });
    }
    if (existing) return NextResponse.json({ created: false });

    const { error: insertError } = await admin.from('creators').insert({
      user_id: user.id,
      display_name: displayName,
      slug,
      headline: headline || null,
      bio: bio || null,
      status: 'PUBLISHED',
    });
    if (insertError) {
      console.error('Creator page save failed', { code: insertError.code, message: insertError.message, details: insertError.details });
      if (insertError.code === '23505' && /slug/i.test(`${insertError.message} ${insertError.details ?? ''}`)) {
        return NextResponse.json({ error: 'That page address is already taken. Choose another to continue.', field: 'slug' }, { status: 409 });
      }
      // A retry may race with a successful previous request; treat the existing owner page as success.
      if (insertError.code === '23505') {
        const { data: raced } = await admin.from('creators').select('id').eq('user_id', user.id).maybeSingle();
        if (raced) return NextResponse.json({ created: false });
      }
      return NextResponse.json({ error: databaseMessage(insertError) }, { status: 503 });
    }

    return NextResponse.json({ created: true });
  } catch (error) {
    console.error('Creator page save unavailable', error);
    return NextResponse.json({ error: 'We couldn’t connect to save your creator page. Your answers are still here—please try again.' }, { status: 503 });
  }
}
