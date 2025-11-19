// Admin Authentication Utilities
// Restricted to specific admin email addresses only

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Admin-only email addresses (hardcoded fallback/override)
// These emails ALWAYS have admin access, even if not in database
const ADMIN_EMAILS = [
  'hello@trymoonlit.com',
  'rufussweeney@gmail.com',
  'hyrum.bay@gmail.com'  // Executive Assistant
]

// Cache for database admin emails (5 minute TTL)
let adminEmailsCache: string[] = []
let cacheExpiry: number = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Fetch admin emails from database
 * Uses caching to reduce database load
 */
async function getAdminEmailsFromDB(): Promise<string[]> {
  const now = Date.now()

  // Return cached emails if still valid
  if (adminEmailsCache.length > 0 && now < cacheExpiry) {
    return adminEmailsCache
  }

  try {
    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!
    const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey)

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching admin emails from database:', error)
      return []
    }

    const emails = data?.map(row => row.email.toLowerCase()) || []

    // Update cache
    adminEmailsCache = emails
    cacheExpiry = now + CACHE_TTL_MS

    return emails
  } catch (error) {
    console.error('Unexpected error fetching admin emails:', error)
    return []
  }
}

/**
 * Check if email is an admin
 * Checks BOTH hardcoded array AND database
 * Hardcoded emails always take precedence (override)
 */
export async function isAdminEmail(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase()

  // Check hardcoded list first (fast, synchronous)
  if (ADMIN_EMAILS.includes(normalizedEmail)) {
    return true
  }

  // Check database (cached)
  const dbEmails = await getAdminEmailsFromDB()
  return dbEmails.includes(normalizedEmail)
}

/**
 * Synchronous version for backward compatibility
 * Only checks hardcoded array, not database
 * Use isAdminEmail() instead for full check
 */
export function isAdminEmailSync(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function checkAdminAuth() {
  const supabase = createClientComponentClient<Database>()

  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      return { isAuthenticated: false, isAdmin: false, user: null }
    }

    const isAdmin = await isAdminEmail(user.email || '')

    return {
      isAuthenticated: true,
      isAdmin,
      user: isAdmin ? user : null // Only return user if admin
    }
  } catch (error) {
    console.error('Admin auth check error:', error)
    return { isAuthenticated: false, isAdmin: false, user: null }
  }
}

// Hook for admin-only components
export function useAdminAuth() {
  // This would typically use React hooks in a client component
  // For now, providing the pattern for implementation
  return { checkAdminAuth }
}

// Admin role verification for API routes
export async function verifyAdminAccess(request: Request): Promise<{ authorized: boolean, user: any }> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return { authorized: false, user: null }
  }

  // Extract and verify admin email from token
  // This is a simplified implementation - in production you'd verify the JWT token
  try {
    // For now, we'll implement a basic check
    // In production, you'd decode and verify the JWT token properly
    const token = authHeader.replace('Bearer ', '')
    
    // This is placeholder logic - replace with actual JWT verification
    if (token === 'admin-token') {
      return {
        authorized: true,
        user: { email: 'hello@trymoonlit.com', role: 'admin' }
      }
    }
    
    return { authorized: false, user: null }
  } catch (error) {
    console.error('Admin token verification error:', error)
    return { authorized: false, user: null }
  }
}