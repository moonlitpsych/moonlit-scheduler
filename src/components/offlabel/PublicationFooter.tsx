import Link from 'next/link'

export function PublicationFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-[#FEF8F1] border-t border-stone-200 mt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Soft CTA */}
        <div className="text-center mb-8">
          <p className="text-[#091747]/80 font-['Newsreader'] text-lg leading-relaxed max-w-2xl mx-auto">
            Rufus Sweeney practices at Moonlit Psychiatry in Salt Lake City.{' '}
            If you&apos;re in Utah and looking for a psychiatrist,{' '}
            <Link
              href="https://booking.trymoonlit.com"
              className="text-[#BF9C73] hover:underline"
            >
              we&apos;re accepting new patients
            </Link>
            .
          </p>
        </div>

        {/* Divider */}
        <div className="border-t border-stone-200 pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between text-sm text-[#091747]/60">
            <p className="font-['Newsreader']">
              &copy; {currentYear} Moonlit Psychiatry. All rights reserved.
            </p>
            <Link
              href="https://booking.trymoonlit.com"
              className="mt-2 sm:mt-0 font-['Newsreader'] hover:text-[#BF9C73] transition-colors"
            >
              booking.trymoonlit.com
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
