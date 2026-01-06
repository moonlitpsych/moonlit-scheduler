'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { usePathname } from 'next/navigation'

export function PublicationHeader() {
  const pathname = usePathname()

  // On article pages, show "Back to Articles" → /offlabel
  // On the main Off-Label page, show "Back to Moonlit" → /
  const isArticlePage = pathname !== '/offlabel' && pathname.startsWith('/offlabel')
  const backLink = isArticlePage ? '/offlabel' : '/'
  const backText = isArticlePage ? 'Back to Articles' : 'Back to Moonlit'

  return (
    <header className="sticky top-0 z-50 bg-[#FEF8F1] border-b border-stone-200">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo + Publication Name (Levels-style branding) */}
          <Link href="/offlabel" className="flex items-center">
            <Image
              src="/images/MOONLIT-LOGO-WITH-TITLE.png"
              alt="Moonlit Psychiatry"
              width={140}
              height={42}
              className="h-8 w-auto"
            />
            <div className="hidden sm:flex items-center ml-3">
              <div className="w-px h-6 bg-[#091747]/20 mr-3" />
              <span className="text-base font-['Newsreader'] font-extralight tracking-widest text-[#091747]/80 uppercase">
                Off-Label
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center">
            <Link
              href={backLink}
              className="flex items-center space-x-1 text-sm text-[#091747]/70 hover:text-[#BF9C73] transition-colors font-['Newsreader']"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{backText}</span>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  )
}
