'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Building2, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function PartnerLogoutPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  useEffect(() => {
    const handleLogout = async () => {
      try {
        setLoading(true)
        
        // Sign out from Supabase
        const { error } = await supabase.auth.signOut()
        
        if (error) {
          console.error('Logout error:', error)
          setError('Failed to sign out. Please try again.')
        } else {
          console.log('Partner logged out successfully')
          
          // Small delay for user feedback
          setTimeout(() => {
            router.replace('/partner-auth/login')
          }, 1500)
        }
      } catch (err: any) {
        console.error('Unexpected logout error:', err)
        setError('An unexpected error occurred during logout')
      } finally {
        setLoading(false)
      }
    }

    handleLogout()
  }, [router, supabase.auth])

  const handleRetryLogout = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        setError('Failed to sign out. Please try again.')
      } else {
        router.replace('/partner-auth/login')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-moonlit-cream via-moonlit-peach/20 to-moonlit-cream flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-red-200 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-8 h-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
              Logout Error
            </h1>
            
            <p className="text-red-600 mb-6 font-['Newsreader'] font-light">
              {error}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button 
                onClick={handleRetryLogout}
                disabled={loading}
                className="px-6 py-3 bg-moonlit-brown hover:bg-moonlit-brown/90 disabled:opacity-50 text-white rounded-lg font-medium font-['Newsreader'] transition-colors"
              >
                {loading ? 'Trying...' : 'Try Again'}
              </button>
              <button 
                onClick={() => router.push('/partner-dashboard')}
                className="px-6 py-3 border border-gray-300 hover:border-moonlit-brown text-gray-700 hover:text-moonlit-brown rounded-lg font-medium font-['Newsreader'] transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-moonlit-cream via-moonlit-peach/20 to-moonlit-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-moonlit-brown/10 text-center">
          <div className="w-16 h-16 bg-moonlit-brown/10 rounded-full flex items-center justify-center mx-auto mb-6">
            {loading ? (
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-moonlit-brown"></div>
            ) : (
              <LogOut className="w-8 h-8 text-moonlit-brown" />
            )}
          </div>
          
          <h1 className="text-2xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
            {loading ? 'Signing Out...' : 'Signed Out Successfully'}
          </h1>
          
          <p className="text-moonlit-navy/70 mb-6 font-['Newsreader'] font-light">
            {loading 
              ? 'Please wait while we securely sign you out of your partner account.'
              : 'You have been successfully signed out. Redirecting to login...'
            }
          </p>
          
          {!loading && (
            <div className="flex items-center justify-center space-x-2 text-moonlit-brown">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-moonlit-brown"></div>
              <span className="text-sm font-['Newsreader']">Redirecting...</span>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-moonlit-navy/70 font-['Newsreader'] font-light">
            Thank you for using the Moonlit Psychiatry Partner Portal
          </p>
        </div>
      </div>
    </div>
  )
}