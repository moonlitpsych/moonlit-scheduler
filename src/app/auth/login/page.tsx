'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { authContextManager } from '@/lib/auth-context'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSignUp, setIsSignUp] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  // Auto-redirect if already authenticated - with loop prevention
  useEffect(() => {
    const checkAuth = async () => {
      // Only check auth if we haven't already tried
      if (loading || error) return
      
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        console.log('User already logged in, redirecting...', user.email)
        await handleAuthenticatedUser()
      }
    }
    
    // Only run on initial mount
    checkAuth()
  }, []) // Empty dependency array prevents loops

  const handleAuthenticatedUser = async () => {
    try {
      const authContext = await authContextManager.getUserAuthContext()
      
      if (!authContext.user) return
      
      console.log('Available roles:', authContext.availableRoles.map(r => r.role))
      
      if (authContext.canSwitchContext) {
        console.log('Multi-role user detected, showing context chooser')
        router.replace('/choose-context')
      } else if (authContext.availableRoles.length > 0) {
        const singleRole = authContext.availableRoles[0]
        const route = authContextManager.getDashboardRoute(singleRole.role)
        console.log(`Single role (${singleRole.role}) detected, redirecting to ${route}`)
        router.replace(route)
      } else {
        console.log('No valid roles found, staying on login')
        setError('No access permissions found for your account')
      }
    } catch (err) {
      console.error('Error determining user context:', err)
      setError('Unable to determine account permissions')
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    console.log('Attempting login for:', email)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error('Login error:', error)
        setError(error.message)
      } else if (data.user) {
        console.log('Login successful! User:', data.user.email)
        await handleAuthenticatedUser()
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          }
        }
      })

      if (error) {
        setError(error.message)
      } else if (data.user) {
        setSignUpSuccess(true)
        setIsSignUp(false)
        // Clear form
        setFirstName('')
        setLastName('')
        setPassword('')
      }
    } catch (err) {
      setError('An unexpected error occurred during sign up')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">Moonlit</h1>
          <p className="text-[#091747]/70 mt-2">Provider Dashboard</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-[#091747] mb-6 font-['Newsreader']">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          {/* Success Message */}
          {signUpSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 text-sm">
                Account created successfully! Please check your email for confirmation, then sign in below.
              </p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {isSignUp ? (
            /* Sign Up Form */
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-[#091747] mb-2">
                    First Name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-[#091747] mb-2">
                    Last Name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#091747] mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#091747] mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    placeholder="Create a password (min 6 chars)"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowPassword(!showPassword)
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer z-10"
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
                className="w-full bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                {loading ? (
                  'Creating Account...'
                ) : (
                  <>
                    <UserPlus className="w-5 h-5 mr-2" />
                    Create Account
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Sign In Form */
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#091747] mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                  placeholder="Enter your email"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#091747] mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 pr-12 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setShowPassword(!showPassword)
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer z-10"
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
                className="w-full bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Toggle Sign Up / Sign In */}
          <div className="mt-6 pt-6 border-t border-stone-200">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp)
                setError(null)
                setSignUpSuccess(false)
              }}
              className="w-full text-center text-sm text-[#091747]/70 hover:text-[#091747] transition-colors"
            >
              {isSignUp ? (
                <>Already have an account? <span className="text-[#BF9C73] font-semibold">Sign In</span></>
              ) : (
                <>Don't have an account? <span className="text-[#BF9C73] font-semibold">Create Account</span></>
              )}
            </button>
          </div>

          {!isSignUp && (
            <div className="mt-4 text-center">
              <Link 
                href="/auth/reset-password" 
                className="text-[#BF9C73] hover:text-[#BF9C73]/80 text-sm transition-colors"
              >
                Forgot your password?
              </Link>
            </div>
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-[#091747]/70">
            Need help accessing your account?{' '}
            <a 
              href="mailto:hello@trymoonlit.com" 
              className="text-[#BF9C73] hover:text-[#BF9C73]/80 transition-colors"
            >
              Contact Admin
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}