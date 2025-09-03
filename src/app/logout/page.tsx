'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/database'

export default function LogoutPage() {
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const handleLogout = async () => {
      try {
        console.log('Logging out...')
        await supabase.auth.signOut()
        console.log('Logout successful')
        
        // Clear any local storage
        if (typeof window !== 'undefined') {
          localStorage.clear()
          sessionStorage.clear()
        }
        
        // Redirect to login after logout
        setTimeout(() => {
          router.replace('/auth/login')
        }, 1000)
      } catch (error) {
        console.error('Logout error:', error)
        router.replace('/auth/login')
      }
    }

    handleLogout()
  }, [router, supabase])

  return (
    <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73]"></div>
        <p className="mt-4 text-[#091747]/70">Signing you out...</p>
      </div>
    </div>
  )
}