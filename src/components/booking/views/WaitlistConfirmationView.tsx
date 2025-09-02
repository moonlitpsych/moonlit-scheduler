'use client'

import { Payer } from '@/types/database'
import { Check, Home, Mail } from 'lucide-react'

interface WaitlistConfirmationViewProps {
    selectedPayer: Payer
    onReturnHome: () => void
}

export default function WaitlistConfirmationView({ 
    selectedPayer,
    onReturnHome 
}: WaitlistConfirmationViewProps) {
    const payerName = selectedPayer?.name || 'this insurance'

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 via-orange-50/30 to-stone-100">
            <div className="max-w-4xl mx-auto py-16 px-4">
                <div className="text-center mb-12">
                    <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-8">
                        <Check className="w-12 h-12 text-green-600" />
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-light text-[#091747] mb-6 font-['Newsreader']">
                        You're on the notification list!
                    </h1>
                    
                    <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed mb-12">
                        We've added you to our notification list for {payerName}. We'll reach out 
                        as soon as we're credentialed with your insurance.
                    </p>
                </div>

                <div className="bg-white rounded-3xl shadow-xl p-8 md:p-12">
                    <div className="max-w-2xl mx-auto">
                        <h2 className="text-2xl font-light text-[#091747] mb-8 font-['Newsreader'] text-center">
                            What happens next?
                        </h2>

                        <div className="space-y-6">
                            <div className="flex items-start space-x-4">
                                <div className="w-8 h-8 bg-[#BF9C73] text-white rounded-full flex items-center justify-center font-medium text-sm">
                                    1
                                </div>
                                <div>
                                    <h3 className="font-medium text-[#091747] mb-2">We're working on credentialing</h3>
                                    <p className="text-slate-600">
                                        Our team is actively working to get credentialed with {payerName}. 
                                        This process typically takes 60-90 days.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="w-8 h-8 bg-[#BF9C73] text-white rounded-full flex items-center justify-center font-medium text-sm">
                                    2
                                </div>
                                <div>
                                    <h3 className="font-medium text-[#091747] mb-2">You'll get notified first</h3>
                                    <p className="text-slate-600">
                                        As soon as we're approved and can accept {payerName}, we'll send you an 
                                        email with instructions to book your appointment.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-4">
                                <div className="w-8 h-8 bg-[#BF9C73] text-white rounded-full flex items-center justify-center font-medium text-sm">
                                    3
                                </div>
                                <div>
                                    <h3 className="font-medium text-[#091747] mb-2">Book your appointment</h3>
                                    <p className="text-slate-600">
                                        Once notified, you'll be able to book your appointment online using 
                                        your {payerName} insurance.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 p-6 bg-[#FEF8F1] rounded-2xl">
                            <div className="flex items-start space-x-3">
                                <Mail className="w-6 h-6 text-[#BF9C73] mt-1" />
                                <div>
                                    <h3 className="font-medium text-[#091747] mb-2">Need care sooner?</h3>
                                    <p className="text-slate-600 mb-4">
                                        If you need psychiatric care before we're credentialed with your insurance, 
                                        you can book an appointment and pay out of pocket. Many patients are able 
                                        to get reimbursed by their insurance later.
                                    </p>
                                    <p className="text-sm text-slate-500">
                                        Contact us at <a href="mailto:hello@trymoonlit.com" className="text-[#BF9C73] hover:underline">hello@trymoonlit.com</a> 
                                         for assistance with out-of-pocket appointments.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 text-center">
                            <button
                                onClick={onReturnHome}
                                className="inline-flex items-center space-x-2 py-4 px-8 bg-[#BF9C73] hover:bg-[#A8875F] text-white rounded-xl font-medium transition-colors"
                            >
                                <Home className="w-5 h-5" />
                                <span>Return to home</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}