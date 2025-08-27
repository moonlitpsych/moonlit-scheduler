import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Grab the URL and key from environment variables
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Stop early if either value is missing
if (!url || !anonKey) {
  throw new Error('Supabase credentials are missing');
}

// Export a reusable Supabase client
export const supabase = createSupabaseClient(url, anonKey);

// Also export the createClient function for other components
export const createClient = () => createSupabaseClient(url!, anonKey!);
