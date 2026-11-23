import { NextResponse } from 'next/server';
import { getEnv } from '@/src/server/config/env';

export const runtime = 'nodejs';

export function GET() {
  const env = getEnv();
  return NextResponse.json({ google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
