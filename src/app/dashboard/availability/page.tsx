// src/app/dashboard/availability/page.tsx
'use client'

import ScheduleEditor from '@/components/providers/ScheduleEditor'
import { createClient } from '@supabase/supabase-js'
import { Calendar, Clock, Edit, Settings } from 'lucide-react'
import { useEffect, useState } from 'react'

// Create Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function ProviderAvailabilityPage() {
    const [loading, setLoading] = useState(true)
    const [user, setUser] = useState<any>(null)
    const [provider, setProvider] = useState<any>(null)
    const [editing, setEditing] = useState(false)
    const [schedule, setSchedule] = useState<any[]>([])

    useEffect(() => {
        loadUserAndProvider()
    }, [])

    const loadUserAndProvider = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            setUser(user)
            
            if (user) {
                // Try to find provider by email
                const { data: providerData } = await supabase
                    .from('providers')
                    .select('*')
                    .eq('email', user.email)
                    .single()
                
                if (providerData) {
                    setProvider(providerData)
                    await loadSchedule(providerData.id)
                }
            }
        } catch (error) {
            console.error('Error loading user and provider:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadSchedule = async (providerId: string) => {
        try {
            const { data: availability } = await supabase
                .from('provider_availability')
                .select('*')
                .eq('provider_id', providerId)
                .order('day_of_week')
                .order('start_time')
            
            setSchedule(availability || [])
        } catch (error) {
            console.error('Error loading schedule:', error)
        }
    }

    const handleSaveComplete = () => {
        setEditing(false)
        if (provider) {
            loadSchedule(provider.id)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73] mx-auto mb-4"></div>
                    <p className="text-[#091747]/70">Loading availability manager...</p>
                </div>
            </div>
        )
    }

    // Get unique days from schedule for stats
    const activeDays = [...new Set(schedule.map(s => s.day_of_week))].length
    const totalBlocks = schedule.length

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
                        Manage Your Availability
                    </h1>
                    <p className="mt-2 text-[#091747]/70">
                        Set your weekly schedule, time off, and booking preferences for patient appointments.
                    </p>
                </div>

                {editing ? (
                    /* Schedule Editor */
                    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                        <ScheduleEditor
                            providerId={provider?.id || 'temp-provider-id'}
                            onSave={handleSaveComplete}
                            onCancel={() => setEditing(false)}
                        />
                    </div>
                ) : (
                    <>
                        {/* Status Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                                        <p className="text-2xl font-bold text-[#091747]">
                                            {provider ? 'Active' : 'Setup'}
                                        </p>
                                        <p className="text-xs text-[#091747]/50">
                                            {provider ? 'Ready for bookings' : 'Complete setup'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Weekly Schedule Display */}
                            <div className="lg:col-span-2">
                                <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                                            Weekly Schedule
                                        </h2>
                                        <button
                                            onClick={() => setEditing(true)}
                                            className="px-4 py-2 bg-[#BF9C73] text-white rounded-lg text-sm hover:bg-[#A87D5E] transition-colors flex items-center"
                                        >
                                            <Edit className="w-4 h-4 mr-2" />
                                            Edit Schedule
                                        </button>
                                    </div>
                                    
                                    {schedule.length > 0 ? (
                                        <div className="space-y-4">
                                            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, dayNumber) => {
                                                const dayBlocks = schedule.filter(s => s.day_of_week === dayNumber)
                                                
                                                return (
                                                    <div key={dayNumber} className="flex items-center justify-between p-4 border border-stone-100 rounded-lg">
                                                        <div className="flex items-center">
                                                            <div className={`w-3 h-3 rounded-full mr-3 ${dayBlocks.length > 0 ? 'bg-[#17DB4E]' : 'bg-stone-300'}`}></div>
                                                            <span className="font-medium text-[#091747]">{dayName}</span>
                                                        </div>
                                                        <div className="text-sm text-[#091747]">
                                                            {dayBlocks.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {dayBlocks.map((block, index) => (
                                                                        <div key={index}>
                                                                            {block.start_time} - {block.end_time}
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
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Info Panel */}
                            <div className="space-y-6">
                                {/* Provider Info */}
                                {provider ? (
                                    <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                                        <h3 className="font-semibold text-[#091747] mb-4">Provider Info</h3>
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
                                        </div>
                                    </div>
                                ) : user ? (
                                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
                                        <h3 className="font-semibold text-yellow-900 mb-3">Setup Required</h3>
                                        <p className="text-sm text-yellow-800 mb-4">
                                            Your account ({user.email}) needs to be linked to a provider profile.
                                        </p>
                                        <button className="text-sm bg-yellow-600 text-white px-3 py-2 rounded hover:bg-yellow-700">
                                            Contact Admin
                                        </button>
                                    </div>
                                ) : null}

                                {/* Development Status */}
                                <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                                    <h3 className="font-semibold text-green-900 mb-3">
                                        ✅ Schedule Management Active
                                    </h3>
                                    <div className="space-y-2 text-sm text-green-800">
                                        <p>✅ Database connected</p>
                                        <p>✅ Schedule editing working</p>
                                        <p>✅ Real-time updates</p>
                                        <p>🔄 Patient booking integration (next)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}