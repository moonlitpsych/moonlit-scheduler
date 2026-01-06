'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function PublicationHeader() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-stone-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Wordmark */}
          <Link href="/offlabel" className="flex flex-col">
            <span className="text-2xl font-bold font-['Newsreader'] text-[#091747] tracking-tight">
              Off-Label
            </span>
            <span className="text-xs text-[#091747]/60 font-['Newsreader'] -mt-1">
              A Moonlit Psychiatry Publication
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center space-x-6">
            <Link
              href="https://booking.trymoonlit.com"
              className="flex items-center space-x-1 text-sm text-[#091747]/70 hover:text-[#BF9C73] transition-colors font-['Newsreader']"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Moonlit</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
