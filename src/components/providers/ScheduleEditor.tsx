// src/components/providers/ScheduleEditor.tsx
'use client'

import { createClient } from '@supabase/supabase-js'
import { Clock, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'

// Create Supabase client
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface TimeBlock {
    id?: string
    start_time: string
    end_time: string
}

interface DaySchedule {
    day_of_week: number
    is_available: boolean
    time_blocks: TimeBlock[]
}

interface ScheduleEditorProps {
    providerId: string
    onSave: () => void
    onCancel: () => void
}

const DAYS = [
    { name: 'Sunday', short: 'Sun', number: 0 },
    { name: 'Monday', short: 'Mon', number: 1 },
    { name: 'Tuesday', short: 'Tue', number: 2 },
    { name: 'Wednesday', short: 'Wed', number: 3 },
    { name: 'Thursday', short: 'Thu', number: 4 },
    { name: 'Friday', short: 'Fri', number: 5 },
    { name: 'Saturday', short: 'Sat', number: 6 },
]

export default function ScheduleEditor({ providerId, onSave, onCancel }: ScheduleEditorProps) {
    const [schedule, setSchedule] = useState<{ [key: number]: DaySchedule }>({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [debugInfo, setDebugInfo] = useState<any>(null)

    // Load current schedule
    useEffect(() => {
        loadSchedule()
    }, [providerId])

    const loadSchedule = async () => {
        try {
            setLoading(true)
            setError('')
            
            console.log('Loading schedule for provider:', providerId)
            
            // Use API endpoint instead of direct Supabase access to handle RLS policies
            const response = await fetch(`/api/providers/availability?providerId=${providerId}`, {
                method: 'GET',
                credentials: 'include' // Include cookies for authentication
            })

            const result = await response.json()
            console.log('API load result:', result)

            if (!response.ok) {
                setError(`Failed to load schedule: ${result.error}`)
                setDebugInfo({ apiError: result, providerId })
                return
            }

            const availability = result.availability || []

            // Build schedule object
            const newSchedule: { [key: number]: DaySchedule } = {}
            
            // Initialize all days as unavailable
            DAYS.forEach(day => {
                newSchedule[day.number] = {
                    day_of_week: day.number,
                    is_available: false,
                    time_blocks: []
                }
            })

            // Add existing availability
            availability?.forEach(block => {
                const daySchedule = newSchedule[block.day_of_week]
                if (daySchedule) {
                    daySchedule.is_available = true
                    daySchedule.time_blocks.push({
                        id: block.id,
                        start_time: block.start_time,
                        end_time: block.end_time
                    })
                }
            })

            setSchedule(newSchedule)
            setDebugInfo({ 
                availabilityCount: availability?.length || 0, 
                providerId,
                availability: availability?.slice(0, 3) // Just first 3 for debugging
            })

        } catch (error: any) {
            console.error('Unexpected error loading schedule:', error)
            setError(`Unexpected error: ${error.message || 'Unknown error'}`)
            setDebugInfo({ unexpectedError: error })
        } finally {
            setLoading(false)
        }
    }

    const toggleDayAvailability = (dayNumber: number) => {
        setSchedule(prev => ({
            ...prev,
            [dayNumber]: {
                ...prev[dayNumber],
                is_available: !prev[dayNumber].is_available,
                time_blocks: prev[dayNumber].is_available ? [] : [{ start_time: '09:00', end_time: '17:00' }]
            }
        }))
    }

    const addTimeBlock = (dayNumber: number) => {
        setSchedule(prev => ({
            ...prev,
            [dayNumber]: {
                ...prev[dayNumber],
                time_blocks: [
                    ...prev[dayNumber].time_blocks,
                    { start_time: '09:00', end_time: '12:00' }
                ]
            }
        }))
    }

    const updateTimeBlock = (dayNumber: number, blockIndex: number, field: 'start_time' | 'end_time', value: string) => {
        setSchedule(prev => ({
            ...prev,
            [dayNumber]: {
                ...prev[dayNumber],
                time_blocks: prev[dayNumber].time_blocks.map((block, index) =>
                    index === blockIndex ? { ...block, [field]: value } : block
                )
            }
        }))
    }

    const removeTimeBlock = (dayNumber: number, blockIndex: number) => {
        setSchedule(prev => ({
            ...prev,
            [dayNumber]: {
                ...prev[dayNumber],
                time_blocks: prev[dayNumber].time_blocks.filter((_, index) => index !== blockIndex)
            }
        }))
    }

    const saveSchedule = async () => {
        try {
            setSaving(true)
            setError('')

            console.log('Saving schedule for provider:', providerId)

            // Use API endpoint with proper permissions
            const response = await fetch('/api/providers/availability', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    providerId: providerId,
                    schedule: schedule
                })
            })

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Failed to save schedule')
            }

            console.log('Schedule saved successfully:', result)
            // Reload the schedule to reflect changes
            await loadSchedule()
            onSave()
        } catch (error: any) {
            console.error('Error saving schedule:', error)
            setError(`Failed to save schedule: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    const initializeDefaultSchedule = () => {
        const defaultSchedule: { [key: number]: DaySchedule } = {}
        DAYS.forEach(day => {
            defaultSchedule[day.number] = {
                day_of_week: day.number,
                is_available: day.number >= 1 && day.number <= 5, // Mon-Fri
                time_blocks: day.number >= 1 && day.number <= 5 ? 
                    [{ start_time: '09:00', end_time: '17:00' }] : []
            }
        })
        setSchedule(defaultSchedule)
        setError('')
    }

    if (loading) {
        return (
            <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF9C73] mx-auto mb-4"></div>
                <p className="text-[#091747]/70">Loading schedule...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-8">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">Schedule Loading Error</h3>
                    <p className="text-red-700 mb-4">{error}</p>
                    
                    {/* Debug Information */}
                    {debugInfo && (
                        <details className="mt-4">
                            <summary className="text-sm text-red-600 cursor-pointer">Debug Information</summary>
                            <pre className="text-xs text-red-600 mt-2 overflow-auto bg-red-100 p-2 rounded">
                                {JSON.stringify(debugInfo, null, 2)}
                            </pre>
                        </details>
                    )}
                    
                    <div className="flex space-x-3 mt-4">
                        <button
                            onClick={loadSchedule}
                            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                            Retry
                        </button>
                        <button
                            onClick={initializeDefaultSchedule}
                            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                        >
                            Start with Default Schedule
                        </button>
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 border border-stone-300 text-[#091747] rounded hover:bg-stone-50"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                        Edit Weekly Schedule
                    </h2>
                    <p className="text-[#091747]/70 text-sm mt-1">
                        Set your available hours for each day of the week
                    </p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-stone-300 text-[#091747] rounded-lg hover:bg-stone-50 transition-colors"
                    >
                        <X className="w-4 h-4 inline mr-2" />
                        Cancel
                    </button>
                    <button
                        onClick={saveSchedule}
                        disabled={saving}
                        className="px-4 py-2 bg-[#BF9C73] text-white rounded-lg hover:bg-[#A87D5E] transition-colors disabled:opacity-50"
                    >
                        <Save className="w-4 h-4 inline mr-2" />
                        {saving ? 'Saving...' : 'Save Schedule'}
                    </button>
                </div>
            </div>

            {/* Debug Info (in development) */}
            {debugInfo && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <details>
                        <summary className="text-sm text-blue-600 cursor-pointer">Debug Info</summary>
                        <pre className="text-xs text-blue-600 mt-2 overflow-auto">
                            {JSON.stringify(debugInfo, null, 2)}
                        </pre>
                    </details>
                </div>
            )}

            {/* Schedule Editor */}
            <div className="space-y-4">
                {DAYS.map(day => {
                    const daySchedule = schedule[day.number] || { day_of_week: day.number, is_available: false, time_blocks: [] }
                    
                    return (
                        <div key={day.number} className="bg-white border border-stone-200 rounded-lg p-4">
                            {/* Day Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <button
                                        onClick={() => toggleDayAvailability(day.number)}
                                        className="flex items-center"
                                    >
                                        <div className={`w-4 h-4 rounded-full mr-3 transition-colors ${
                                            daySchedule.is_available ? 'bg-[#17DB4E]' : 'bg-stone-300'
                                        }`}></div>
                                        <span className="font-medium text-[#091747]">{day.name}</span>
                                    </button>
                                </div>
                                
                                {daySchedule.is_available && (
                                    <button
                                        onClick={() => addTimeBlock(day.number)}
                                        className="text-[#BF9C73] hover:text-[#A87D5E] text-sm flex items-center"
                                    >
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add Time Block
                                    </button>
                                )}
                            </div>

                            {/* Time Blocks */}
                            {daySchedule.is_available && (
                                <div className="space-y-3">
                                    {daySchedule.time_blocks.map((block, index) => (
                                        <div key={index} className="flex items-center space-x-3 p-3 bg-stone-50 rounded-lg">
                                            <Clock className="w-4 h-4 text-[#091747]/60" />
                                            <input
                                                type="time"
                                                value={block.start_time}
                                                onChange={(e) => updateTimeBlock(day.number, index, 'start_time', e.target.value)}
                                                className="px-3 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                                            />
                                            <span className="text-[#091747]/60">to</span>
                                            <input
                                                type="time"
                                                value={block.end_time}
                                                onChange={(e) => updateTimeBlock(day.number, index, 'end_time', e.target.value)}
                                                className="px-3 py-2 border border-stone-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#BF9C73]"
                                            />
                                            <button
                                                onClick={() => removeTimeBlock(day.number, index)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {daySchedule.time_blocks.length === 0 && (
                                        <p className="text-[#091747]/50 text-sm italic">
                                            Click "Add Time Block" to set available hours for this day
                                        </p>
                                    )}
                                </div>
                            )}

                            {!daySchedule.is_available && (
                                <p className="text-[#091747]/50 text-sm italic">
                                    Click the day name to mark as available
                                </p>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}