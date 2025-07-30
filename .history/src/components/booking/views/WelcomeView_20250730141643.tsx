// src/components/booking/views/WelcomeView.tsx
'use client'

interface WelcomeViewProps {
    onSelection: (isForSelf: boolean) => void
}

export default function WelcomeView({ onSelection }: WelcomeViewProps) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100 flex items-center justify-center px-4">
            <div className="max-w-3xl mx-auto py-20">
                <div className="text-center">
                    <h1 className="text-5xl font-light text-slate-800 mb-12">
                        Welcome! Who are you filling out this form for?
                    </h1>

                    <div className="space-y-4 max-w-2xl mx-auto">
                        <button
                            onClick={() => onSelection(true)}
                            className="
                                w-full py-6 px-8 bg-orange-300 hover:bg-orange-400 
                                text-slate-800 font-medium text-lg rounded-xl 
                                transition-all duration-200 hover:shadow-lg hover:scale-105
                                border-2 border-orange-300 hover:border-orange-400
                            "
                        >
                            For me – I am the prospective patient.
                        </button>

                        <button
                            onClick={() => onSelection(false)}
                            className="
                                w-full py-6 px-8 bg-white hover:bg-orange-50 
                                text-slate-800 font-medium text-lg rounded-xl 
                                transition-all duration-200 hover:shadow-lg hover:scale-105
                                border-2 border-orange-300 hover:border-orange-400
                            "
                        >
                            For someone else – I'm supporting another person.
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}