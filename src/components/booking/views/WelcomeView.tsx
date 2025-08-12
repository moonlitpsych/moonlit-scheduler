'use client'

export type BookingScenario = 'self' | 'referral' | 'case-manager'

interface WelcomeViewProps {
    onSelection: (scenario: BookingScenario) => void
}

export default function WelcomeView({ onSelection }: WelcomeViewProps) {
    const handleButtonClick = (scenario: BookingScenario) => {
        console.log('Button clicked:', scenario) // Debug log
        onSelection(scenario)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
            <div className="max-w-4xl mx-auto py-16 px-4">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-[#091747] mb-6 font-['Newsreader']">
                        Who will this appointment be for?
                    </h1>
                    <p className="text-xl text-[#091747]/70 max-w-3xl mx-auto leading-relaxed font-['Newsreader']">
                        Please select the option that best describes your situation so we can provide the right support.
                    </p>
                </div>

                <div className="space-y-4 max-w-2xl mx-auto">
                    <button
                        type="button"
                        onClick={() => handleButtonClick('self')}
                        className="
                            w-full py-4 px-6 bg-[#BF9C73] hover:bg-[#B8936A] 
                            text-white font-medium text-lg rounded-xl 
                            transition-all duration-200 hover:shadow-lg hover:scale-[1.01]
                            border-2 border-[#BF9C73] hover:border-[#B8936A]
                            text-center font-['Newsreader'] cursor-pointer
                        "
                    >
                        For myself
                    </button>

                    <button
                        type="button"
                        onClick={() => handleButtonClick('referral')}
                        className="
                            w-full py-4 px-6 bg-white hover:bg-[#FEF8F1] 
                            text-[#091747] font-medium text-lg rounded-xl 
                            transition-all duration-200 hover:shadow-lg hover:scale-[1.01]
                            border-2 border-[#BF9C73] hover:border-[#B8936A]
                            text-center font-['Newsreader'] cursor-pointer
                        "
                    >
                        For someone else (referral)
                    </button>

                    <button
                        type="button"
                        onClick={() => handleButtonClick('case-manager')}
                        className="
                            w-full py-4 px-6 bg-white hover:bg-[#FEF8F1] 
                            text-[#091747] font-medium text-lg rounded-xl 
                            transition-all duration-200 hover:shadow-lg hover:scale-[1.01]
                            border-2 border-[#17DB4E] hover:border-[#15C946]
                            text-center font-['Newsreader'] cursor-pointer
                        "
                    >
                        For my client (case manager)
                    </button>
                </div>

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