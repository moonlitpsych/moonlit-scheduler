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
  const [loadingMagicLink, setLoadingMagicLink] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'password' | 'magiclink'>('password')

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

  const handleMagicLink = async () => {
    setLoadingMagicLink(true)
    setError(null)
    setMagicLinkSent(false)

    try {
      const response = await fetch('/api/partner-auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (data.success) {
        setMagicLinkSent(true)
      } else {
        setError(data.error || 'Failed to send magic link')
      }
    } catch (err: any) {
      console.error('Magic link error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoadingMagicLink(false)
    }
  }

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

          {/* Magic Link Success Message */}
          {magicLinkSent && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm font-['Newsreader'] font-medium mb-1">
                Check your email!
              </p>
              <p className="text-green-700 text-xs font-['Newsreader'] font-light">
                We've sent a magic link to <strong>{email}</strong>. Click the link in the email to sign in.
                The link will expire in 60 minutes.
              </p>
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

          {/* Login Method Toggle */}
          <div className="mb-4 flex space-x-2 p-1 bg-gray-100 rounded-lg">
            <button
              type="button"
              onClick={() => setLoginMethod('password')}
              className={`flex-1 py-2 px-3 text-sm font-['Newsreader'] rounded-md transition-colors ${
                loginMethod === 'password'
                  ? 'bg-white text-moonlit-navy shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('magiclink')}
              className={`flex-1 py-2 px-3 text-sm font-['Newsreader'] rounded-md transition-colors ${
                loginMethod === 'magiclink'
                  ? 'bg-white text-moonlit-navy shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Magic Link
            </button>
          </div>

          {/* Login Form */}
          {loginMethod === 'password' ? (
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
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 focus:outline-none"
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
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="email-magic" className="block text-sm font-medium text-moonlit-navy mb-2 font-['Newsreader']">
                  Organization Email
                </label>
                <input
                  id="email-magic"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent transition-colors font-['Newsreader']"
                  placeholder="Enter your organization email"
                />
              </div>

              <button
                type="button"
                onClick={handleMagicLink}
                disabled={loadingMagicLink || !email}
                className="w-full bg-moonlit-brown hover:bg-moonlit-brown/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors font-['Newsreader'] flex items-center justify-center"
              >
                {loadingMagicLink ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending Magic Link...
                  </div>
                ) : (
                  <>
                    <Building2 className="w-5 h-5 mr-2" />
                    Send Magic Link
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center font-['Newsreader'] font-light">
                We'll send you a secure link to sign in without a password
              </p>
            </div>
          )}

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