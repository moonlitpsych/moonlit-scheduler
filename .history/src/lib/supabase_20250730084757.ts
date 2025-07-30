// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false, // For booking widget, we don't need auth persistence
    },
    db: {
        schema: 'public'
    }
})

// Service client for server-side operations
export const supabaseAdmin = createClient<Database>(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)