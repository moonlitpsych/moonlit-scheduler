// src/lib/auth.ts
import { Database } from '@/types/database'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type UserRole = 'admin' | 'practitioner' | 'psychiatrist' | 'psychiatry_resident'

export interface AuthUser {
  id: string
  email: string
  provider?: {
    id: string
    first_name: string
    last_name: string
    role_name: UserRole
    role_permissions: string[]
    profile_completed: boolean
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = createServerComponentClient<Database>({ cookies })
  
  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return null
    }

    // Get provider profile with role information
    const { data: provider, error: providerError } = await supabase
      .from('provider_profiles')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (providerError) {
      console.error('Error fetching provider profile:', providerError)
      return {
        id: user.id,
        email: user.email!,
      }
    }

    return {
      id: user.id,
      email: user.email!,
      provider: provider ? {
        id: provider.id,
        first_name: provider.first_name || '',
        last_name: provider.last_name || '',
        role_name: provider.role_name as UserRole,
        role_permissions: provider.role_permissions || [],
        profile_completed: provider.profile_completed || false,
      } : undefined
    }
  } catch (error) {
    console.error('Error in getAuthUser:', error)
    return null
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  
  if (!user) {
    redirect('/auth/login')
  }
  
  return user
}

export async function requireProvider(): Promise<AuthUser & { provider: NonNullable<AuthUser['provider']> }> {
  const user = await requireAuth()
  
  if (!user.provider) {
    redirect('/dashboard/setup-profile')
  }
  
  return user as AuthUser & { provider: NonNullable<AuthUser['provider']> }
}

export async function requireRole(allowedRoles: UserRole[]): Promise<AuthUser & { provider: NonNullable<AuthUser['provider']> }> {
  const user = await requireProvider()
  
  if (!allowedRoles.includes(user.provider.role_name)) {
    redirect('/dashboard/unauthorized')
  }
  
  return user
}

export async function requireAdmin(): Promise<AuthUser & { provider: NonNullable<AuthUser['provider']> }> {
  return requireRole(['admin'])
}

export function hasPermission(user: AuthUser, permission: string): boolean {
  return user.provider?.role_permissions?.includes(permission) || false
}

// Client-side auth helper
export async function signOut() {
  const supabase = createServerComponentClient<Database>({ cookies })
  await supabase.auth.signOut()
}