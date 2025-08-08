// src/services/authService.ts
'use client'

import { createClient, User } from '@supabase/supabase-js'

// Create Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface AuthServiceResponse {
    user?: User
    error?: any
}

export interface Provider {
    id: string
    first_name: string
    last_name: string
    email: string
    role: string
    availability: boolean
}

class AuthService {
    
    /**
     * Sign in with email and password
     */
    async signIn(email: string, password: string): Promise<AuthServiceResponse> {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })

            if (error) {
                return { error }
            }

            return { user: data.user || undefined }
        } catch (error) {
            return { error }
        }
    }

    /**
     * Sign up with email and password
     */
    async signUp(email: string, password: string): Promise<AuthServiceResponse> {
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            })

            if (error) {
                return { error }
            }

            return { user: data.user || undefined }
        } catch (error) {
            return { error }
        }
    }

    /**
     * Sign out current user
     */
    async signOut(): Promise<{ error?: any }> {
        try {
            const { error } = await supabase.auth.signOut()
            return { error }
        } catch (error) {
            return { error }
        }
    }

    /**
     * Get current user session
     */
    async getCurrentUser(): Promise<User | null> {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            return user
        } catch (error) {
            console.error('AuthService.getCurrentUser error:', error)
            return null
        }
    }

    /**
     * Get current session
     */
    async getSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            return session
        } catch (error) {
            console.error('AuthService.getSession error:', error)
            return null
        }
    }

    /**
     * Get provider profile for authenticated user
     */
    async getProviderProfile(userId: string): Promise<Provider | null> {
        try {
            const { data, error } = await supabase
                .from('providers')
                .select('*')
                .eq('user_id', userId)
                .single()

            if (error) {
                console.error('AuthService.getProviderProfile error:', error)
                return null
            }

            return data
        } catch (error) {
            console.error('AuthService.getProviderProfile error:', error)
            return null
        }
    }

    /**
     * Check if user is staff/admin
     */
    async isStaff(email: string): Promise<boolean> {
        // Staff emails (Miriam and Dr. Norseth)
        const staffEmails = [
            'miriam@moonlit.health',
            'dr.norseth@moonlit.health',
            'travis.norseth@gmail.com'
        ]
        
        return staffEmails.includes(email.toLowerCase())
    }

    /**
     * Listen for auth state changes
     */
    onAuthStateChange(callback: (event: string, session: any) => void) {
        return supabase.auth.onAuthStateChange(callback)
    }
}

// Export singleton instance
export const authService = new AuthService()
export { supabase }
