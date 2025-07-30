// src/components/booking/views/WelcomeView.tsx
'use client'

interface WelcomeViewProps {
    onSelection: (isForSelf: boolean) => void
}

export default function WelcomeView({ onSelection }: WelcomeViewProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center px-4" style={{ fontFamily: 'Newsreader, serif' }}>
            <div className="max-w-3xl mx-auto py-20">
                <div className="text-center">
                    <h1 className="text-5xl font-light text-[#091747] mb-12">
                        Welcome! Who are you filling out this form for?
                    </h1>

                    <div className="space-y-4 max-w-2xl mx-auto">
                        <button
                            onClick={() => onSelection(true)}
                            className="
                                w-full py-6 px-8 bg-[#BF9C73] hover:bg-[#BF9C73]/90 
                                text-[#FEF8F1] font-medium text-lg rounded-xl 
                                transition-all duration-200 hover:shadow-lg hover:scale-105
                                border-2 border-[#BF9C73] hover:border-[#BF9C73]/90
                            "
                            style={{ fontFamily: 'Newsreader, serif' }}
                        >
                            For me – I am the prospective patient.
                        </button>

                        <button
                            onClick={() => onSelection(false)}
                            className="
                                w-full py-6 px-8 bg-white hover:bg-[#FEF8F1] 
                                text-[#091747] font-medium text-lg rounded-xl 
                                transition-all duration-200 hover:shadow-lg hover:scale-105
                                border-2 border-[#BF9C73] hover:border-[#BF9C73]/90
                            "
                            style={{ fontFamily: 'Newsreader, serif' }}
                        >
                            For someone else – I'm supporting another person.
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}