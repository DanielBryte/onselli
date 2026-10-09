import 'server-only';
import { createServerSupabase } from '@onselli/database/server';

export function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Server Supabase is not configured.');
  return createServerSupabase(url, key);
}

export async function getUserFromRequest(request: Request) {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const client = createServerSupabase(url, key);
  const { data, error } = await client.auth.getUser(token);
  return error ? null : data.user;
}
