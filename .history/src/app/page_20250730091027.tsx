// src/app/page.tsx
import BookingFlow from '@/components/booking/BookingFlow'

export default function HomePage() {
  return <BookingFlow />
}

// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Book with Moonlit Psychiatry',
  description: 'Schedule your appointment with Moonlit Psychiatry - HIPAA-compliant online booking',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}