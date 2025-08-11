'use client'

import ScheduleEditor from '@/components/providers/ScheduleEditor'
import { Database } from '@/types/database'
import { formatTimeRange } from '@/utils/timeFormat'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
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
    
    const router = useRouter()
    const supabase = createClientComponentClient<Database>()

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

            const { data: providerData, error: providerError } = await supabase
                .from('providers')
                .select('*')
                .eq('auth_user_id', user.id)
                .single()

            if (providerError) {
                setError(`Provider lookup failed: ${providerError.message}. Please ensure your provider account is linked to auth user ID: ${user.id}`)
            } else {
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
            const { data: availability, error: availError } = await supabase
                .from('provider_availability')
                .select('*')
                .eq('provider_id', providerId)
                .order('day_of_week')
                .order('start_time')

            if (availError) {
                console.error('Error loading schedule:', availError)
            } else {
                setSchedule(availability || [])
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

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/auth/login')
    }

    const handleSaveComplete = async () => {
        setEditing(false)
        if (provider) {
            await loadProviderSchedule(provider.id)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#BF9C73] mx-auto mb-4"></div>
                    <p className="text-[#091747]">Loading availability manager...</p>
                </div>
            </div>
        )
    }

    if (error || !provider) {
        return (
            <div className="min-h-screen bg-[#FEF8F1] flex items-center justify-center">
                <div className="text-center max-w-md mx-auto px-4">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                        <h3 className="font-semibold text-yellow-900 mb-3">Setup Required</h3>
                        <p className="text-sm text-yellow-800 mb-4">
                            {error || `Your account (${user?.email}) needs to be linked to a provider profile.`}
                        </p>
                        <button 
                            onClick={() => window.location.href = 'mailto:admin@moonlitpsychiatry.com'}
                            className="text-sm bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700"
                        >
                            Contact Admin
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    const activeDays = [...new Set(schedule.map(s => s.day_of_week))].length
    const totalBlocks = schedule.length

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            {/* Header */}
            <div className="bg-white shadow-sm border-b border-stone-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-[#091747] rounded-lg flex items-center justify-center">
                                <div className="w-3 h-3 bg-[#BF9C73] rounded-full"></div>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
                                    Availability Management
                                </h1>
                                <p className="text-sm text-[#091747]/60">Set your weekly schedule and one-off exceptions</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="px-4 py-2 text-sm text-[#091747] hover:bg-[#FEF8F1] rounded-lg transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {editing ? (
                    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                                    Edit Weekly Schedule
                                </h2>
                                <p className="text-sm text-[#091747]/60 mt-1">
                                    Set your recurring availability for patient appointments
                                </p>
                            </div>
                        </div>
                        <ScheduleEditor
                            providerId={provider?.id || 'temp-provider-id'}
                            onSave={handleSaveComplete}
                            onCancel={() => setEditing(false)}
                        />
                    </div>
                ) : (
                    <>
                        {/* Status Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                            {/* Schedule Overview */}
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
                                                Weekly Schedule
                                            </h3>
                                            <p className="text-sm text-[#091747]/60 mt-1">
                                                Your current availability for patient appointments
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setEditing(true)}
                                            className="bg-[#BF9C73] hover:bg-[#A88861] text-white px-4 py-2 rounded-lg transition-colors font-medium"
                                        >
                                            Edit Schedule
                                        </button>
                                    </div>

                                    {schedule.length > 0 ? (
                                        <div className="space-y-4">
                                            {DAYS.map(day => {
                                                const dayBlocks = schedule.filter(block => block.day_of_week === day.number)
                                                return (
                                                    <div
                                                        key={day.number}
                                                        className="flex items-center justify-between py-3 px-4 bg-[#FEF8F1] rounded-lg"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-3 h-3 rounded-full ${dayBlocks.length > 0 ? 
                                                                'bg-[#17DB4E]' : 'bg-stone-300'}`}></div>
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
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">
                                                Schedule Exceptions
                                            </h3>
                                            <p className="text-sm text-[#091747]/60 mt-1">
                                                Birthday off • Vacation week • Family afternoon • Lunch meeting
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => setShowExceptions(true)}
                                            className="flex items-center gap-2 bg-[#BF9C73] hover:bg-[#A88861] text-white px-4 py-2 rounded-lg transition-colors font-medium"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Add Exception
                                        </button>
                                    </div>

                                    {exceptions.length > 0 ? (
                                        <div className="space-y-3">
                                            {exceptions.slice(0, 5).map((exception) => (
                                                <div key={exception.id} className="flex items-center justify-between p-4 bg-[#FEF8F1] rounded-lg">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${
                                                            exception.exception_type === 'unavailable' || exception.exception_type === 'vacation'
                                                                ? 'bg-red-100' 
                                                                : exception.exception_type === 'custom_hours'
                                                                ? 'bg-yellow-100'
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
                                                                <Clock className="h-4 w-4 text-yellow-600" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium text-[#091747]">
                                                                {new Date(exception.exception_date).toLocaleDateString('en-US', {
                                                                    weekday: 'long',
                                                                    month: 'long',
                                                                    day: 'numeric'
                                                                })}
                                                                {exception.end_date && exception.end_date !== exception.exception_date && (
                                                                    <span> - {new Date(exception.end_date).toLocaleDateString('en-US', {
                                                                        month: 'long',
                                                                        day: 'numeric'
                                                                    })}</span>
                                                                )}
                                                                {exception.is_recurring && (
                                                                    <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                                                                        Recurring
                                                                    </span>
                                                                )}
                                                            </p>
                                                            <p className="text-sm text-[#091747]/60">
                                                                {exception.exception_type === 'unavailable' 
                                                                    ? 'Completely unavailable'
                                                                    : exception.exception_type === 'vacation'
                                                                    ? 'Vacation/time off'
                                                                    : exception.exception_type === 'custom_hours'
                                                                    ? `Custom hours: ${formatTimeRange(exception.start_time || '', exception.end_time || '')}`
                                                                    : exception.exception_type === 'partial_block'
                                                                    ? `Blocked: ${formatTimeRange(exception.start_time || '', exception.end_time || '')}`
                                                                    : 'Recurring schedule change'
                                                                }
                                                            </p>
                                                            {exception.note && (
                                                                <p className="text-sm text-[#091747]/50 italic">{exception.note}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (confirm('Delete this exception?')) {
                                                                try {
                                                                    const { error } = await supabase
                                                                        .from('availability_exceptions')
                                                                        .delete()
                                                                        .eq('id', exception.id)
                                                                    
                                                                    if (error) throw error
                                                                    await loadProviderExceptions(provider.id)
                                                                } catch (error) {
                                                                    console.error('Error deleting exception:', error)
                                                                }
                                                            }
                                                        }}
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            {exceptions.length > 5 && (
                                                <p className="text-sm text-[#091747]/60 text-center py-2">
                                                    +{exceptions.length - 5} more exceptions
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <Calendar className="h-8 w-8 text-[#091747]/30 mx-auto mb-3" />
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
                    onClose={() => setShowExceptions(false)}
                    onSave={() => {
                        setShowExceptions(false)
                        loadProviderExceptions(provider.id)
                    }}
                />
            )}
        </div>
    )
}

// Working Exception Manager Modal - Matches Actual Database Schema
function WorkingExceptionManagerModal({ 
    providerId, 
    onClose, 
    onSave 
}: { 
    providerId: string
    onClose: () => void 
    onSave: () => void 
}) {
    const [exception, setException] = useState({
        provider_id: providerId,
        exception_type: 'unavailable' as const,
        exception_date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        note: '' // Using 'note' to match the actual database schema
    })
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<string[]>([])
    const supabase = createClientComponentClient()

    const validateException = (): string[] => {
        const validationErrors: string[] = []
        
        if (!exception.exception_date) {
            validationErrors.push('Start date is required')
        }
        
        if (exception.exception_type === 'custom_hours' || exception.exception_type === 'partial_block') {
            if (!exception.start_time || !exception.end_time) {
                validationErrors.push('Start and end times are required for custom hours/partial blocks')
            }
            if (exception.start_time && exception.end_time && exception.start_time >= exception.end_time) {
                validationErrors.push('End time must be after start time')
            }
        }
        
        if (exception.end_date && exception.exception_date && exception.end_date < exception.exception_date) {
            validationErrors.push('End date must be after start date')
        }
        
        return validationErrors
    }

    const handleSave = async () => {
        const validationErrors = validateException()
        if (validationErrors.length > 0) {
            setErrors(validationErrors)
            return
        }

        setSaving(true)
        setErrors([])

        try {
            // Create the exception object matching the database schema exactly
            const exceptionToSave = {
                provider_id: providerId,
                exception_date: exception.exception_date,
                exception_type: exception.exception_type,
                // Only include optional fields that have values
                ...(exception.end_date && { end_date: exception.end_date }),
                ...(exception.start_time && { start_time: exception.start_time }),
                ...(exception.end_time && { end_time: exception.end_time }),
                ...(exception.note && { note: exception.note }), // Using 'note' not 'reason'
                created_at: new Date().toISOString()
            }

            console.log('Saving exception with correct schema:', exceptionToSave)

            const { data, error } = await supabase
                .from('availability_exceptions')
                .insert([exceptionToSave])
                .select()

            if (error) {
                console.error('Database error:', error)
                throw error
            }

            console.log('Exception saved successfully:', data)
            onSave()
        } catch (error: any) {
            console.error('Error saving exception:', error)
            setErrors([`Error saving exception: ${error.message}`])
        } finally {
            setSaving(false)
        }
    }

    const getMinDate = () => new Date().toISOString().split('T')[0]

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                            Add Schedule Exception
                        </h2>
                        <p className="text-sm text-[#091747]/60 mt-1">
                            Birthday off • Vacation week • Family afternoon • Lunch meeting
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            <h3 className="font-medium text-red-900">Please fix the following errors:</h3>
                        </div>
                        <ul className="list-disc list-inside space-y-1">
                            {errors.map((error, index) => (
                                <li key={index} className="text-sm text-red-800">{error}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="space-y-6">
                    {/* Exception Type */}
                    <div>
                        <label className="block text-sm font-medium text-[#091747] mb-2">Exception Type</label>
                        <div className="space-y-3">
                            {[
                                { value: 'unavailable', label: 'Completely Unavailable', icon: X, description: 'Birthday off, sick day' },
                                { value: 'vacation', label: 'Vacation/Multi-day Off', icon: Calendar, description: 'Week vacation, conference' },
                                { value: 'custom_hours', label: 'Custom Hours', icon: Clock, description: 'Different schedule today' },
                                { value: 'partial_block', label: 'Partial Day Block', icon: AlertTriangle, description: 'Lunch meeting, family time' }
                            ].map(({ value, label, icon: Icon, description }) => (
                                <label key={value} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="exception_type"
                                        value={value}
                                        checked={exception.exception_type === value}
                                        onChange={(e) => setException(prev => ({ 
                                            ...prev, 
                                            exception_type: e.target.value as any,
                                            start_time: value === 'unavailable' || value === 'vacation' ? '' : prev.start_time,
                                            end_time: value === 'unavailable' || value === 'vacation' ? '' : prev.end_time
                                        }))}
                                        className="mt-1 rounded border-stone-300 text-[#BF9C73] focus:ring-[#BF9C73]"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4 text-[#BF9C73]" />
                                            <span className="font-medium text-[#091747]">{label}</span>
                                        </div>
                                        <p className="text-xs text-[#091747]/60 mt-1">{description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-[#091747] mb-2">
                                Start Date <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                min={getMinDate()}
                                value={exception.exception_date}
                                onChange={(e) => setException(prev => ({ ...prev, exception_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-[#091747] mb-2">
                                End Date <span className="text-gray-500">(optional)</span>
                            </label>
                            <input
                                type="date"
                                min={exception.exception_date || getMinDate()}
                                value={exception.end_date}
                                onChange={(e) => setException(prev => ({ ...prev, end_date: e.target.value }))}
                                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Time Range (for custom hours and partial blocks) */}
                    {(exception.exception_type === 'custom_hours' || exception.exception_type === 'partial_block') && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 className="font-medium text-blue-900 mb-3">Time Details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        Start Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={exception.start_time}
                                        onChange={(e) => setException(prev => ({ ...prev, start_time: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        End Time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="time"
                                        value={exception.end_time}
                                        onChange={(e) => setException(prev => ({ ...prev, end_time: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    <div>
                        <label className="block text-sm font-medium text-[#091747] mb-2">Note (optional)</label>
                        <input
                            type="text"
                            placeholder="e.g., Birthday celebration, Hawaii vacation, Extended lunch"
                            value={exception.note}
                            onChange={(e) => setException(prev => ({ ...prev, note: e.target.value }))}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-6 border-t mt-6">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[#091747] hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || !exception.exception_date}
                        className="bg-[#BF9C73] hover:bg-[#A88861] disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                        {saving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        {saving ? 'Saving...' : 'Save Exception'}
                    </button>
                </div>
            </div>
        </div>
    )
}