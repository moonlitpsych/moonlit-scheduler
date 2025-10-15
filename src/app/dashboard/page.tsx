'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/contexts/ToastContext'
import { 
    Calendar, 
    Clock, 
    Plus, 
    TrendingUp, 
    User,
    AlertCircle,
    CheckCircle,
    Activity,
    Settings
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

interface Provider {
    id: string
    first_name: string
    last_name: string
    email: string
    title: string
    role: string
    auth_user_id: string
}

interface AvailabilityException {
    id?: string
    provider_id: string
    exception_date: string
    end_date?: string
    exception_type: 'unavailable' | 'custom_hours' | 'partial_block' | 'vacation' | 'recurring_change'
    start_time?: string
    end_time?: string
    note?: string
    created_at?: string
}

interface DashboardStats {
    activeDays: number
    totalBlocks: number
    upcomingExceptions: number
    recentActivity: string[]
}

export default function DashboardPage() {
    const [provider, setProvider] = useState<Provider | null>(null)
    const [stats, setStats] = useState<DashboardStats>({
        activeDays: 0,
        totalBlocks: 0,
        upcomingExceptions: 0,
        recentActivity: []
    })
    const [recentExceptions, setRecentExceptions] = useState<AvailabilityException[]>([])
    const [loading, setLoading] = useState(true)
    
    const supabase = createClientComponentClient<Database>()
    const toast = useToast()

    useEffect(() => {
        loadDashboardData()
    }, [])

    const loadDashboardData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Check for impersonation context first
            const impersonation = (await import('@/lib/provider-impersonation')).providerImpersonationManager.getImpersonatedProvider()

            let providerData: Provider | null = null

            if (impersonation) {
                // Admin viewing as a provider - use impersonated provider
                providerData = impersonation.provider as Provider
            } else {
                // Regular provider viewing their own dashboard
                const { data: loadedProvider, error: providerError } = await supabase
                    .from('providers')
                    .select('*')
                    .eq('auth_user_id', user.id)
                    .eq('is_active', true)
                    .single()

                if (providerError || !loadedProvider) {
                    console.error('Provider lookup failed:', {
                        error: providerError,
                        userId: user.id,
                        userEmail: user.email
                    })
                    toast.error('Provider Not Found', `Provider account not found for ${user.email}. Please contact support.`)
                    setLoading(false)
                    return
                }

                providerData = loadedProvider
            }

            setProvider(providerData)

            // Load availability blocks
            const { data: schedule } = await supabase
                .from('provider_availability')
                .select('*')
                .eq('provider_id', providerData.id)

            // Load recent exceptions
            const { data: exceptions } = await supabase
                .from('availability_exceptions')
                .select('*')
                .eq('provider_id', providerData.id)
                .gte('exception_date', new Date().toISOString().split('T')[0])
                .order('exception_date', { ascending: true })
                .limit(5)

            setRecentExceptions(exceptions || [])

            // Calculate stats
            const activeDays = [...new Set(schedule?.map(block => block.day_of_week) || [])].length
            const totalBlocks = schedule?.length || 0
            const upcomingExceptions = exceptions?.length || 0

            setStats({
                activeDays,
                totalBlocks,
                upcomingExceptions,
                recentActivity: []
            })

        } catch (error) {
            console.error('Error loading dashboard data:', error)
            toast.error('Load Error', 'Failed to load dashboard data')
        } finally {
            setLoading(false)
        }
    }

    const getTimeOfDayGreeting = () => {
        const hour = new Date().getHours()
        if (hour < 12) return 'Good morning'
        if (hour < 17) return 'Good afternoon'
        return 'Good evening'
    }

    const formatExceptionType = (type: string) => {
        return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }

    const getExceptionIcon = (type: string) => {
        switch (type) {
            case 'vacation': return <Calendar className="h-4 w-4 text-orange-600" />
            case 'unavailable': return <AlertCircle className="h-4 w-4 text-red-600" />
            case 'custom_hours': return <Clock className="h-4 w-4 text-blue-600" />
            default: return <Settings className="h-4 w-4 text-purple-600" />
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-[#BF9C73] mx-auto"></div>
                    <p className="mt-4 text-[#091747] font-medium">Loading your dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Welcome Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
                        {getTimeOfDayGreeting()}, {provider?.first_name}!
                    </h1>
                    <p className="mt-2 text-[#091747]/70">
                        Here's an overview of your practice management dashboard.
                    </p>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-[#BF9C73]/10 rounded-lg">
                                <Calendar className="h-6 w-6 text-[#BF9C73]" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-[#091747]/60">Active Days</h3>
                                <p className="text-2xl font-bold text-[#091747]">{stats.activeDays}</p>
                                <p className="text-xs text-[#091747]/50">days per week</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-[#17DB4E]/10 rounded-lg">
                                <Clock className="h-6 w-6 text-[#17DB4E]" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-[#091747]/60">Time Blocks</h3>
                                <p className="text-2xl font-bold text-[#091747]">{stats.totalBlocks}</p>
                                <p className="text-xs text-[#091747]/50">availability blocks</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Activity className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-[#091747]/60">Upcoming Exceptions</h3>
                                <p className="text-2xl font-bold text-[#091747]">{stats.upcomingExceptions}</p>
                                <p className="text-xs text-[#091747]/50">schedule changes</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
                        <div className="flex items-center">
                            <div className="p-2 bg-[#17DB4E]/10 rounded-lg">
                                <CheckCircle className="h-6 w-6 text-[#17DB4E]" />
                            </div>
                            <div className="ml-4">
                                <h3 className="text-sm font-medium text-[#091747]/60">Status</h3>
                                <p className="text-lg font-bold text-[#17DB4E]">Active</p>
                                <p className="text-xs text-[#091747]/50">accepting appointments</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Quick Actions */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6 mb-6">
                            <h2 className="text-xl font-bold text-[#091747] mb-6 font-['Newsreader']">Quick Actions</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Link
                                    href="/dashboard/availability"
                                    className="p-4 border-2 border-stone-200 rounded-xl hover:border-[#BF9C73]/50 hover:bg-[#BF9C73]/5 transition-all duration-200 group"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="p-3 bg-[#BF9C73]/10 rounded-lg group-hover:bg-[#BF9C73]/20 transition-colors">
                                            <Calendar className="h-6 w-6 text-[#BF9C73]" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-[#091747]">Manage Availability</h3>
                                            <p className="text-sm text-[#091747]/60">Set your schedule and exceptions</p>
                                        </div>
                                    </div>
                                </Link>

                                <Link
                                    href="/dashboard/profile"
                                    className="p-4 border-2 border-stone-200 rounded-xl hover:border-[#BF9C73]/50 hover:bg-[#BF9C73]/5 transition-all duration-200 group"
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="p-3 bg-[#BF9C73]/10 rounded-lg group-hover:bg-[#BF9C73]/20 transition-colors">
                                            <User className="h-6 w-6 text-[#BF9C73]" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-[#091747]">Update Profile</h3>
                                            <p className="text-sm text-[#091747]/60">Edit your information and preferences</p>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                            <h2 className="text-xl font-bold text-[#091747] mb-6 font-['Newsreader']">Upcoming Schedule Changes</h2>
                            {recentExceptions.length > 0 ? (
                                <div className="space-y-4">
                                    {recentExceptions.map((exception) => (
                                        <div key={exception.id} className="flex items-center space-x-4 p-3 bg-stone-50 rounded-lg">
                                            <div className="flex-shrink-0">
                                                {getExceptionIcon(exception.exception_type)}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-medium text-[#091747]">
                                                        {formatExceptionType(exception.exception_type)}
                                                    </h4>
                                                    <span className="text-sm text-[#091747]/60">
                                                        {new Date(exception.exception_date).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                {exception.note && (
                                                    <p className="text-sm text-[#091747]/60 mt-1">{exception.note}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <CheckCircle className="h-12 w-12 text-[#17DB4E] mx-auto mb-4" />
                                    <p className="text-[#091747]/60">No upcoming schedule changes</p>
                                    <p className="text-sm text-[#091747]/50 mt-2">Your schedule is all set!</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Provider Info Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                            <h3 className="font-semibold text-[#091747] mb-4">Your Profile</h3>
                            <div className="space-y-3">
                                <div>
                                    <span className="text-sm text-[#091747]/60">Name:</span>
                                    <p className="text-sm font-medium text-[#091747]">
                                        {provider?.first_name} {provider?.last_name}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-sm text-[#091747]/60">Email:</span>
                                    <p className="text-sm font-medium text-[#091747]">{provider?.email}</p>
                                </div>
                                <div>
                                    <span className="text-sm text-[#091747]/60">Role:</span>
                                    <p className="text-sm font-medium text-[#091747] capitalize">
                                        {provider?.role?.replace('_', ' ')}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-r from-[#BF9C73]/10 to-[#F6B398]/10 border border-[#BF9C73]/20 rounded-xl p-6">
                            <h3 className="font-semibold text-[#091747] mb-3">✨ Need Help?</h3>
                            <p className="text-sm text-[#091747]/70 mb-4">
                                If you need assistance with your schedule or have questions about the system, feel free to reach out.
                            </p>
                            <a 
                                href="mailto:hello@trymoonlit.com"
                                className="text-[#BF9C73] hover:text-[#A8865F] text-sm font-medium transition-colors"
                            >
                                Contact Support
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}