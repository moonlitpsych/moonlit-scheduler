'use client'

import { BookingState } from '../BookingFlow'

interface ProviderInsuranceMismatchViewProps {
    state: BookingState
    onContinueWithOthers: () => void
    onJoinWaitlist: () => void
    providerName: string
    insuranceName: string
}

export default function ProviderInsuranceMismatchView({
    state,
    onContinueWithOthers,
    onJoinWaitlist,
    providerName,
    insuranceName
}: ProviderInsuranceMismatchViewProps) {
    return (
        <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl shadow-lg p-8 text-center">
                {/* Warning Icon */}
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-['Newsreader'] text-[#091747] mb-4 font-light">
                    Insurance Not Accepted
                </h1>

                {/* Message */}
                <div className="mb-8">
                    <p className="text-xl text-[#091747]/80 font-['Newsreader'] mb-4">
                        Dr. {providerName} can't accept {insuranceName}.
                    </p>
                    <p className="text-lg text-[#091747]/70 font-['Newsreader']">
                        We do have other physicians who do accept your insurance.
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-4">
                    <button
                        onClick={onContinueWithOthers}
                        className="w-full bg-[#BF9C73] hover:bg-[#A8865F] text-white py-4 px-8 rounded-xl font-['Newsreader'] text-lg font-medium transition-colors shadow-sm"
                    >
                        Continue booking with another physician
                    </button>

                    <button
                        onClick={onJoinWaitlist}
                        className="w-full bg-white hover:bg-[#FEF8F1] text-[#091747] py-4 px-8 rounded-xl font-['Newsreader'] text-lg font-medium border-2 border-[#BF9C73] hover:border-[#A8865F] transition-colors"
                    >
                        Notify Dr. {providerName} and get on their waitlist for {insuranceName}
                    </button>

                    <div className="pt-4 border-t border-gray-200 mt-8">
                        <p className="text-sm text-[#091747]/60 font-['Newsreader']">
                            Need help? <a href="tel:(385) 246-2522" className="text-[#BF9C73] hover:underline">Call us at (385) 246-2522</a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}