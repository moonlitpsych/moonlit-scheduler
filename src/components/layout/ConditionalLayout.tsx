'use client'

import { usePathname } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Hide public header/footer for partner dashboard routes
  const isPartnerRoute = pathname?.startsWith('/partner-dashboard') || pathname?.startsWith('/partner-auth')

  if (isPartnerRoute) {
    return <>{children}</>
  }

  return (
    <>
      <Header />
      <main className="flex-grow pt-16">
        {children}
      </main>
      <Footer />
    </>
  )
}
