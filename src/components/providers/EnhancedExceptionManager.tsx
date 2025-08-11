'use client'

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { AlertCircle, Calendar, Clock, Repeat, X } from 'lucide-react'
import { useState } from 'react'

interface AvailabilityException {
    id?: string
    provider_id: string
    exception_date: string
    end_date?: string // For multi-day exceptions like vacations
    exception_type: 'unavailable' | 'custom_hours' | 'partial_block' | 'vacation' | 'recurring_change'
    start_time?: string
    end_time?: string
    is_recurring?: boolean
    recurrence_pattern?: 'daily' | 'weekly' | 'monthly'
    recurrence_interval?: number // e.g., every 2 weeks
    recurrence_count?: number // number of times to repeat
    recurrence_end_date?: string // or until this date
    recurrence_days?: number[] // for weekly: [1,3,5] = Mon, Wed, Fri
    note?: string
    created_at?: string
}

interface EnhancedExceptionManagerProps {
    providerId: string
    onClose: () => void
    onSave: () => void
}

export default function EnhancedExceptionManager({ 
    providerId, 
    onClose, 
    onSave 
}: EnhancedExceptionManagerProps) {
    const [exception, setException] = useState<Partial<AvailabilityException>>({
        provider_id: providerId,
        exception_type: 'unavailable',
        exception_date: '',
        is_recurring: false
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
        
        if (exception.is_recurring) {
            if (!exception.recurrence_pattern) {
                validationErrors.push('Recurrence pattern is required for recurring exceptions')
            }
            if (!exception.recurrence_count && !exception.recurrence_end_date) {
                validationErrors.push('Either repeat count or end date is required for recurring exceptions')
            }
        }
        
        return validationErrors
    }

    const generateRecurringExceptions = (baseException: AvailabilityException): AvailabilityException[] => {
        const exceptions: AvailabilityException[] = []
        const startDate = new Date(baseException.exception_date)
        let currentDate = new Date(startDate)
        
        // Add the base exception
        exceptions.push({ ...baseException })
        
        if (!baseException.is_recurring || !baseException.recurrence_pattern) {
            return exceptions
        }
        
        const maxIterations = baseException.recurrence_count || 52 // Safety limit
        const endDate = baseException.recurrence_end_date ? new Date(baseException.recurrence_end_date) : null
        
        for (let i = 1; i < maxIterations; i++) {
            const nextDate = new Date(currentDate)
            
            switch (baseException.recurrence_pattern) {
                case 'daily':
                    nextDate.setDate(nextDate.getDate() + (baseException.recurrence_interval || 1))
                    break
                case 'weekly':
                    nextDate.setDate(nextDate.getDate() + (7 * (baseException.recurrence_interval || 1)))
                    break
                case 'monthly':
                    nextDate.setMonth(nextDate.getMonth() + (baseException.recurrence_interval || 1))
                    break
            }
            
            // Check if we've exceeded the end date
            if (endDate && nextDate > endDate) break
            
            // For weekly patterns with specific days
            if (baseException.recurrence_pattern === 'weekly' && baseException.recurrence_days?.length) {
                // Generate exceptions for each specified day of the week
                baseException.recurrence_days.forEach(dayOfWeek => {
                    const dayDate = new Date(nextDate)
                    const currentDay = dayDate.getDay()
                    const daysToAdd = (dayOfWeek - currentDay + 7) % 7
                    dayDate.setDate(dayDate.getDate() + daysToAdd)
                    
                    if (!endDate || dayDate <= endDate) {
                        exceptions.push({
                            ...baseException,
                            exception_date: dayDate.toISOString().split('T')[0],
                            end_date: baseException.end_date ? 
                                new Date(new Date(dayDate).getTime() + 
                                    (new Date(baseException.end_date).getTime() - new Date(baseException.exception_date).getTime()))
                                    .toISOString().split('T')[0] : undefined
                        })
                    }
                })
            } else {
                exceptions.push({
                    ...baseException,
                    exception_date: nextDate.toISOString().split('T')[0],
                    end_date: baseException.end_date ? 
                        new Date(new Date(nextDate).getTime() + 
                            (new Date(baseException.end_date).getTime() - new Date(baseException.exception_date).getTime()))
                            .toISOString().split('T')[0] : undefined
                })
            }
            
            currentDate = nextDate
        }
        
        return exceptions
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
            const exceptionToSave: AvailabilityException = {
                provider_id: providerId,
                exception_date: exception.exception_date!,
                end_date: exception.end_date || exception.exception_date,
                exception_type: exception.exception_type || 'unavailable',
                start_time: exception.start_time,
                end_time: exception.end_time,
                is_recurring: exception.is_recurring || false,
                recurrence_pattern: exception.recurrence_pattern,
                recurrence_interval: exception.recurrence_interval,
                recurrence_count: exception.recurrence_count,
                recurrence_end_date: exception.recurrence_end_date,
                recurrence_days: exception.recurrence_days,
                note: exception.note,
                created_at: new Date().toISOString()
            }

            if (exceptionToSave.is_recurring) {
                // Generate all recurring instances
                const allExceptions = generateRecurringExceptions(exceptionToSave)
                
                // Insert all exceptions
                const { error } = await supabase
                    .from('availability_exceptions')
                    .insert(allExceptions.map(ex => ({ ...ex, id: undefined })))

                if (error) throw error
            } else {
                // Insert single exception
                const { error } = await supabase
                    .from('availability_exceptions')
                    .insert([exceptionToSave])

                if (error) throw error
            }

            onSave()
        } catch (error: any) {
            console.error('Error saving exception:', error)
            setErrors([`Error saving exception: ${error.message}`])
        } finally {
            setSaving(false)
        }
    }

    const getMinDate = () => new Date().toISOString().split('T')[0]

    const getExceptionTypeDescription = (type: string) => {
        switch (type) {
            case 'unavailable':
                return 'Block entire day(s) - no appointments available'
            case 'vacation':
                return 'Multi-day time off (vacation, conference, etc.)'
            case 'custom_hours':
                return 'Different hours than usual schedule'
            case 'partial_block':
                return 'Block specific hours (lunch, meeting, etc.)'
            case 'recurring_change':
                return 'Ongoing schedule change (new weekly hours, etc.)'
            default:
                return ''
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-4xl mx-4 max-h-[95vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                            Add Schedule Exception
                        </h2>
                        <p className="text-sm text-[#091747]/60 mt-1">
                            Block time, set custom hours, or create recurring schedule changes
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
                                { value: 'unavailable', label: 'Completely Unavailable', icon: X },
                                { value: 'vacation', label: 'Vacation/Multi-day Off', icon: Calendar },
                                { value: 'custom_hours', label: 'Custom Hours', icon: Clock },
                                { value: 'partial_block', label: 'Partial Day Block', icon: AlertCircle },
                                { value: 'recurring_change', label: 'Recurring Schedule Change', icon: Repeat }
                            ].map(({ value, label, icon: Icon }) => (
                                <label key={value} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="exception_type"
                                        value={value}
                                        checked={exception.exception_type === value}
                                        onChange={(e) => setException(prev => ({ 
                                            ...prev, 
                                            exception_type: e.target.value as any,
                                            start_time: value === 'unavailable' || value === 'vacation' ? undefined : prev.start_time,
                                            end_time: value === 'unavailable' || value === 'vacation' ? undefined : prev.end_time
                                        }))}
                                        className="mt-1 rounded border-stone-300 text-[#BF9C73] focus:ring-[#BF9C73]"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <Icon className="h-4 w-4 text-[#BF9C73]" />
                                            <span className="font-medium text-[#091747]">{label}</span>
                                        </div>
                                        <p className="text-xs text-[#091747]/60 mt-1">
                                            {getExceptionTypeDescription(value)}
                                        </p>
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
                                End Date {(exception.exception_type === 'vacation' || exception.exception_type === 'recurring_change') ? 
                                    <span className="text-red-500">*</span> : 
                                    <span className="text-gray-500">(optional)</span>}
                            </label>
                            <input
                                type="date"
                                min={exception.exception_date || getMinDate()}
                                value={exception.end_date || ''}
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
                                        value={exception.start_time || ''}
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
                                        value={exception.end_time || ''}
                                        onChange={(e) => setException(prev => ({ ...prev, end_time: e.target.value }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Recurring Options */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <label className="flex items-center gap-2 mb-4">
                            <input
                                type="checkbox"
                                checked={exception.is_recurring || false}
                                onChange={(e) => setException(prev => ({ ...prev, is_recurring: e.target.checked }))}
                                className="rounded border-stone-300 text-[#BF9C73] focus:ring-[#BF9C73]"
                            />
                            <span className="font-medium text-[#091747]">Make this a recurring exception</span>
                        </label>

                        {exception.is_recurring && (
                            <div className="space-y-4">
                                {/* Recurrence Pattern */}
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        Repeat Pattern <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={exception.recurrence_pattern || ''}
                                        onChange={(e) => setException(prev => ({ ...prev, recurrence_pattern: e.target.value as any }))}
                                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                    >
                                        <option value="">Select pattern...</option>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                    </select>
                                </div>

                                {/* Recurrence Interval */}
                                <div>
                                    <label className="block text-sm font-medium text-[#091747] mb-2">
                                        Repeat every
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="1"
                                            max="12"
                                            value={exception.recurrence_interval || 1}
                                            onChange={(e) => setException(prev => ({ ...prev, recurrence_interval: parseInt(e.target.value) }))}
                                            className="w-20 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                        />
                                        <span className="text-sm text-[#091747]">
                                            {exception.recurrence_pattern === 'daily' ? 'day(s)' :
                                             exception.recurrence_pattern === 'weekly' ? 'week(s)' :
                                             exception.recurrence_pattern === 'monthly' ? 'month(s)' : 'unit(s)'}
                                        </span>
                                    </div>
                                </div>

                                {/* Days of Week (for weekly pattern) */}
                                {exception.recurrence_pattern === 'weekly' && (
                                    <div>
                                        <label className="block text-sm font-medium text-[#091747] mb-2">
                                            Repeat on days
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {[
                                                { value: 0, label: 'Sun' },
                                                { value: 1, label: 'Mon' },
                                                { value: 2, label: 'Tue' },
                                                { value: 3, label: 'Wed' },
                                                { value: 4, label: 'Thu' },
                                                { value: 5, label: 'Fri' },
                                                { value: 6, label: 'Sat' }
                                            ].map(({ value, label }) => (
                                                <label key={value} className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={exception.recurrence_days?.includes(value) || false}
                                                        onChange={(e) => {
                                                            const days = exception.recurrence_days || []
                                                            if (e.target.checked) {
                                                                setException(prev => ({ ...prev, recurrence_days: [...days, value] }))
                                                            } else {
                                                                setException(prev => ({ ...prev, recurrence_days: days.filter(d => d !== value) }))
                                                            }
                                                        }}
                                                        className="mr-1 rounded border-stone-300 text-[#BF9C73] focus:ring-[#BF9C73]"
                                                    />
                                                    <span className="text-sm">{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* End Condition */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-[#091747] mb-2">
                                            Repeat count
                                        </label>
                                        <input
                                            type="number"
                                            min="1"
                                            max="365"
                                            value={exception.recurrence_count || ''}
                                            onChange={(e) => setException(prev => ({ ...prev, recurrence_count: parseInt(e.target.value) || undefined }))}
                                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                            placeholder="e.g., 10 times"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#091747] mb-2">
                                            Or until date
                                        </label>
                                        <input
                                            type="date"
                                            value={exception.recurrence_end_date || ''}
                                            onChange={(e) => setException(prev => ({ ...prev, recurrence_end_date: e.target.value }))}
                                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Note */}
                    <div>
                        <label className="block text-sm font-medium text-[#091747] mb-2">Note (optional)</label>
                        <input
                            type="text"
                            placeholder="e.g., Vacation in Hawaii, Weekly staff meeting, Extended lunch break"
                            value={exception.note || ''}
                            onChange={(e) => setException(prev => ({ ...prev, note: e.target.value }))}
                            className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                        />
                    </div>

                    {/* Preview for Recurring */}
                    {exception.is_recurring && exception.exception_date && exception.recurrence_pattern && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h4 className="font-medium text-green-900 mb-2">Preview</h4>
                            <p className="text-sm text-green-800">
                                This will create {exception.recurrence_count || 'multiple'} exceptions starting from {' '}
                                {new Date(exception.exception_date).toLocaleDateString()} {' '}
                                {exception.recurrence_pattern === 'weekly' && exception.recurrence_days?.length ? 
                                    `on ${exception.recurrence_days.map(d => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}` : ''}
                                {exception.recurrence_end_date && ` until ${new Date(exception.recurrence_end_date).toLocaleDateString()}`}
                            </p>
                        </div>
                    )}
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