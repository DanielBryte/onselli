import { NextResponse } from 'next/server';
import { auth } from '@/src/server/auth';
import { storeCreatorLogo } from '@/src/server/workspaces/logo';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ error: 'Sign in to upload a workspace logo.' }, { status: 401 });
  const appUser = session.user as typeof session.user & { emailVerified?: boolean; adminRole?: string | null };
  if (!appUser.emailVerified || appUser.adminRole) return NextResponse.json({ error: 'Verify your email before uploading a workspace logo.' }, { status: 403 });

  const requestLength = Number(request.headers.get('content-length') ?? 0);
  if (requestLength > 2_200_000) return NextResponse.json({ error: 'Your logo must be smaller than 2 MB.' }, { status: 413 });
  try {
    const form = await request.formData();
    const file = form.get('logo');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose an image file for your logo.' }, { status: 400 });
    const stored = await storeCreatorLogo(session.user.id, file);
    return NextResponse.json(stored, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not upload this logo.';
    const status = /PNG|JPG|WebP|2 MB|match its image type|Choose (an image|a logo)/i.test(message) ? 400 : 503;
    if (status === 503) console.error('Workspace logo upload failed', error);
    return NextResponse.json({ error: message }, { status });
  }
}
