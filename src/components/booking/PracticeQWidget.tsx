'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'

declare global {
  interface Window {
    intakeq?: string
    intakeqGroupId?: string
  }
}

type State = 'utah' | 'idaho' | null

export default function PracticeQWidget() {
  const scriptInjectedRef = useRef(false)
  const [selectedState, setSelectedState] = useState<State>(null)

  useEffect(() => {
    // Only inject script after state is selected
    if (!selectedState) {
      return
    }

    // Prevent duplicate injection
    if (scriptInjectedRef.current) {
      return
    }

    // Check if script already exists in DOM
    const existingScript = document.querySelector('script[src*="intakeq.com/js/widget.min.js"]')
    if (existingScript && window.intakeq) {
      scriptInjectedRef.current = true
      return
    }

    // Set IntakeQ configuration based on selected state
    window.intakeq = '673cd162794661bc66f3cad1'
    window.intakeqGroupId = selectedState === 'utah' ? '1' : '2'

    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.async = true
    script.src = 'https://intakeq.com/js/widget.min.js?1'

    script.onload = () => {
      console.log(`✅ IntakeQ widget loaded for ${selectedState.toUpperCase()}`)
    }

    script.onerror = () => {
      console.error('❌ Failed to load IntakeQ widget script')
    }

    document.head.appendChild(script)
    scriptInjectedRef.current = true
  }, [selectedState])

  // State selection UI
  if (!selectedState) {
    return (
      <div className="mx-auto text-center" style={{ maxWidth: 720, width: '100%' }}>
        <h3 className="text-2xl font-['Newsreader'] text-[#091747] mb-6">
          Select your state:
        </h3>

        <div className="flex justify-center gap-8">
          {/* Utah Option */}
          <button
            onClick={() => setSelectedState('utah')}
            className="group flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-transparent hover:border-[#BF9C73] hover:bg-[#FEF8F1] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#BF9C73]/20"
            aria-label="Select Utah"
          >
            <Image
              src="/images/utah-icon.png"
              alt="Utah"
              width={120}
              height={120}
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-lg font-['Newsreader'] text-[#091747] font-medium">
              Utah
            </span>
          </button>

          {/* Idaho Option */}
          <button
            onClick={() => setSelectedState('idaho')}
            className="group flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-transparent hover:border-[#BF9C73] hover:bg-[#FEF8F1] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#BF9C73]/20"
            aria-label="Select Idaho"
          >
            <Image
              src="/images/Idaho-icon.png"
              alt="Idaho"
              width={120}
              height={120}
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-lg font-['Newsreader'] text-[#091747] font-medium">
              Idaho
            </span>
          </button>
        </div>
      </div>
    )
  }

  // Widget container (shown after state selection)
  return (
    <div className="mx-auto" style={{ maxWidth: 720, width: '100%' }}>
      <div id="intakeq" style={{ maxWidth: 720, width: '100%' }}></div>
    </div>
  )
}
