import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE envs for server admin client');
  }
  return createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Alias for compatibility with existing code
export async function createServerClient() {
  return getAdminClient();
}
