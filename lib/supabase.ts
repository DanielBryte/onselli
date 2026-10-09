'use client';

import { createBrowserSupabase } from '@onselli/database/browser';

let client: ReturnType<typeof createBrowserSupabase> | null = null;

export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createBrowserSupabase(url, key);
  return client;
}
