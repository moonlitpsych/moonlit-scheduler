// src/app/staff-login/page.tsx
'use client'

import { createClient } from '@supabase/supabase-js'
import { AlertCircle, CheckCircle, Lock, Mail } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Initialize Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function StaffLoginPage() {
    const router = useRouter()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            })

            if (error) {
                setError(error.message)
            } else if (data.user) {
                // Check if user is authorized staff
                const staffEmails = [
                    'hello@trymoonlit.com',
                    'miriam@trymoonlit.com',
                    'rufus@trymoonlit.com',
                    'dr.sweeney@trymoonlit.com'
                ]

                if (staffEmails.includes(data.user.email?.toLowerCase() || '')) {
                    setSuccess('Login successful! Redirecting...')
                    // Redirect to booking page or admin dashboard
                    setTimeout(() => {
                        router.push('/') // Or wherever the booking widget is
                    }, 1500)
                } else {
                    // Sign out non-staff user
                    await supabase.auth.signOut()
                    setError('Access denied. This login is for authorized staff only.')
                }
            }
        } catch (err) {
            setError('An error occurred during login. Please try again.')
            console.error('Login error:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleMagicLink = async () => {
        if (!email) {
            setError('Please enter your email address')
            return
        }

        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${window.location.origin}/`,
                }
            })

            if (error) {
                setError(error.message)
            } else {
                setSuccess('Check your email for the login link!')
            }
        } catch (err) {
            setError('An error occurred. Please try again.')
            console.error('Magic link error:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                {/* Logo/Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-600 rounded-full mb-4">
                        <Lock className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800">Moonlit Staff Portal</h1>
                    <p className="text-gray-600 mt-2">Authorized personnel only</p>
                </div>

                {/* Login Form */}
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    <form onSubmit={handleLogin} className="space-y-6">
                        {/* Email Field */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email Address
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="hello@trymoonlit.com"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg 
                                             focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    id="password"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg 
                                             focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <div className="flex items-center">
                                    <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        )}

                        {/* Success Message */}
                        {success && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center">
                                    <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                                    <p className="text-sm text-green-700">{success}</p>
                                </div>
                            </div>
                        )}

                        {/* Login Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold
                                     hover:bg-purple-700 transition-colors disabled:opacity-50 
                                     disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-300"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white text-gray-500">Or</span>
                            </div>
                        </div>

                        {/* Magic Link Button */}
                        <button
                            type="button"
                            onClick={handleMagicLink}
                            disabled={loading}
                            className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg font-semibold
                                     hover:bg-gray-200 transition-colors disabled:opacity-50 
                                     disabled:cursor-not-allowed"
                        >
                            Send Magic Link to Email
                        </button>
                    </form>

                    {/* Help Text */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <p className="text-sm text-gray-600 text-center">
                            For access issues, contact IT support at{' '}
                            <a href="mailto:support@trymoonlit.com" className="text-purple-600 hover:underline">
                                support@trymoonlit.com
                            </a>
                        </p>
                    </div>
                </div>

                {/* Back to Main Site */}
                <div className="mt-6 text-center">
                    <a href="/" className="text-sm text-gray-600 hover:text-gray-800 transition-colors">
                        ← Back to main site
                    </a>
                </div>
            </div>
        </div>
    )
}