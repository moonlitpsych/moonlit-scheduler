'use client'

import { useState, useEffect } from 'react'
import { Check, Calendar, Clock, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'

type DemoStep = 'select_insurance' | 'show_booking_options' | 'get_merged_availability' | 'get_provider_list' | 'preview_booking' | 'create_appointment'

interface Payer {
  id: string
  name: string
}

interface BookingOption {
  id: string
  title: string
  description: string
  recommended: boolean
  icon: string
}

interface Provider {
  id: string
  full_name: string
  title: string
  specialty: string
  bio: string
  languages_spoken: string[]
  price_range: string
  telehealth_status: string
  new_patient_status: string
  years_experience: number
}

interface DemoResponse {
  success: boolean
  demo_mode: boolean
  step: string
  data: any
  user_story?: string
  user_stories?: string[]
  next_step?: string
  next_steps?: string[]
  completion?: boolean
}

export default function DemoPage() {
  const [currentStep, setCurrentStep] = useState<DemoStep>('select_insurance')
  const [selectedPayer, setSelectedPayer] = useState<string>('')
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [bookingPreference, setBookingPreference] = useState<'by_availability' | 'by_provider'>('by_availability')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedTime, setSelectedTime] = useState<string>('')
  const [patientInfo, setPatientInfo] = useState({
    firstName: 'John',
    lastName: 'Demo',
    email: 'john.demo@example.com',
    phone: '555-0123'
  })

  const [demoData, setDemoData] = useState<DemoResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDemoStep = async (step: DemoStep, additionalData: any = {}) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/demo/booking-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step,
          payer_id: selectedPayer,
          provider_id: selectedProvider,
          date: selectedDate,
          time: selectedTime,
          patient_info: patientInfo,
          booking_preference: bookingPreference,
          ...additionalData
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: DemoResponse = await response.json()
      setDemoData(data)
      setCurrentStep(step)

    } catch (err: any) {
      setError(`Failed to fetch demo step: ${err.message}`)
      console.error('Demo step error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDemoStep('select_insurance')
  }, [])

  const handlePayerSelect = (payerId: string) => {
    setSelectedPayer(payerId)
    fetchDemoStep('show_booking_options', { payer_id: payerId })
  }

  const handleBookingOptionSelect = (option: 'by_availability' | 'by_provider') => {
    setBookingPreference(option)
    if (option === 'by_availability') {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      const dateStr = tomorrow.toISOString().split('T')[0]
      setSelectedDate(dateStr)
      fetchDemoStep('get_merged_availability', { date: dateStr })
    } else {
      fetchDemoStep('get_provider_list')
    }
  }

  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dateStr = tomorrow.toISOString().split('T')[0]
    setSelectedDate(dateStr)
    fetchDemoStep('get_provider_availability', { provider_id: providerId, date: dateStr })
  }

  const handleTimeSlotSelect = (time: string) => {
    setSelectedTime(time)
    fetchDemoStep('preview_booking', { 
      date: selectedDate, 
      time, 
      patient_info: patientInfo 
    })
  }

  const handleCreateAppointment = () => {
    fetchDemoStep('create_appointment', {
      date: selectedDate,
      time: selectedTime,
      patient_info: patientInfo
    })
  }

  const handleStartOver = () => {
    setCurrentStep('select_insurance')
    setSelectedPayer('')
    setSelectedProvider('')
    setSelectedDate('')
    setSelectedTime('')
    setBookingPreference('by_availability')
    fetchDemoStep('select_insurance')
  }

  if (loading && !demoData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#BF9C73] mx-auto mb-4"></div>
          <p className="text-[#091747] font-['Newsreader']">Loading UX demo...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#091747] mb-4 font-['Newsreader']">
            🎭 Moonlit Scheduler UX Demo
          </h1>
          <p className="text-xl text-[#091747]/70 mb-6 font-['Newsreader']">
            Experience the complete booking flow with real provider data and Athena integration
          </p>
          <div className="bg-[#BF9C73] text-white rounded-xl px-6 py-3 inline-block shadow-sm">
            <span className="font-medium font-['Newsreader']">Demo Mode Active</span>
            <span className="text-xs ml-3 opacity-90">• Using sandbox data</span>
          </div>
        </div>

        {/* Progress Bar */}
        {demoData?.data?.progress && (
          <div className="mb-8 max-w-2xl mx-auto">
            <div className="flex justify-between text-sm text-[#091747]/60 mb-2 font-['Newsreader']">
              <span>Progress</span>
              <span>{demoData.data.progress} of {demoData.data.total_steps} steps</span>
            </div>
            <div className="w-full bg-stone-200 rounded-full h-3">
              <div 
                className="bg-[#BF9C73] h-3 rounded-full transition-all duration-500"
                style={{ width: `${(demoData.data.progress / demoData.data.total_steps) * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 max-w-2xl mx-auto">
            <p className="text-red-700 font-['Newsreader']">❌ {error}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-xl border border-stone-200 p-8 mb-6">
          {/* Step 1: Insurance Selection */}
          {currentStep === 'select_insurance' && demoData && (
            <div>
              <h2 className="text-3xl font-bold text-[#091747] mb-4 font-['Newsreader']">Select Your Insurance</h2>
              <p className="text-xl text-[#091747]/70 mb-8 font-['Newsreader']">{demoData.data.message}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                {demoData.data.payers?.map((payer: Payer) => (
                  <button
                    key={payer.id}
                    onClick={() => handlePayerSelect(payer.id)}
                    className="p-4 text-left border-2 border-stone-200 rounded-xl hover:border-[#BF9C73] hover:bg-[#FEF8F1] transition-all duration-200 font-['Newsreader']"
                  >
                    <span className="font-medium text-[#091747]">{payer.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Booking Options */}
          {currentStep === 'show_booking_options' && demoData && (
            <div>
              <h2 className="text-3xl font-bold text-[#091747] mb-4 font-['Newsreader']">How would you like to book?</h2>
              <p className="text-xl text-[#091747]/70 mb-8 font-['Newsreader']">{demoData.data.message}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {demoData.data.booking_options?.map((option: BookingOption) => (
                  <button
                    key={option.id}
                    onClick={() => handleBookingOptionSelect(option.id as 'by_availability' | 'by_provider')}
                    className={`p-8 border-2 rounded-2xl text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02] ${
                      option.recommended 
                        ? 'border-[#BF9C73] bg-[#FEF8F1]' 
                        : 'border-stone-200 hover:border-[#BF9C73]'
                    }`}
                  >
                    <div className="flex items-start gap-6">
                      <div className={`p-4 rounded-2xl ${
                        option.recommended ? 'bg-[#BF9C73] text-white' : 'bg-stone-100 text-stone-600'
                      }`}>
                        {option.icon === 'calendar' ? <Calendar className="w-8 h-8" /> : <Search className="w-8 h-8" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-xl font-bold text-[#091747] font-['Newsreader']">
                            {option.title}
                          </h3>
                          {option.recommended && (
                            <span className="text-xs bg-[#BF9C73] text-white px-3 py-1 rounded-full font-medium font-['Newsreader']">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[#091747]/70 leading-relaxed font-['Newsreader']">{option.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3A: Merged Availability (Book by Availability) */}
          {currentStep === 'get_merged_availability' && demoData && (
            <div>
              <h2 className="text-3xl font-bold text-[#091747] mb-4 font-['Newsreader']">Available Appointments</h2>
              <p className="text-xl text-[#091747]/70 mb-8 font-['Newsreader']">
                Showing earliest available slots from {demoData.data.total_providers} providers for {selectedDate}
              </p>
              
              {demoData.data.time_slots && demoData.data.time_slots.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {demoData.data.time_slots.slice(0, 9).map((slot: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => handleTimeSlotSelect(slot.time)}
                      className="p-6 border-2 border-stone-200 rounded-xl hover:border-[#BF9C73] hover:bg-[#FEF8F1] hover:shadow-lg transition-all duration-200 text-left"
                    >
                      <div className="font-bold text-lg text-[#091747] font-['Newsreader']">{slot.time}</div>
                      <div className="text-[#091747]/70 font-['Newsreader'] mt-1">
                        Dr. {slot.provider_first_name} {slot.provider_last_name}
                      </div>
                      <div className="text-sm text-[#091747]/50 mt-1 font-['Newsreader']">{slot.provider_role}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                  <p className="text-[#091747]/60 font-['Newsreader'] mb-6">No availability found for this date.</p>
                  <button 
                    onClick={() => fetchDemoStep('show_booking_options')}
                    className="px-6 py-3 bg-[#BF9C73] text-white rounded-xl hover:bg-[#B8936A] transition-colors font-['Newsreader']"
                  >
                    Try Different Date
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3B: Provider List (Book by Practitioner) */}
          {currentStep === 'get_provider_list' && demoData && (
            <div>
              <h2 className="text-3xl font-bold text-[#091747] mb-4 font-['Newsreader']">Choose Your Provider</h2>
              <p className="text-xl text-[#091747]/70 mb-8 font-['Newsreader']">
                {demoData.data.total_providers} providers accept your insurance
              </p>
              
              <div className="space-y-6">
                {demoData.data.providers?.map((provider: Provider) => (
                  <div key={provider.id} className="bg-white border-2 border-stone-200 rounded-2xl p-8 hover:border-[#BF9C73] hover:shadow-lg transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 pr-6">
                        <div className="flex items-center gap-4 mb-4">
                          <div className="w-16 h-16 bg-[#BF9C73] rounded-full flex items-center justify-center text-white font-bold text-xl font-['Newsreader']">
                            {provider.full_name.split(' ').map(n => n.charAt(0)).join('')}
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
                              {provider.full_name}
                            </h3>
                            <p className="text-[#BF9C73] font-medium font-['Newsreader']">{provider.title}</p>
                          </div>
                        </div>
                        
                        <p className="text-[#091747]/70 mb-6 leading-relaxed font-['Newsreader']">{provider.bio}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                          <div>
                            <span className="font-bold text-[#091747] font-['Newsreader']">Specialty:</span>
                            <span className="ml-2 text-[#091747]/70 font-['Newsreader']">{provider.specialty}</span>
                          </div>
                          <div>
                            <span className="font-bold text-[#091747] font-['Newsreader']">Experience:</span>
                            <span className="ml-2 text-[#091747]/70 font-['Newsreader']">{provider.years_experience} years</span>
                          </div>
                          <div>
                            <span className="font-bold text-[#091747] font-['Newsreader']">Languages:</span>
                            <span className="ml-2 text-[#091747]/70 font-['Newsreader']">{provider.languages_spoken.join(', ')}</span>
                          </div>
                          <div>
                            <span className="font-bold text-[#091747] font-['Newsreader']">Pricing:</span>
                            <span className="ml-2 text-[#091747]/70 font-['Newsreader']">{provider.price_range}</span>
                          </div>
                        </div>
                        
                        <div className="flex gap-3">
                          <span className={`px-4 py-2 rounded-full text-sm font-medium font-['Newsreader'] ${
                            provider.new_patient_status.includes('Accepting') 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-stone-100 text-stone-600'
                          }`}>
                            {provider.new_patient_status}
                          </span>
                          <span className="px-4 py-2 rounded-full text-sm font-medium bg-blue-100 text-blue-800 font-['Newsreader']">
                            {provider.telehealth_status}
                          </span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleProviderSelect(provider.id)}
                        className="px-8 py-4 bg-[#BF9C73] text-white rounded-xl hover:bg-[#B8936A] transition-colors font-medium font-['Newsreader'] whitespace-nowrap"
                      >
                        View Availability
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Provider Availability or Booking Preview */}
          {(currentStep === 'get_provider_availability' || currentStep === 'preview_booking') && demoData && (
            <div>
              {currentStep === 'get_provider_availability' ? (
                <div>
                  <h2 className="text-3xl font-bold text-[#091747] mb-4 font-['Newsreader']">
                    {demoData.data.provider?.first_name} {demoData.data.provider?.last_name} - Availability
                  </h2>
                  <p className="text-xl text-[#091747]/70 mb-8 font-['Newsreader']">Select a time slot for {selectedDate}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['9:00 AM', '10:30 AM', '2:00 PM', '3:30 PM', '4:00 PM'].map((time) => (
                      <button
                        key={time}
                        onClick={() => handleTimeSlotSelect(time)}
                        className="p-6 border-2 border-stone-200 rounded-xl hover:border-[#BF9C73] hover:bg-[#FEF8F1] hover:shadow-lg transition-all duration-200 text-center font-['Newsreader']"
                      >
                        <Clock className="w-6 h-6 mx-auto mb-2 text-[#BF9C73]" />
                        <div className="font-bold text-[#091747]">{time}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-3xl font-bold text-[#091747] mb-8 font-['Newsreader']">Confirm Your Appointment</h2>
                  
                  {demoData.data.appointment_preview && (
                    <div className="bg-[#FEF8F1] rounded-2xl p-8 mb-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <h3 className="text-xl font-bold text-[#091747] mb-4 font-['Newsreader']">Appointment Details</h3>
                          <div className="space-y-3">
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-24 font-['Newsreader']">Provider:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.provider.name}</span>
                            </div>
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-24 font-['Newsreader']">Date:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.appointment.date}</span>
                            </div>
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-24 font-['Newsreader']">Time:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.appointment.time}</span>
                            </div>
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-24 font-['Newsreader']">Duration:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.appointment.duration}</span>
                            </div>
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-24 font-['Newsreader']">Type:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.appointment.type}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-xl font-bold text-[#091747] mb-4 font-['Newsreader']">Patient Information</h3>
                          <div className="space-y-3">
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-20 font-['Newsreader']">Name:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.patient.name}</span>
                            </div>
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-20 font-['Newsreader']">Email:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.patient.email}</span>
                            </div>
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-20 font-['Newsreader']">Phone:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.patient.phone}</span>
                            </div>
                            <div className="flex">
                              <span className="font-medium text-[#091747] w-20 font-['Newsreader']">Insurance:</span>
                              <span className="text-[#091747]/70 font-['Newsreader']">{demoData.data.appointment_preview.insurance.name}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-8">
                        <h3 className="text-xl font-bold text-[#091747] mb-4 font-['Newsreader']">What happens next?</h3>
                        <ul className="space-y-2">
                          {demoData.data.appointment_preview.next_steps?.map((step: string, index: number) => (
                            <li key={index} className="flex items-start font-['Newsreader']">
                              <Check className="w-5 h-5 text-[#BF9C73] mr-3 mt-0.5 flex-shrink-0" />
                              <span className="text-[#091747]/70">{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={handleCreateAppointment}
                      className="px-8 py-4 bg-[#17DB4E] text-white rounded-xl hover:bg-[#15C946] transition-colors font-medium font-['Newsreader'] shadow-lg"
                      disabled={loading}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Creating...
                        </div>
                      ) : (
                        'Confirm Appointment'
                      )}
                    </button>
                    <button
                      onClick={handleStartOver}
                      className="px-8 py-4 bg-stone-200 text-[#091747] rounded-xl hover:bg-stone-300 transition-colors font-medium font-['Newsreader']"
                    >
                      Start Over
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Appointment Created */}
          {currentStep === 'create_appointment' && demoData && (
            <div className="text-center">
              {demoData.success ? (
                <div>
                  <div className="text-8xl mb-6">🎉</div>
                  <h2 className="text-3xl font-bold text-[#17DB4E] mb-6 font-['Newsreader']">
                    Appointment Created Successfully!
                  </h2>
                  
                  {demoData.data.integration_status && (
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-8 mb-8 text-left max-w-md mx-auto">
                      <h3 className="text-xl font-bold text-[#091747] mb-4 font-['Newsreader']">Integration Status</h3>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-[#091747] font-['Newsreader']">Local Database:</span>
                          <span className="font-['Newsreader']">{demoData.data.integration_status.local_database}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-[#091747] font-['Newsreader']">Athena EMR:</span>
                          <span className="font-['Newsreader']">{demoData.data.integration_status.athena_emr}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xl text-[#091747]/70 mb-8 font-['Newsreader'] max-w-2xl mx-auto">
                    Your appointment has been successfully created in both our system and the provider's EMR.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="text-8xl mb-6">⚠️</div>
                  <h2 className="text-3xl font-bold text-red-600 mb-6 font-['Newsreader']">
                    Appointment Creation Failed
                  </h2>
                  <p className="text-xl text-[#091747]/70 mb-8 font-['Newsreader']">{demoData.error}</p>
                </div>
              )}
              
              <button
                onClick={handleStartOver}
                className="px-8 py-4 bg-[#BF9C73] text-white rounded-xl hover:bg-[#B8936A] transition-colors font-medium font-['Newsreader'] shadow-lg"
              >
                Start New Demo
              </button>
            </div>
          )}
        </div>

        {/* User Stories Info */}
        {demoData?.user_story && (
          <div className="bg-[#BF9C73]/10 border-2 border-[#BF9C73]/20 rounded-2xl p-6 max-w-2xl mx-auto">
            <h4 className="font-bold text-[#BF9C73] mb-3 font-['Newsreader'] text-lg">🎯 Demonstrating:</h4>
            <p className="text-[#091747] font-['Newsreader'] mb-2">{demoData.user_story}</p>
            {demoData.user_stories && (
              <ul className="space-y-1">
                {demoData.user_stories.map((story: string, index: number) => (
                  <li key={index} className="text-[#091747]/80 font-['Newsreader'] text-sm">• {story}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}