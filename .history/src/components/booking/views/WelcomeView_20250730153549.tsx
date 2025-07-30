// src/components/booking/views/WelcomeView.tsx
'use client'

export type BookingScenario = 'self' | 'referral' | 'case-manager'

interface WelcomeViewProps {
    onSelection: (scenario: BookingScenario) => void
}

export default function WelcomeView({ onSelection }: WelcomeViewProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/30 to-[#FEF8F1] flex items-center justify-center px-4">
            <div className="max-w-4xl mx-auto py-20">
                <div className="text-center mb-16">
                    <h1 className="text-5xl font-light text-[#091747] mb-6 font-['Newsreader']">
                        Welcome! Who are you booking for?
                    </h1>
                    <p className="text-xl text-[#091747]/70 max-w-3xl mx-auto leading-relaxed font-['Newsreader']">
                        Please select the option that best describes your situation so we can provide the right support.
                    </p>
                </div>

                <div className="space-y-4 max-w-2xl mx-auto">
                    {/* Self-booking option */}
                    <button
                        onClick={() => onSelection('self')}
                        className="
                            w-full py-4 px-6 bg-[#BF9C73] hover:bg-[#B8936A] 
                            text-white font-medium text-lg rounded-xl 
                            transition-all duration-200 hover:shadow-lg hover:scale-[1.01]
                            border-2 border-[#BF9C73] hover:border-[#B8936A]
                            text-center font-['Newsreader']
                        "
                    >
                        For myself
                    </button>

                    {/* Third-party referral option */}
                    <button
                        onClick={() => onSelection('referral')}
                        className="
                            w-full py-4 px-6 bg-white hover:bg-[#FEF8F1] 
                            text-[#091747] font-medium text-lg rounded-xl 
                            transition-all duration-200 hover:shadow-lg hover:scale-[1.01]
                            border-2 border-[#BF9C73] hover:border-[#B8936A]
                            text-center font-['Newsreader']
                        "
                    >
                        For someone else (referral)
                    </button>

                    {/* Case manager option */}
                    <button
                        onClick={() => onSelection('case-manager')}
                        className="
                            w-full py-4 px-6 bg-white hover:bg-[#FEF8F1] 
                            text-[#091747] font-medium text-lg rounded-xl 
                            transition-all duration-200 hover:shadow-lg hover:scale-[1.01]
                            border-2 border-[#17DB4E] hover:border-[#15C946]
                            text-center font-['Newsreader']
                        "
                    >
                        For my client (case manager)
                    </button>
                </div>

                {/* Help text */}
                <div className="mt-12 text-center">
                    <p className="text-[#091747]/60 text-sm font-['Newsreader']">
                        Not sure which option fits? The case manager option is ideal if you coordinate ongoing care,
                        help with technology, or need to receive appointment communications.
                    </p>
                </div>
            </div>
        </div>
    )
}