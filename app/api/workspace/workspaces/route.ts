import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { requireBuyer } from '@/src/server/auth/permissions';
import { getDatabase } from '@/src/server/db';
import { creators } from '@/src/server/db/schema';

export const runtime = 'nodejs';

export async function PATCH(request: Request) {
  try {
    const session = await requireBuyer();
    const body = await request.json().catch(() => null) as { workspaceId?: unknown } | null;
    const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
    if (!workspaceId) return NextResponse.json({ error: 'Choose a workspace to switch to.' }, { status: 400 });
    const [workspace] = await getDatabase().select({ id: creators.id }).from(creators)
      .where(and(eq(creators.id, workspaceId), eq(creators.userId, session.user.id), eq(creators.status, 'active'))).limit(1);
    if (!workspace) return NextResponse.json({ error: 'That workspace is unavailable.' }, { status: 404 });
    const response = NextResponse.json({ activeWorkspaceId: workspace.id });
    response.cookies.set('onselli_creator_id', workspace.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch {
    return NextResponse.json({ error: 'Your session has expired. Sign in and try again.' }, { status: 401 });
  }
}
