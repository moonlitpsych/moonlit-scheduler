'use client'

import ScheduleEditor from '@/components/providers/ScheduleEditor'
import MonthlyCalendarView from '@/components/providers/MonthlyCalendarView'
import { Database } from '@/types/database'
import { formatTimeRange } from '@/utils/timeFormat'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/contexts/ToastContext'
import { AlertCircle, AlertTriangle, Calendar, Clock, Plus, Repeat, Settings, Trash2, User, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
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

interface AvailabilityBlock {
    id: string
    day_of_week: number
    start_time: string
    end_time: string
    is_recurring: boolean
}

interface AvailabilityException {
    id?: string
    provider_id: string
    exception_date: string
    end_date?: string
    exception_type: 'unavailable' | 'custom_hours' | 'partial_block' | 'vacation' | 'recurring_change'
    start_time?: string
    end_time?: string
    is_recurring?: boolean
    recurrence_pattern?: 'daily' | 'weekly' | 'monthly'
    recurrence_interval?: number
    recurrence_count?: number
    recurrence_end_date?: string
    recurrence_days?: number[]
    note?: string // This matches the actual database schema
    created_at?: string
}

const DAYS = [
    { name: 'Sunday', number: 0 },
    { name: 'Monday', number: 1 },
    { name: 'Tuesday', number: 2 },
    { name: 'Wednesday', number: 3 },
    { name: 'Thursday', number: 4 },
    { name: 'Friday', number: 5 },
    { name: 'Saturday', number: 6 },
]

export default function DashboardAvailabilityPage() {
    const [user, setUser] = useState<any>(null)
    const [provider, setProvider] = useState<Provider | null>(null)
    const [schedule, setSchedule] = useState<AvailabilityBlock[]>([])
    const [exceptions, setExceptions] = useState<AvailabilityException[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [showExceptions, setShowExceptions] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly')
    const [editingException, setEditingException] = useState<AvailabilityException | null>(null)
    
    const router = useRouter()
    const supabase = createClientComponentClient<Database>()
    const toast = useToast()

    useEffect(() => {
        loadUserAndProvider()
    }, [])

    const loadUserAndProvider = async () => {
        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser()

            if (userError || !user) {
                router.push('/auth/login')
                return
            }

            setUser(user)

            // Check for impersonation context first (for admin viewing as provider)
            const impersonation = (await import('@/lib/provider-impersonation')).providerImpersonationManager.getImpersonatedProvider()

            let providerData: Provider | null = null

            if (impersonation) {
                // Admin viewing as a provider - use impersonated provider
                providerData = impersonation.provider as Provider
            } else {
                // Regular provider viewing their own availability
                const { data: loadedProvider, error: providerError } = await supabase
                    .from('providers')
                    .select('*')
                    .eq('auth_user_id', user.id)
                    .eq('is_active', true)
                    .single()

                if (providerError) {
                    setError(`Provider lookup failed: ${providerError.message}.
                    Please ensure your provider account is linked to auth user ID: ${user.id}`)
                    setLoading(false)
                    return
                }

                providerData = loadedProvider
            }

            if (providerData) {
                setProvider(providerData)
                await loadProviderSchedule(providerData.id)
                await loadProviderExceptions(providerData.id)
            }

        } catch (err) {
            console.error('Error loading user and provider:', err)
            setError(`Authentication error: ${err}`)
        } finally {
            setLoading(false)
        }
    }

    const loadProviderSchedule = async (providerId: string) => {
        try {
            console.log('🔧 Dashboard loading schedule for provider:', providerId)
            
            // Use API endpoint instead of direct Supabase access to handle RLS policies
            const response = await fetch(`/api/providers/availability?providerId=${providerId}`, {
                method: 'GET',
                credentials: 'include' // Include cookies for authentication
            })

            const result = await response.json()
            console.log('🔧 Dashboard API result:', result)

            if (!response.ok) {
                console.error('Error loading schedule:', result.error)
            } else {
                const availability = result.availability || []
                console.log('🔧 Dashboard setting schedule:', availability.length, 'blocks')
                setSchedule(availability)
            }
        } catch (err) {
            console.error('Error loading schedule:', err)
        }
    }

    const loadProviderExceptions = async (providerId: string) => {
        try {
            const { data: exceptionsData, error: exceptionsError } = await supabase
                .from('availability_exceptions')
                .select('*')
                .eq('provider_id', providerId)
                .gte('exception_date', new Date().toISOString().split('T')[0])
                .order('exception_date')

            if (exceptionsError) {
                console.error('Error loading exceptions:', exceptionsError)
            } else {
                setExceptions(exceptionsData || [])
            }
        } catch (err) {
            console.error('Error loading exceptions:', err)
        }
    }

    // Calculate statistics
    const activeDays = DAYS.filter(day => 
        schedule.some(block => block.day_of_week === day.number)
    ).length

    const totalBlocks = schedule.length

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

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center">
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 max-w-2xl mx-4">
                    <div className="flex items-center mb-4">
                        <AlertCircle className="h-8 w-8 text-yellow-600 mr-3" />
                        <h2 className="text-xl font-bold text-yellow-900">Setup Required</h2>
                    </div>
                    <p className="text-yellow-800 mb-6 leading-relaxed">{error}</p>
                    <button
                        onClick={() => router.push('/contact')}
                        className="bg-[#BF9C73] hover:bg-[#A88861] text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        Contact Admin
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
                                Manage Your Availability
                            </h1>
                            <p className="mt-2 text-[#091747]/70">
                                Set your weekly schedule, time off, and booking preferences.
                            </p>
                        </div>
                        
                        {/* View Toggle Switch */}
                        <div className="flex items-center gap-3 bg-white rounded-xl p-2 shadow-sm border border-stone-200">
                            <button
                                onClick={() => setViewMode('weekly')}
                                className={`px-4 py-2 rounded-lg transition-all font-medium ${
                                    viewMode === 'weekly'
                                        ? 'bg-[#BF9C73] text-white shadow-sm'
                                        : 'text-[#091747] hover:bg-stone-50'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Weekly Schedule
                                </div>
                            </button>
                            <button
                                onClick={() => setViewMode('monthly')}
                                className={`px-4 py-2 rounded-lg transition-all font-medium ${
                                    viewMode === 'monthly'
                                        ? 'bg-[#BF9C73] text-white shadow-sm'
                                        : 'text-[#091747] hover:bg-stone-50'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Monthly Calendar
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Provider Schedule Management */}
                {provider && (
                    <>
                        {/* Overview Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
                                <div className="flex items-center">
                                    <div className="p-2 bg-[#BF9C73]/10 rounded-lg">
                                        <Calendar className="h-6 w-6 text-[#BF9C73]" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-sm font-medium text-[#091747]/60">Active Days</h3>
                                        <p className="text-2xl font-bold text-[#091747]">{activeDays}</p>
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
                                        <p className="text-2xl font-bold text-[#091747]">{totalBlocks}</p>
                                        <p className="text-xs text-[#091747]/50">availability blocks</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
                                <div className="flex items-center">
                                    <div className="p-2 bg-[#F6B398]/10 rounded-lg">
                                        <Settings className="h-6 w-6 text-[#F6B398]" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-sm font-medium text-[#091747]/60">Status</h3>
                                        <p className="text-2xl font-bold text-[#091747]">Active</p>
                                        <p className="text-xs text-[#091747]/50">accepting appointments</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-sm border border-stone-200">
                                <div className="flex items-center">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <User className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div className="ml-4">
                                        <h3 className="text-sm font-medium text-[#091747]/60">Exceptions</h3>
                                        <p className="text-2xl font-bold text-[#091747]">{exceptions.length}</p>
                                        <p className="text-xs text-[#091747]/50">upcoming changes</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content Grid */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Weekly Schedule */}
                            {viewMode === 'weekly' && (
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-bold text-[#091747]">Weekly Schedule</h2>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setShowExceptions(true)}
                                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2"
                                            >
                                                <Plus className="h-4 w-4" />
                                                Add Exception
                                            </button>
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="bg-[#BF9C73] hover:bg-[#A88861] text-white px-4 py-2 rounded-lg transition-colors font-medium"
                                            >
                                                Edit Schedule
                                            </button>
                                        </div>
                                    </div>

                                    {schedule.length > 0 ? (
                                        <div className="space-y-4">
                                            {DAYS.map(day => {
                                                const dayBlocks = schedule.filter(block => block.day_of_week === day.number)
                                                return (
                                                    <div key={day.number} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-b-0">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-3 h-3 rounded-full ${dayBlocks.length > 0 ? 'bg-[#17DB4E]' : 'bg-stone-300'}`}></div>
                                                            <span className="font-medium text-[#091747]">{day.name}</span>
                                                        </div>
                                                        <div className="text-sm text-[#091747]">
                                                            {dayBlocks.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {dayBlocks.map((block, index) => (
                                                                        <div key={index}>
                                                                            {formatTimeRange(block.start_time, block.end_time)}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className="text-[#091747]/50">Unavailable</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <Calendar className="h-12 w-12 text-[#091747]/30 mx-auto mb-4" />
                                            <h3 className="text-lg font-medium text-[#091747] mb-2">No Schedule Set</h3>
                                            <p className="text-[#091747]/60 mb-4">
                                                Click "Edit Schedule" to set your availability
                                            </p>
                                            <button
                                                onClick={() => setEditing(true)}
                                                className="bg-[#BF9C73] hover:bg-[#A88861] text-white px-4 py-2 rounded-lg transition-colors font-medium"
                                            >
                                                Set Up Schedule
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Enhanced Schedule Exceptions Section */}
                                <div className="mt-8 bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-lg font-bold text-[#091747]">Schedule Exceptions</h3>
                                        <button
                                            onClick={() => setShowExceptions(true)}
                                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 text-sm"
                                        >
                                            <Plus className="h-4 w-4" />
                                            Add Exception
                                        </button>
                                    </div>

                                    {exceptions.length > 0 ? (
                                        <div className="space-y-3">
                                            {exceptions.map((exception) => (
                                                <div key={exception.id} className="bg-stone-50 rounded-lg p-4 border border-stone-200">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <div className={`p-1 rounded ${
                                                                    exception.exception_type === 'unavailable' || exception.exception_type === 'vacation' 
                                                                        ? 'bg-red-100'
                                                                        : exception.exception_type === 'partial_block' 
                                                                        ? 'bg-orange-100'
                                                                        : 'bg-purple-100'
                                                                }`}>
                                                                    {exception.exception_type === 'unavailable' || exception.exception_type === 'vacation' ? (
                                                                        <X className="h-4 w-4 text-red-600" />
                                                                    ) : exception.exception_type === 'partial_block' ? (
                                                                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                                                                    ) : exception.exception_type === 'recurring_change' ? (
                                                                        <Repeat className="h-4 w-4 text-purple-600" />
                                                                    ) : (
                                                                        <Clock className="h-4 w-4 text-blue-600" />
                                                                    )}
                                                                </div>
                                                                <h4 className="font-medium text-[#091747] capitalize">
                                                                    {exception.exception_type.replace('_', ' ')}
                                                                </h4>
                                                                {exception.is_recurring && (
                                                                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
                                                                        Recurring
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-[#091747]/70 space-y-1">
                                                                <div>
                                                                    <strong>Date:</strong> {new Date(exception.exception_date).toLocaleDateString()}
                                                                    {exception.end_date && (
                                                                        <span> - {new Date(exception.end_date).toLocaleDateString()}</span>
                                                                    )}
                                                                </div>
                                                                {exception.start_time && exception.end_time && (
                                                                    <div>
                                                                        <strong>Time:</strong> {formatTimeRange(exception.start_time, exception.end_time)}
                                                                    </div>
                                                                )}
                                                                {exception.note && (
                                                                    <div>
                                                                        <strong>Note:</strong> {exception.note}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('Are you sure you want to delete this exception?')) {
                                                                    try {
                                                                        const { error } = await supabase
                                                                            .from('availability_exceptions')
                                                                            .delete()
                                                                            .eq('id', exception.id)

                                                                        if (error) {
                                                                            console.error('Error deleting exception:', error)
                                                                        } else {
                                                                            await loadProviderExceptions(provider.id)
                                                                        }
                                                                    } catch (err) {
                                                                        console.error('Error deleting exception:', err)
                                                                    }
                                                                }
                                                            }}
                                                            className="text-red-500 hover:text-red-700 p-1"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <AlertCircle className="h-8 w-8 text-[#091747]/30 mx-auto mb-3" />
                                            <p className="text-[#091747]/60 mb-4">No schedule exceptions</p>
                                            <button
                                                onClick={() => setShowExceptions(true)}
                                                className="text-[#BF9C73] hover:text-[#A88861] font-medium"
                                            >
                                                Add your first exception
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            )}

                            {/* Monthly Calendar View */}
                            {viewMode === 'monthly' && (
                            <div className="lg:col-span-2">
                                <MonthlyCalendarView
                                    schedule={schedule}
                                    exceptions={exceptions}
                                    onAddException={() => setShowExceptions(true)}
                                    onEditException={(exception) => {
                                        setEditingException(exception)
                                        setShowExceptions(true)
                                    }}
                                />
                            </div>
                            )}

                            {/* Provider Info */}
                            <div className="space-y-6">
                                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                                    <h3 className="font-semibold text-[#091747] mb-4">Provider Information</h3>
                                    <div className="space-y-3">
                                        <div>
                                            <span className="text-sm text-[#091747]/60">Name:</span>
                                            <p className="text-sm font-medium text-[#091747]">
                                                {provider.first_name} {provider.last_name}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-[#091747]/60">Email:</span>
                                            <p className="text-sm font-medium text-[#091747]">{provider.email}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-[#091747]/60">Role:</span>
                                            <p className="text-sm font-medium text-[#091747]">
                                                {provider.title || provider.role || 'Provider'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-[#091747]/60">Auth User ID:</span>
                                            <p className="text-xs font-mono text-[#091747]/40 break-all">{provider.auth_user_id}</p>
                                        </div>
                                        <div>
                                            <span className="text-sm text-[#091747]/60">Status:</span>
                                            <p className="text-sm font-medium text-[#17DB4E]">Active</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                                    <h3 className="font-semibold text-green-900 mb-3">✅ Ready for Patient Booking</h3>
                                    <ul className="space-y-2 text-sm text-green-800">
                                        <li>• Provider account linked</li>
                                        <li>• Exception manager working</li>
                                        <li>• API endpoints available</li>
                                        <li>• Real-time updates enabled</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Fixed Exception Manager Modal */}
            {showExceptions && provider && (
                <WorkingExceptionManagerModal
                    providerId={provider.id}
                    editingException={editingException}
                    toast={toast}
                    onClose={() => {
                        setShowExceptions(false)
                        setEditingException(null)
                    }}
                    onSave={() => {
                        setShowExceptions(false)
                        setEditingException(null)
                        loadProviderExceptions(provider.id)
                    }}
                />
            )}

            {/* Schedule Editor Modal */}
            {editing && provider && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-stone-200">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-[#091747]">Edit Schedule</h2>
                                <button
                                    onClick={() => setEditing(false)}
                                    className="text-[#091747]/60 hover:text-[#091747] transition-colors"
                                >
                                    <X className="h-6 w-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <ScheduleEditor
                                providerId={provider.id}
                                onSave={async () => {
                                    setEditing(false)
                                    await loadProviderSchedule(provider.id)
                                }}
                                onCancel={() => setEditing(false)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Working Exception Manager Modal - Matches Actual Database Schema
function WorkingExceptionManagerModal({ 
    providerId, 
    editingException,
    toast,
    onClose, 
    onSave 
}: { 
    providerId: string
    editingException?: AvailabilityException | null
    toast: ReturnType<typeof useToast>
    onClose: () => void
    onSave: () => void
}) {
    const [exceptionType, setExceptionType] = useState<'unavailable' | 'custom_hours' | 'partial_block' | 'vacation' | 'recurring_change'>('unavailable')
    const [exceptionDate, setExceptionDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [startTime, setStartTime] = useState('')
    const [endTime, setEndTime] = useState('')
    const [note, setNote] = useState('')
    const [isRecurring, setIsRecurring] = useState(false)
    const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
    const [recurrenceInterval, setRecurrenceInterval] = useState(1)
    const [recurrenceCount, setRecurrenceCount] = useState<number | undefined>(undefined)
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('')
    const [recurrenceDays, setRecurrenceDays] = useState<number[]>([])
    const [saving, setSaving] = useState(false)
    
    const supabase = createClientComponentClient<Database>()

    // Populate form when editing an existing exception
    useEffect(() => {
        if (editingException) {
            setExceptionType(editingException.exception_type)
            setExceptionDate(editingException.exception_date)
            setEndDate(editingException.end_date || '')
            setStartTime(editingException.start_time || '')
            setEndTime(editingException.end_time || '')
            setNote(editingException.note || '')
            setIsRecurring(editingException.is_recurring || false)
            setRecurrencePattern(editingException.recurrence_pattern || 'weekly')
            setRecurrenceInterval(editingException.recurrence_interval || 1)
            setRecurrenceCount(editingException.recurrence_count || undefined)
            setRecurrenceEndDate(editingException.recurrence_end_date || '')
            setRecurrenceDays(editingException.recurrence_days || [])
        } else {
            // Reset form for new exception
            setExceptionType('unavailable')
            setExceptionDate('')
            setEndDate('')
            setStartTime('')
            setEndTime('')
            setNote('')
            setIsRecurring(false)
            setRecurrencePattern('weekly')
            setRecurrenceInterval(1)
            setRecurrenceCount(undefined)
            setRecurrenceEndDate('')
            setRecurrenceDays([])
        }
    }, [editingException])

    const handleSave = async () => {
        if (!exceptionDate) {
            toast.warning('Date Required', 'Please select a date for the exception')
            return
        }

        if ((exceptionType === 'custom_hours' || exceptionType === 'partial_block') && (!startTime || !endTime)) {
            toast.warning('Time Required', 'Please specify start and end times for custom hours or partial blocks')
            return
        }

        setSaving(true)

        try {
            const exceptionData: any = {
                provider_id: providerId,
                exception_date: exceptionDate,
                exception_type: exceptionType,
                note: note || null,
                is_recurring: isRecurring
            }

            // Add optional fields based on exception type
            if (endDate) exceptionData.end_date = endDate
            if (startTime) exceptionData.start_time = startTime
            if (endTime) exceptionData.end_time = endTime

            // Add recurrence fields if recurring
            if (isRecurring) {
                exceptionData.recurrence_pattern = recurrencePattern
                exceptionData.recurrence_interval = recurrenceInterval
                if (recurrenceCount) exceptionData.recurrence_count = recurrenceCount
                if (recurrenceEndDate) exceptionData.recurrence_end_date = recurrenceEndDate
                if (recurrenceDays.length > 0) exceptionData.recurrence_days = recurrenceDays
            }

            console.log('Saving exception data:', exceptionData)

            let data, error
            
            if (editingException?.id) {
                // Update existing exception
                const result = await supabase
                    .from('availability_exceptions')
                    .update(exceptionData)
                    .eq('id', editingException.id)
                    .select()
                data = result.data
                error = result.error
            } else {
                // Create new exception
                const result = await supabase
                    .from('availability_exceptions')
                    .insert([exceptionData])
                    .select()
                data = result.data
                error = result.error
            }

            if (error) {
                console.error('Error saving exception:', error)
                toast.error('Save Failed', `Error saving exception: ${error.message}`)
            } else {
                console.log('Exception saved successfully:', data)
                toast.success(
                    editingException ? 'Exception Updated' : 'Exception Created', 
                    editingException ? 'Your schedule exception has been updated successfully' : 'Your schedule exception has been created successfully'
                )
                onSave()
            }
        } catch (err) {
            console.error('Error saving exception:', err)
            toast.error('Unexpected Error', `Error saving exception: ${err}`)
        } finally {
            setSaving(false)
        }
    }

    const toggleRecurrenceDay = (dayNumber: number) => {
        setRecurrenceDays(prev => 
            prev.includes(dayNumber) 
                ? prev.filter(d => d !== dayNumber)
                : [...prev, dayNumber].sort()
        )
    }

    const handleDelete = async () => {
        if (!editingException?.id) return
        
        if (!confirm('Are you sure you want to delete this exception?')) return

        setSaving(true)
        try {
            const { error } = await supabase
                .from('availability_exceptions')
                .delete()
                .eq('id', editingException.id)

            if (error) {
                console.error('Error deleting exception:', error)
                toast.error('Delete Failed', `Error deleting exception: ${error.message}`)
            } else {
                console.log('Exception deleted successfully')
                toast.success('Exception Deleted', 'Your schedule exception has been removed successfully')
                onSave()
            }
        } catch (err) {
            console.error('Error deleting exception:', err)
            toast.error('Unexpected Error', `Error deleting exception: ${err}`)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-stone-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-[#091747]">
                            {editingException ? 'Edit Schedule Exception' : 'Add Schedule Exception'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-[#091747]/60 hover:text-[#091747] transition-colors"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Exception Type */}
                    <div>
                        <label className="block text-sm font-medium text-[#091747] mb-2">
                            Exception Type
                        </label>
                        <select
                            value={exceptionType}
                            onChange={(e) => setExceptionType(e.target.value as any)}
                            className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                        >
                            <option value="unavailable">Unavailable</option>
                            <option value="vacation">Vacation</option>
                            <option value="custom_hours">Custom Hours</option>
                            <option value="partial_block">Partial Block</option>
                            <option value="recurring_change">Recurring Change</option>
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#091747] mb-2">
                                Start Date *
                            </label>
                            <input
                                type="date"
                                value={exceptionDate}
                                onChange={(e) => setExceptionDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#091747] mb-2">
                                End Date (optional)
                            </label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                min={exceptionDate || new Date().toISOString().split('T')[0]}
                                className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                            />
                        </div>
                    </div>

                    {/* Time Fields (for custom hours and partial blocks) */}
                    {(exceptionType === 'custom_hours' || exceptionType === 'partial_block') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-[#091747] mb-2">
                                    Start Time *
                                </label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#091747] mb-2">
                                    End Time *
                                </label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                                />
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    <div>
                        <label className="block text-sm font-medium text-[#091747] mb-2">
                            Note (optional)
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                            placeholder="Add any additional notes..."
                        />
                    </div>

                    {/* Recurring Options */}
                    <div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={isRecurring}
                                onChange={(e) => setIsRecurring(e.target.checked)}
                                className="rounded border-stone-300 text-[#BF9C73] focus:ring-[#BF9C73]"
                            />
                            <span className="text-sm font-medium text-[#091747]">Make this recurring</span>
                        </label>
                    </div>

                    {/* Recurrence Settings */}
                    {isRecurring && (
                        <div className="space-y-4 bg-stone-50 p-4 rounded-lg">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        Repeat Pattern
                                    </label>
                                    <select
                                        value={recurrencePattern}
                                        onChange={(e) => setRecurrencePattern(e.target.value as any)}
                                        className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                                    >
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        Every N {recurrencePattern === 'daily' ? 'days' : recurrencePattern === 'weekly' ? 'weeks' : 'months'}
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        value={recurrenceInterval}
                                        onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                                        className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                                    />
                                </div>
                            </div>

                            {/* Days of Week (for weekly pattern) */}
                            {recurrencePattern === 'weekly' && (
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        Repeat on days
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {DAYS.map(day => (
                                            <button
                                                key={day.number}
                                                type="button"
                                                onClick={() => toggleRecurrenceDay(day.number)}
                                                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                                                    recurrenceDays.includes(day.number)
                                                        ? 'bg-[#BF9C73] text-white'
                                                        : 'bg-white border border-stone-300 text-[#091747] hover:bg-stone-50'
                                                }`}
                                            >
                                                {day.name.slice(0, 3)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* End Conditions */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        Number of occurrences (optional)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={recurrenceCount || ''}
                                        onChange={(e) => setRecurrenceCount(e.target.value ? parseInt(e.target.value) : undefined)}
                                        className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                                        placeholder="Leave blank for indefinite"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        End date (optional)
                                    </label>
                                    <input
                                        type="date"
                                        value={recurrenceEndDate}
                                        onChange={(e) => setRecurrenceEndDate(e.target.value)}
                                        min={exceptionDate || new Date().toISOString().split('T')[0]}
                                        className="w-full p-3 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-stone-200 flex justify-between">
                    <div>
                        {editingException && (
                            <button
                                onClick={handleDelete}
                                disabled={saving}
                                className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Exception
                            </button>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-[#091747] border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 bg-[#BF9C73] hover:bg-[#A88861] text-white rounded-lg transition-colors disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : editingException ? 'Update Exception' : 'Save Exception'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}