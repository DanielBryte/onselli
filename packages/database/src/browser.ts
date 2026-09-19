import { createClient } from '@supabase/supabase-js';

export function createBrowserSupabase(url: string, publishableKey: string) {
  if (!url || !publishableKey) throw new Error('Supabase public configuration is missing.');
  return createClient(url, publishableKey, { auth: { persistSession: true, autoRefreshToken: true } });
}
