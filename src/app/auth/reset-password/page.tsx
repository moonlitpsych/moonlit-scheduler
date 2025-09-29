'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { UserCheck, Mail, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClientComponentClient<Database>()

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Always use production domain for reset links unless explicitly on localhost
      const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      const baseUrl = isLocalhost ? window.location.origin : 'https://trymoonlit.com'

      console.log('Password reset redirect URL:', `${baseUrl}/auth/reset-password/confirm`)

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${baseUrl}/auth/reset-password/confirm`
      })

      if (error) {
        setError(error.message)
      } else {
        setSent(true)
      }
    } catch (err: any) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-[#091747] mb-2 font-['Newsreader']">
              Check Your Email
            </h1>
            
            <p className="text-[#091747]/70 mb-6 font-['Newsreader'] font-light">
              We've sent password reset instructions to <strong>{email}</strong>. 
              Please check your email and follow the link to reset your password.
            </p>
            
            <div className="space-y-3">
              <Link 
                href="/auth/login"
                className="block w-full px-6 py-3 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg font-medium font-['Newsreader'] transition-colors"
              >
                Back to Login
              </Link>
              
              <button 
                onClick={() => {
                  setSent(false)
                  setEmail('')
                }}
                className="block w-full px-6 py-3 border border-gray-300 hover:border-[#BF9C73] text-gray-700 hover:text-[#BF9C73] rounded-lg font-medium font-['Newsreader'] transition-colors"
              >
                Send to Different Email
              </button>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-[#091747]/60 font-['Newsreader'] font-light">
              Didn't receive the email? Check your spam folder or{' '}
              <a 
                href="mailto:hello@trymoonlit.com" 
                className="text-[#BF9C73] hover:text-[#BF9C73]/80 transition-colors"
              >
                contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-[#BF9C73] rounded-2xl flex items-center justify-center">
              <UserCheck className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[#091747] mb-2 font-['Newsreader']">
            Reset Password
          </h1>
          <p className="text-[#091747]/70 font-['Newsreader'] font-light">
            Provider Dashboard Access Recovery
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="mb-6">
            <Link 
              href="/auth/login"
              className="inline-flex items-center text-[#BF9C73] hover:text-[#BF9C73]/80 transition-colors font-['Newsreader']"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Link>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm font-['Newsreader'] font-light">{error}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-[#091747] mb-3 font-['Newsreader']">
              Forgot Your Password?
            </h2>
            <p className="text-[#091747]/70 text-sm font-['Newsreader'] font-light">
              Enter your provider email address and we'll send you a secure link to reset your password.
            </p>
          </div>

          {/* Reset Form */}
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#091747] mb-2 font-['Newsreader']">
                Provider Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors font-['Newsreader']"
                placeholder="Enter your provider email"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors font-['Newsreader'] flex items-center justify-center"
            >
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending Reset Link...
                </div>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          {/* Security Note */}
          <div className="mt-6 p-4 bg-[#FEF8F1]/70 border border-[#BF9C73]/20 rounded-lg">
            <div className="flex items-start space-x-3">
              <UserCheck className="w-5 h-5 text-[#BF9C73] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[#BF9C73] font-medium text-sm font-['Newsreader']">
                  Security Notice
                </p>
                <p className="text-[#BF9C73]/80 text-xs mt-1 font-['Newsreader'] font-light">
                  The reset link will expire in 1 hour for security. Only provider 
                  email addresses registered in our system can receive reset links.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-sm text-[#091747]/70 font-['Newsreader'] font-light">
            Still having trouble?{' '}
            <a 
              href="mailto:hello@trymoonlit.com?subject=Provider%20Password%20Reset%20Help" 
              className="text-[#BF9C73] hover:text-[#BF9C73]/80 transition-colors"
            >
              Contact Support
            </a>
          </p>
        </div>

        {/* Partner Portal Link */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#091747]/50 font-['Newsreader'] font-light">
            Looking for partner portal access?{' '}
            <Link 
              href="/partner-auth/login" 
              className="text-[#BF9C73] hover:text-[#BF9C73]/80 transition-colors"
            >
              Partner Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}