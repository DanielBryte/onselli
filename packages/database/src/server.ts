import { createClient } from '@supabase/supabase-js';

export function createServerSupabase(url: string, serviceRoleKey: string) {
  if (!url || !serviceRoleKey) throw new Error('Server Supabase configuration is missing.');
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
