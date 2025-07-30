// src/components/booking/views/WelcomeView.tsx
'use client'

interface WelcomeViewProps {
    onSelection: (isForSelf: boolean) => void
}

export default function WelcomeView({ onSelection }: WelcomeViewProps) {
    return (
        <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-normal text-slate-800 mb-8">
                    Welcome! Who are you filling out this form for?
                </h2>

                <div className="space-y-4">
                    <button
                        onClick={() => onSelection(true)}
                        className="block w-full max-w-md mx-auto bg-orange-300 hover:bg-orange-400 text-slate-800 font-medium py-4 px-6 rounded-md transition-colors"
                    >
                        For me – I am the prospective patient.
                    </button>

                    <button
                        onClick={() => onSelection(false)}
                        className="block w-full max-w-md mx-auto border-2 border-orange-300 hover:border-orange-400 text-slate-800 font-medium py-4 px-6 rounded-md transition-colors bg-white"
                    >
                        For someone else – I'm supporting another person.
                    </button>
                </div>
            </div>
        </div>
    )
}