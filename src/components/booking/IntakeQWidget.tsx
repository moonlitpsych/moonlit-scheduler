'use client'

import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    intakeq?: string
    intakeqLocationId?: number
  }
}

interface IntakeQWidgetProps {
  /**
   * IntakeQ location ID - varies by payer/scenario
   * Examples:
   * - 1: Out-of-pocket pay (UT)
   * - 5: Housed Medicaid (ID)
   * - 6: Unhoused Medicaid (ID)
   * - 7: SelectHealth (UT)
   * - 8: HMHI BHN (UT)
   */
  locationId: string | number

  /**
   * IntakeQ account ID (constant across all locations)
   * Default: 673cd162794661bc66f3cad1 (Moonlit account)
   */
  accountId?: string

  /**
   * Optional CSS class for the container
   */
  className?: string

  /**
   * Optional styles for the container
   */
  style?: React.CSSProperties
}

/**
 * IntakeQWidget - Embeds the IntakeQ booking widget with specific location
 *
 * This component dynamically injects the IntakeQ widget script and configures
 * it for a specific payer/location. Used in the /book-now flow where patients
 * select their insurance, then see the appropriate IntakeQ booking widget.
 *
 * @example
 * ```tsx
 * // Show SelectHealth booking widget (locationId=7)
 * <IntakeQWidget locationId="7" />
 *
 * // Show HMHI BHN booking widget (locationId=8)
 * <IntakeQWidget locationId={8} />
 * ```
 */
export default function IntakeQWidget({
  locationId,
  accountId = '673cd162794661bc66f3cad1',
  className = '',
  style = {}
}: IntakeQWidgetProps) {
  const scriptInjectedRef = useRef(false)
  const widgetContainerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)

    // Find and completely clear ALL IntakeQ widget containers
    const allIntakeqContainers = document.querySelectorAll('#intakeq')
    allIntakeqContainers.forEach(container => {
      container.innerHTML = ''
    })

    // Always update the globals when locationId changes
    window.intakeq = accountId
    window.intakeqLocationId = typeof locationId === 'string' ? parseInt(locationId, 10) : locationId

    console.log(`🔧 IntakeQ configuration updated:`, {
      accountId: window.intakeq,
      locationId: window.intakeqLocationId
    })

    // Remove ALL existing IntakeQ scripts
    const existingScripts = document.querySelectorAll('script[src*="intakeq.com/js/widget.min.js"]')
    existingScripts.forEach(script => script.remove())

    // Wait a moment for cleanup before injecting new script
    const cleanupTimer = setTimeout(() => {
      // Inject fresh script
      const script = document.createElement('script')
      script.type = 'text/javascript'
      script.async = true
      script.src = `https://intakeq.com/js/widget.min.js?t=${Date.now()}` // Cache bust

      script.onload = () => {
        console.log(`✅ IntakeQ widget loaded for locationId=${window.intakeqLocationId}`)
        scriptInjectedRef.current = true
        // Give the widget a moment to render before hiding loading
        setTimeout(() => setIsLoading(false), 800)
      }

      script.onerror = () => {
        console.error('❌ Failed to load IntakeQ widget script')
        setIsLoading(false)
        setHasError(true)
      }

      document.head.appendChild(script)
    }, 100)

    // Cleanup function
    return () => {
      clearTimeout(cleanupTimer)
      // Clear widget containers on unmount
      const containers = document.querySelectorAll('#intakeq')
      containers.forEach(container => {
        container.innerHTML = ''
      })
    }
  }, [locationId, accountId])

  // Default container styling to match IntakeQ embed requirements
  const defaultStyle: React.CSSProperties = {
    maxWidth: '720px',
    width: '100%',
    ...style
  }

  return (
    <div
      ref={widgetContainerRef}
      className={`mx-auto ${className}`}
      style={defaultStyle}
    >
      {/* Loading indicator */}
      {isLoading && !hasError && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#BF9C73]"></div>
          <p className="mt-4 text-gray-600">Loading booking form...</p>
        </div>
      )}

      {/* Error state */}
      {hasError && (
        <div className="text-center py-12 px-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-['Newsreader'] text-[#091747] mb-3">
            Unable to Load Booking Form
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            We're having trouble loading the booking form. Please contact us directly to schedule your appointment.
          </p>
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Email: <a href="mailto:hello@trymoonlit.com" className="text-[#BF9C73] hover:underline font-medium">hello@trymoonlit.com</a>
            </p>
            <p className="text-sm text-gray-700">
              Phone: <a href="tel:+13852462522" className="text-[#BF9C73] hover:underline font-medium">(385) 246-2522</a>
            </p>
          </div>
        </div>
      )}

      {/* IntakeQ widget will inject itself into this div */}
      {!hasError && (
        <div
          id="intakeq"
          style={{
            maxWidth: '720px',
            width: '100%',
            opacity: isLoading ? 0 : 1,
            transition: 'opacity 0.3s ease-in'
          }}
        ></div>
      )}
    </div>
  )
}
