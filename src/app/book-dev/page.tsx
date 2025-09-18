'use client'

import BookingFlow from '@/components/booking/BookingFlow'
import { BookingIntent } from '@/components/booking/BookingFlow'
import { useSearchParams } from 'next/navigation'

export default function BookDevPage() {
  const searchParams = useSearchParams()
  const intent = (searchParams.get('intent') as BookingIntent) || 'book'

  return <BookingFlow intent={intent} />
}