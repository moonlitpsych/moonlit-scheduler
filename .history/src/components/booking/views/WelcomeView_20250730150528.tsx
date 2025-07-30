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

                <div className="space-y-6 max-w-3xl mx-auto">
                    {/* Self-booking option */}
                    <button
                        onClick={() => onSelection('self')}
                        className="
                            w-full p-8 bg-[#BF9C73] hover:bg-[#B8936A] 
                            text-white font-medium text-lg rounded-2xl 
                            transition-all duration-300 hover:shadow-xl hover:scale-[1.02]
                            border-2 border-[#BF9C73] hover:border-[#B8936A]
                            text-left font-['Newsreader']
                        "
                    >
                        <div className="flex items-start space-x-6">
                            <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">👤</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2">For myself</h3>
                                <p className="text-white/90 leading-relaxed">
                                    I am the patient and want to book my own appointment. I'll receive all communications directly.
                                </p>
                            </div>
                        </div>
                    </button>

                    {/* Third-party referral option */}
                    <button
                        onClick={() => onSelection('referral')}
                        className="
                            w-full p-8 bg-white hover:bg-[#FEF8F1] 
                            text-[#091747] font-medium text-lg rounded-2xl 
                            transition-all duration-300 hover:shadow-xl hover:scale-[1.02]
                            border-2 border-[#BF9C73] hover:border-[#B8936A]
                            text-left font-['Newsreader']
                        "
                    >
                        <div className="flex items-start space-x-6">
                            <div className="w-16 h-16 bg-[#BF9C73]/10 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">🤝</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-[#091747]">For someone else (referral)</h3>
                                <p className="text-[#091747]/70 leading-relaxed">
                                    I'm helping someone book an appointment. The patient will handle their own communications and care.
                                </p>
                            </div>
                        </div>
                    </button>

                    {/* Case manager option */}
                    <button
                        onClick={() => onSelection('case-manager')}
                        className="
                            w-full p-8 bg-white hover:bg-[#FEF8F1] 
                            text-[#091747] font-medium text-lg rounded-2xl 
                            transition-all duration-300 hover:shadow-xl hover:scale-[1.02]
                            border-2 border-[#17DB4E] hover:border-[#15C946]
                            text-left font-['Newsreader'] relative overflow-hidden
                        "
                    >
                        {/* Subtle accent gradient for case manager option */}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#17DB4E]/5 to-transparent"></div>
                        <div className="relative flex items-start space-x-6">
                            <div className="w-16 h-16 bg-[#17DB4E]/10 rounded-xl flex items-center justify-center">
                                <span className="text-2xl">👥</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-semibold mb-2 text-[#091747]">For my client (case manager)</h3>
                                <p className="text-[#091747]/70 leading-relaxed mb-3">
                                    I'm a case manager booking for my client. I need to receive all appointment communications
                                    and will help coordinate their care.
                                </p>
                                <div className="bg-[#17DB4E]/10 px-4 py-2 rounded-lg">
                                    <p className="text-sm text-[#17DB4E] font-medium">
                                        ✓ Perfect for case managers, advocates, and care coordinators
                                    </p>
                                </div>
                            </div>
                        </div>
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