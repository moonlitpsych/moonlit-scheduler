// Production booking page using existing components with Athena integration
'use client'

import BookingFlow from '@/components/booking/BookingFlow'
import { useSearchParams } from 'next/navigation'

export default function BookPage() {
  const searchParams = useSearchParams()
  const intent = searchParams.get('intent') as 'book' | 'explore' | null
  
  return (
    <div className="min-h-screen">
      <BookingFlow intent={intent || 'book'} />
    </div>
  )
}