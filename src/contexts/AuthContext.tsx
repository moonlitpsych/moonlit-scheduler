// src/contexts/AuthContext.tsx
'use client'

import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState } from 'react'

interface AuthContextType {
    user: User | null
    profile: any | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: any }>
    signUp: (email: string, password: string) => Promise<{ error: any }>
    signOut: () => Promise<void>
    refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [profile, setProfile] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()

    useEffect(() => {
        // Check for existing session
        checkUser()

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                setUser(session.user)
                await fetchProfile(session.user.id)
            } else {
                setUser(null)
                setProfile(null)
            }
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    async function checkUser() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.user) {
                setUser(session.user)
                await fetchProfile(session.user.id)
            }
        } catch (error) {
            console.error('Error checking user:', error)
        } finally {
            setLoading(false)
        }
    }

    async function fetchProfile(userId: string) {
        try {
            // Fetch auth profile
            const { data: authProfile } = await supabase
                .from('auth_profiles')
                .select('*, providers(*)')
                .eq('id', userId)
                .single()

            setProfile(authProfile)
        } catch (error) {
            console.error('Error fetching profile:', error)
        }
    }

    async function signIn(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })
        return { error }
    }

    async function signUp(email: string, password: string) {
        const { error } = await supabase.auth.signUp({
            email,
            password,
        })
        return { error }
    }

    async function signOut() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    async function refreshProfile() {
        if (user) {
            await fetchProfile(user.id)
        }
    }

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            loading,
            signIn,
            signUp,
            signOut,
            refreshProfile
        }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}