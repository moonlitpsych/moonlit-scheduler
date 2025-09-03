'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Eye, EyeOff, Building2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function PartnerLoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  // Auto-redirect if already authenticated as partner
  useEffect(() => {
    const checkPartnerAuth = async () => {
      if (loading || error) return
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Check if this user has partner access
        try {
          const response = await fetch('/api/partner/me', {
            headers: {
              'x-partner-user-id': user.id
            }
          })
          
          if (response.ok) {
            console.log('Partner already logged in, redirecting...')
            router.replace('/partner-dashboard')
          }
        } catch (err) {
          // Not a partner user, stay on login page
        }
      }
    }
    
    checkPartnerAuth()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log('Attempting partner login for:', email)

    try {
      // First, authenticate with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Authentication error:', error)
        setError(error.message)
        return
      }

      if (data.user) {
        console.log('Authentication successful, checking partner access...')
        
        // Check if this user has partner access
        const partnerResponse = await fetch('/api/partner/me', {
          headers: {
            'x-partner-user-id': data.user.id
          }
        })
        
        const partnerResult = await partnerResponse.json()
        
        if (partnerResult.success) {
          console.log('Partner access confirmed, redirecting to dashboard...')
          router.replace('/partner-dashboard')
        } else {
          // User authenticated but not a partner
          await supabase.auth.signOut()
          setError('This account does not have partner access. Please check your credentials or contact hello@trymoonlit.com for access.')
        }
      }
    } catch (err: any) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred during login')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-moonlit-cream via-moonlit-peach/20 to-moonlit-cream flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-moonlit-brown rounded-2xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-moonlit-navy mb-2 font-['Newsreader']">
            Moonlit Psychiatry
          </h1>
          <p className="text-moonlit-navy/70 font-['Newsreader']">Partner Portal</p>
          <p className="text-sm text-moonlit-navy/60 mt-1 font-['Newsreader'] font-light">
            For referral organizations and case managers
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-moonlit-brown/10">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-semibold text-moonlit-navy font-['Newsreader']">
              Partner Sign In
            </h2>
            <p className="text-moonlit-navy/60 mt-2 text-sm font-['Newsreader'] font-light">
              Access your organization dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm font-['Newsreader'] font-light">{error}</p>
            </div>
          )}

          {/* Info Message */}
          <div className="mb-6 p-4 bg-moonlit-cream/50 border border-moonlit-brown/20 rounded-lg">
            <div className="flex items-start space-x-3">
              <Building2 className="w-5 h-5 text-moonlit-brown mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-moonlit-brown font-medium text-sm font-['Newsreader']">
                  Partner Access Required
                </p>
                <p className="text-moonlit-brown/80 text-xs mt-1 font-['Newsreader'] font-light">
                  This portal is for treatment centers, therapy practices, and case management organizations 
                  that refer patients to Moonlit Psychiatry.
                </p>
              </div>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-moonlit-navy mb-2 font-['Newsreader']">
                Organization Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent transition-colors font-['Newsreader']"
                placeholder="Enter your organization email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-moonlit-navy mb-2 font-['Newsreader']">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent transition-colors font-['Newsreader']"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowPassword(!showPassword)
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer z-10"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-moonlit-brown hover:bg-moonlit-brown/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors font-['Newsreader'] flex items-center justify-center"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Signing In...
                </div>
              ) : (
                <>
                  <Building2 className="w-5 h-5 mr-2" />
                  Access Partner Dashboard
                </>
              )}
            </button>
          </form>

          {/* Forgot Password */}
          <div className="mt-6 text-center">
            <Link 
              href="/partner-auth/reset-password" 
              className="text-moonlit-brown hover:text-moonlit-brown/80 text-sm font-['Newsreader'] transition-colors"
            >
              Forgot your password?
            </Link>
          </div>

          {/* Divider */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-moonlit-navy/60 mb-3 font-['Newsreader'] font-light">
                Don't have partner access?
              </p>
              <div className="space-y-2">
                <a 
                  href="mailto:hello@trymoonlit.com?subject=Partner%20Portal%20Access%20Request"
                  className="block w-full px-4 py-2 border border-moonlit-brown text-moonlit-brown hover:bg-moonlit-brown hover:text-white rounded-lg font-medium font-['Newsreader'] transition-colors text-sm"
                >
                  Request Partner Access
                </a>
                <p className="text-xs text-moonlit-navy/50 font-['Newsreader'] font-light">
                  For treatment centers and referral organizations
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-moonlit-navy/70 font-['Newsreader'] font-light">
            Need technical support?{' '}
            <a 
              href="mailto:hello@trymoonlit.com" 
              className="text-moonlit-brown hover:text-moonlit-brown/80 transition-colors"
            >
              Contact Our Team
            </a>
          </p>
          
          {/* Link to Provider Login */}
          <div className="mt-4 pt-4 border-t border-moonlit-navy/10">
            <p className="text-xs text-moonlit-navy/50 font-['Newsreader'] font-light">
              Are you a Moonlit Psychiatry provider?{' '}
              <Link 
                href="/auth/login" 
                className="text-moonlit-brown hover:text-moonlit-brown/80 transition-colors"
              >
                Provider Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}