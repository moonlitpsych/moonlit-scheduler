// Admin Authentication Utilities
// Restricted to specific admin email addresses only

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

// Admin-only email addresses (as specified in claude.md)
const ADMIN_EMAILS = [
  'hello@trymoonlit.com',
  'rufussweeney@gmail.com'
]

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function checkAdminAuth() {
  const supabase = createClientComponentClient<Database>()
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error || !user) {
      return { isAuthenticated: false, isAdmin: false, user: null }
    }

    const isAdmin = isAdminEmail(user.email || '')
    
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