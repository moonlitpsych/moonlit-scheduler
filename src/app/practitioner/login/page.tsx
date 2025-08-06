// src/app/practitioner/login/page.tsx
'use client'

import { useAuth } from '@/contexts/AuthContext'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function PractitionerLoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const { signIn } = useAuth()
    const router = useRouter()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { error } = await signIn(email, password)
            if (error) {
                setError(error.message)
            } else {
                router.push('/practitioner/dashboard')
            }
        } catch (err: any) {
            setError('An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
            <div className="max-w-md w-full">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
                            Moonlit Practitioner Portal
                        </h1>
                        <p className="text-[#091747]/70 mt-2 font-['Newsreader']">
                            Sign in to manage your schedule
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
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
                                className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73] transition-colors"
                                placeholder="your.email@moonlit.com"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-[#091747] mb-2">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 border-2 border-stone-200 rounded-lg focus:outline-none focus:border-[#BF9C73] transition-colors"
                                placeholder="Enter your password"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#BF9C73] hover:bg-[#A88861] text-white py-3 px-6 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Signing in...
                                </>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </form>

                    {/* Footer Links */}
                    <div className="mt-6 text-center">
                        <a href="#" className="text-sm text-[#BF9C73] hover:text-[#A88861]">
                            Forgot password?
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}