import Link from 'next/link'

export default function UniversityOfUtahEmployeesPage() {
  return (
    <div className="bg-[#FEF8F1] min-h-screen">
      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-12">
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl text-[#091747] font-['Newsreader'] font-light leading-tight mb-6">
            Psychiatry for University of Utah Employees
          </h1>
          <p className="text-xl text-[#091747]/80 font-['Newsreader'] mb-8 max-w-2xl mx-auto">
            We&apos;re in-network with <strong>HMHI-BHN</strong> — your actual behavioral health plan.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/book-widget?payer_id=2db7c014-8674-40bb-b918-88160ffde0a6"
              className="bg-[#BF9C73] hover:bg-[#A8865F] text-white px-8 py-4 rounded-lg font-['Newsreader'] text-lg transition-all duration-300 hover:shadow-md"
            >
              Book now
            </Link>
            <Link
              href="/ways-to-pay"
              className="bg-[#FEF8F1] hover:bg-white text-[#BF9C73] px-8 py-4 rounded-lg font-['Newsreader'] text-lg border border-[#BF9C73] transition-all duration-300 hover:shadow-md"
            >
              Check your coverage
            </Link>
          </div>
        </div>
      </section>

      {/* Education Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-10">
          <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-6">
            Your mental health coverage may not be what you think
          </h2>

          <div className="space-y-4 text-[#091747]/80 font-['Newsreader'] text-lg leading-relaxed">
            <p>
              If you work at the University of Utah, your insurance card probably says <strong>Regence Blue Cross Blue Shield</strong> or <strong>University of Utah Health Plans (UUHP)</strong>.
            </p>
            <p>
              But here&apos;s what most employees don&apos;t realize: the insurance that pays for your mental health appointments is <em>not</em> Regence or UUHP. It is <strong>Huntsman Mental Health Institute Behavioral Health Network (HMHI-BHN)</strong>.
            </p>
            <p>
              This matters because many practices in Salt Lake City accept &quot;Regence&quot; for medical care but <strong>aren&apos;t credentialed with HMHI-BHN</strong> for behavioral health. The result? You show up for your appointment thinking you&apos;re covered, and later receive a surprise bill.
            </p>
          </div>

          <div className="mt-8 p-6 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-green-800 font-['Newsreader'] text-lg">
                <strong>Moonlit Psychiatry is fully credentialed with HMHI-BHN.</strong> When you see us, your visit is covered at your in-network rate—no surprises.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TODO: Revisit "Why U of U employees choose Moonlit" section content */}
      {/* Why Moonlit Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-10 text-center">
          Why U of U employees choose Moonlit
        </h2>

        <div className="grid sm:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747] mb-3">
              Physicians only
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader']">
              Every Moonlit provider is an MD or DO. We believe in offering the deepest level of psychiatric training available.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747] mb-3">
              Evening & weekend appointments
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader']">
              We know your schedule is demanding. That&apos;s why we offer appointments outside standard business hours.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747] mb-3">
              Telehealth across Utah
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader']">
              See us from your office, your home, or anywhere in the state. No commute, no parking, no waiting rooms.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="text-xl font-['Newsreader'] font-medium text-[#091747] mb-3">
              Fast access to care
            </h3>
            <p className="text-[#091747]/70 font-['Newsreader']">
              Most patients are seen within days, not weeks. When you need help, you shouldn&apos;t have to wait.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-[#091747] rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-white mb-4">
            Ready to book?
          </h2>
          <p className="text-white/80 font-['Newsreader'] text-lg mb-8 max-w-xl mx-auto">
            Moonlit Psychiatry is proud to serve the University of Utah community. We accept HMHI-BHN, Regence, and most major insurance plans.
          </p>
          <Link
            href="/book-widget?payer_id=2db7c014-8674-40bb-b918-88160ffde0a6"
            className="inline-block bg-[#BF9C73] hover:bg-[#A8865F] text-white px-10 py-4 rounded-lg font-['Newsreader'] text-lg transition-all duration-300 hover:shadow-lg"
          >
            Book your appointment
          </Link>

          <div className="mt-8 pt-8 border-t border-white/20">
            <p className="text-white/70 font-['Newsreader'] mb-2">Questions about coverage?</p>
            <p className="text-white font-['Newsreader']">
              <a href="mailto:hello@trymoonlit.com" className="hover:underline">hello@trymoonlit.com</a>
              {' · '}
              <a href="tel:+13852462522" className="hover:underline">(385) 246-2522</a>
            </p>
          </div>
        </div>
      </section>

      {/* Location Note */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <p className="text-center text-[#091747]/60 font-['Newsreader'] text-sm">
          Moonlit Psychiatry · 1336 S 1100 E, Salt Lake City, UT 84105 · Minutes from the U of U campus
        </p>
      </section>
    </div>
  )
}
