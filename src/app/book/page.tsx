// Production booking page using existing components with Athena integration
'use client'

import BookingFlow from '@/components/booking/BookingFlow'

export default function BookPage() {
  return (
    <div className="min-h-screen">
      <BookingFlow />
    </div>
  )
}