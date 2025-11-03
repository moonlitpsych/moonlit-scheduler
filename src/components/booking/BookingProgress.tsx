import React from 'react'

interface BookingProgressProps {
    progressMessage?: string
    showRetryButton?: boolean
    onRetry?: () => void
}

/**
 * V3.3: Booking progress indicator component
 * Shows real-time feedback during long-running booking operations
 */
export default function BookingProgress({
    progressMessage,
    showRetryButton,
    onRetry
}: BookingProgressProps) {
    if (!progressMessage) return null

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="flex flex-col items-center">
                    {/* Animated spinner */}
                    <div className="relative">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-teal-600"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-8 w-8 rounded-full bg-teal-100"></div>
                        </div>
                    </div>

                    {/* Progress message */}
                    <p className="mt-6 text-lg text-gray-800 text-center font-['Newsreader']">
                        {progressMessage}
                    </p>

                    {/* Progress steps indicator */}
                    <div className="mt-6 space-y-2 w-full">
                        <ProgressStep
                            label="Validating information"
                            completed={true}
                        />
                        <ProgressStep
                            label="Creating patient record"
                            completed={progressMessage.includes('patient') || progressMessage.includes('done')}
                            active={progressMessage.includes('patient')}
                        />
                        <ProgressStep
                            label="Scheduling appointment"
                            completed={progressMessage.includes('done')}
                            active={progressMessage.includes('Still working') || progressMessage.includes('Almost')}
                        />
                        <ProgressStep
                            label="Sending intake forms"
                            completed={false}
                            active={progressMessage.includes('Almost done')}
                        />
                    </div>

                    {/* Retry button */}
                    {showRetryButton && (
                        <div className="mt-6 space-y-3 w-full">
                            <button
                                onClick={onRetry}
                                className="w-full bg-teal-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-teal-700 transition-colors"
                            >
                                Try Again
                            </button>
                            <p className="text-sm text-gray-500 text-center">
                                Your booking is still processing in the background. If successful, you'll receive a confirmation email.
                            </p>
                        </div>
                    )}

                    {/* Additional info for long waits */}
                    {progressMessage.includes('minute') && (
                        <p className="mt-4 text-sm text-gray-500 text-center">
                            We're working with multiple systems to ensure your appointment is properly scheduled.
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

function ProgressStep({
    label,
    completed,
    active
}: {
    label: string
    completed: boolean
    active?: boolean
}) {
    return (
        <div className="flex items-center space-x-3">
            <div className={`
                w-5 h-5 rounded-full border-2 flex items-center justify-center
                ${completed ? 'bg-teal-600 border-teal-600' :
                  active ? 'border-teal-600 bg-teal-50' :
                  'border-gray-300 bg-white'}
            `}>
                {completed && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                )}
                {active && !completed && (
                    <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse"></div>
                )}
            </div>
            <span className={`text-sm ${completed ? 'text-gray-800' : active ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                {label}
            </span>
        </div>
    )
}