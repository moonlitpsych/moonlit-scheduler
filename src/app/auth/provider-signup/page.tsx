'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Check, Eye, EyeOff, Stethoscope, User } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ProviderSignupPage() {
  const [step, setStep] = useState<'auth' | 'profile'>('auth')
  
  // Auth data
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<any>(null)
  
  // Profile data
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [title, setTitle] = useState('')
  const [role, setRole] = useState<'practitioner' | 'psychiatrist' | 'psychiatry_resident'>('practitioner')
  const [specialty, setSpecialty] = useState('')
  const [phone, setPhone] = useState('')
  const [npi, setNpi] = useState('')
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  const router = useRouter()
  const supabase = createClientComponentClient<Database>()

  const handleAuthSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    setAuthError(null)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'provider' // Mark this as a provider signup
          }
        }
      })

      if (error) {
        setAuthError(error.message)
      } else if (data.user) {
        console.log('Auth user created:', data.user.id)
        setAuthUser(data.user)
        setStep('profile')
      }
    } catch (err: any) {
      setAuthError(`Signup error: ${err.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleProfileCreation = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileLoading(true)
    setProfileError(null)

    try {
      // Use API endpoint for better error handling and default setup
      const response = await fetch('/api/auth/create-provider-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          first_name: firstName,
          last_name: lastName,
          title: title,
          role: role,
          specialty: specialty,
          phone: phone,
          npi_number: npi || null
        })
      })

      const result = await response.json()

      if (!result.success) {
        setProfileError(result.error || 'Failed to create provider profile')
      } else {
        console.log('Provider profile created:', result.provider)
        setSuccess(true)
        
        // Redirect to dashboard after success
        setTimeout(() => {
          router.push('/dashboard/availability')
        }, 3000)
      }
    } catch (err: any) {
      console.error('Profile creation error:', err)
      setProfileError(`Profile creation failed: ${err.message}`)
    } finally {
      setProfileLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] mb-4">
            Welcome to Moonlit!
          </h1>
          <p className="text-[#091747]/70 mb-6">
            Your provider account has been created successfully. You'll be redirected to your dashboard in a moment.
          </p>
          <div className="animate-pulse text-[#BF9C73]">
            Setting up your dashboard...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-[#BF9C73] to-[#F6B398] rounded-full flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">Join Moonlit</h1>
          <p className="text-[#091747]/70 mt-2">Provider Registration</p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'auth' ? 'bg-[#BF9C73] text-white' : 'bg-green-500 text-white'
            }`}>
              {step === 'profile' ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className="w-16 h-1 bg-stone-200 mx-2">
              <div className={`h-full bg-[#BF9C73] transition-all duration-300 ${
                step === 'profile' ? 'w-full' : 'w-0'
              }`}></div>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 'profile' ? 'bg-[#BF9C73] text-white' : 'bg-stone-200 text-stone-500'
            }`}>
              2
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {step === 'auth' ? (
            // Step 1: Authentication
            <>
              <h2 className="text-2xl font-semibold text-[#091747] mb-2 font-['Newsreader']">
                Create Your Account
              </h2>
              <p className="text-[#091747]/60 mb-6 text-sm">
                First, we'll set up your secure login credentials.
              </p>

              {authError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{authError}</p>
                </div>
              )}

              <form onSubmit={handleAuthSignup} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#091747] mb-2">
                    Email Address *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    placeholder="your.email@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#091747] mb-2">
                    Password *
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
                      placeholder="Create a secure password (min 6 chars)"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors"
                >
                  {authLoading ? 'Creating Account...' : 'Continue'}
                </button>
              </form>
            </>
          ) : (
            // Step 2: Provider Profile
            <>
              <h2 className="text-2xl font-semibold text-[#091747] mb-2 font-['Newsreader']">
                Provider Information
              </h2>
              <p className="text-[#091747]/60 mb-6 text-sm">
                Now, let's set up your professional profile.
              </p>

              {profileError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{profileError}</p>
                </div>
              )}

              <form onSubmit={handleProfileCreation} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-[#091747] mb-2">
                      First Name *
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-[#091747] mb-2">
                      Last Name *
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-[#091747] mb-2">
                    Professional Title *
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="e.g., MD, LCSW, PMHNP-BC"
                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="role" className="block text-sm font-medium text-[#091747] mb-2">
                    Role *
                  </label>
                  <select
                    id="role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                  >
                    <option value="practitioner">Nurse Practitioner</option>
                    <option value="psychiatrist">Psychiatrist</option>
                    <option value="psychiatry_resident">Psychiatry Resident</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="specialty" className="block text-sm font-medium text-[#091747] mb-2">
                    Specialty
                  </label>
                  <input
                    id="specialty"
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="e.g., Adult Psychiatry, Child & Adolescent"
                    className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-[#091747] mb-2">
                      Phone Number
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(555) 123-4567"
                      className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="npi" className="block text-sm font-medium text-[#091747] mb-2">
                      NPI Number
                    </label>
                    <input
                      id="npi"
                      type="text"
                      value={npi}
                      onChange={(e) => setNpi(e.target.value)}
                      placeholder="1234567890"
                      className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setStep('auth')}
                    className="px-6 py-3 border border-stone-300 text-[#091747] rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="flex-1 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {profileLoading ? (
                      'Creating Profile...'
                    ) : (
                      <>
                        <User className="w-5 h-5 mr-2" />
                        Complete Registration
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Back to Login */}
        <div className="mt-8 text-center">
          <Link 
            href="/auth/login"
            className="text-sm text-[#091747]/70 hover:text-[#091747] transition-colors"
          >
            ← Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}