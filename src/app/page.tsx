// src/app/page.tsx
import Link from 'next/link'
import Image from 'next/image'

export default function HomePage() {
  return (
    <div className="bg-[#FEF8F1] min-h-screen">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16">
        <div className="text-left max-w-4xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl text-[#091747] font-['Newsreader'] font-light leading-tight mb-8">
            Psychiatry that takes <span className="relative inline-block px-2 py-1">
              <img
                src="/images/text-stroke-of-color.png"
                alt=""
                className="absolute inset-0 w-full h-full object-contain z-0"
              />
              <span className="text-[#091747] relative z-10">you</span>
            </span> seriously.
          </h1>

          {/* Subtitle - Enhanced */}
          <div className="max-w-3xl mb-8">
            <p className="text-lg sm:text-xl text-[#091747] font-['Newsreader'] leading-relaxed mb-4 font-light">
              Clear availability. Straightforward booking. Care that's thoughtful, evidence-based, and&nbsp;unhurried.
            </p>
            <p className="text-base sm:text-lg text-[#091747]/80 font-['Newsreader'] leading-relaxed mb-8">
              Telehealth serving Utah and Idaho.
            </p>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mb-16">
            <Link
              href="/book-now"
              className="bg-[#BF9C73] hover:bg-[#A8865F] text-white px-6 py-3 rounded-lg font-['Newsreader'] transition-all duration-300 hover:shadow-md text-center focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/30"
              aria-label="Start booking your appointment"
            >
              Book now
            </Link>
            <Link
              href="/book-now"
              className="bg-[#FEF8F1] hover:bg-[#f8f4f0] text-[#BF9C73] px-6 py-3 rounded-lg font-['Newsreader'] border border-[#BF9C73] hover:border-[#A8865F] transition-all duration-300 hover:shadow-md text-center focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/30"
              aria-label="View available practitioners"
            >
              See availability
            </Link>
          </div>
        </div>
      </section>

      {/* Patient Testimonials */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-3">
            What our patients say
          </h2>
          <p className="text-base text-[#091747]/70 font-['Newsreader'] max-w-2xl mx-auto">
            Real experiences from people who found the care they needed
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Testimonial 1 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <Image
                  src="/images/my-notion-face-transparent-md@2x.png"
                  alt="Patient testimonial"
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              </div>
              <div className="flex-1">
                <blockquote className="text-[#091747] font-['Newsreader'] leading-relaxed mb-4 text-base">
                  "I ran out of my medication weeks before I'd be able to see any of my go-to doctors. My Moonlit psychiatrist listened to my situation, and I picked up my refill within hours of realizing I was out, which I expected and hoped for. What I didn't expect was how kind the doctor was."
                </blockquote>
                <cite className="text-[#091747]/60 text-sm font-['Newsreader']">— E.F., patient</cite>
              </div>
            </div>
          </div>

          {/* Testimonial 2 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <Image
                  src="/images/my-notion-face-transparent-(2)-md@2x.png"
                  alt="Patient testimonial"
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              </div>
              <div className="flex-1">
                <blockquote className="text-[#091747] font-['Newsreader'] leading-relaxed mb-4 text-base">
                  "Got the meds I needed weeks sooner than if I'd waited to see my normal doctor. It was fast, but he also listened and cared."
                </blockquote>
                <cite className="text-[#091747]/60 text-sm font-['Newsreader']">— E.S., patient</cite>
              </div>
            </div>
          </div>

          {/* Testimonial 3 */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <Image
                  src="/images/my-notion-face-transparent-(3)-md@2x.png"
                  alt="Patient testimonial"
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              </div>
              <div className="flex-1">
                <blockquote className="text-[#091747] font-['Newsreader'] leading-relaxed mb-4 text-base">
                  "You're kind and personable. Way less robotic than others I've seen."
                </blockquote>
                <cite className="text-[#091747]/60 text-sm font-['Newsreader']">— Anonymous patient</cite>
              </div>
            </div>
          </div>

          {/* Testimonial 4 - Care Manager */}
          <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-300">
            <div className="flex items-start space-x-6">
              <div className="flex-shrink-0">
                <Image
                  src="/images/testimonial-bw.png"
                  alt="Care manager testimonial"
                  width={80}
                  height={80}
                  className="rounded-full"
                />
              </div>
              <div className="flex-1">
                <blockquote className="text-[#091747] font-['Newsreader'] leading-relaxed mb-4 text-base">
                  "Moonlit's overall dedication to patients and quality of care is starting to really show now that we have gotten two or three from the community who were already established with you and concerned that they would be required to change providers when they entered our treatment program. They were all very happy and relieved to know that we work with you guys. I think all of your providers are incredibly compassionate and are wonderful with our clients and you guys all communicate so well (it's been quite refreshing)."
                </blockquote>
                <cite className="text-[#091747]/60 text-sm font-['Newsreader']">— B.W., care manager at a local treatment center</cite>
              </div>
            </div>
          </div>

          {/* Testimonial 5 - Featured Full Width */}
          <div className="lg:col-span-2 lg:max-w-3xl lg:mx-auto">
            <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-shadow duration-300">
              <div className="flex items-start space-x-6">
                <div className="flex-shrink-0">
                  <Image
                    src="/images/testimonial-anne-h.png"
                    alt="Patient testimonial"
                    width={80}
                    height={80}
                    className="rounded-full"
                  />
                </div>
                <div className="flex-1">
                  <blockquote className="text-[#091747] font-['Newsreader'] leading-relaxed mb-4 text-base">
                    "Having been in the care of many behavioral health providers over the last several years, we have not experienced the attention and coordination of care between a psychiatrist and my daughter's therapist. They truly care about ensuring the safety and health of my daughter on her mental health journey."
                  </blockquote>
                  <cite className="text-[#091747]/60 text-sm font-['Newsreader']">— A.H., parent of patient</cite>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Read Our Journal - Off-Label */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-4">
            Read Our Journal
          </h2>
          <p className="text-base text-[#091747]/70 font-['Newsreader'] mb-6 max-w-2xl mx-auto">
            Insights on mental health, psychiatry, and wellness from our doctors. Evidence-based perspectives on the topics that matter most.
          </p>
          <Link
            href="/offlabel"
            className="inline-block bg-[#BF9C73] hover:bg-[#A8865F] text-white px-8 py-4 rounded-xl font-['Newsreader'] transition-all duration-300 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-[#BF9C73]/20"
            aria-label="Read Off-Label, our journal on mental health and psychiatry"
          >
            Explore Off-Label
          </Link>
        </div>
      </section>

      {/* U of U Employee Callout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-[#091747] rounded-2xl p-8 sm:p-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="text-white">
              <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light mb-3">
                Work at the University of Utah?
              </h2>
              <p className="text-white/80 font-['Newsreader'] text-lg max-w-xl">
                We&apos;re in-network with HMHI-BHN — your behavioral health plan. No surprise bills.
              </p>
            </div>
            <Link
              href="/university-of-utah-employees"
              className="inline-flex items-center justify-center bg-[#BF9C73] hover:bg-[#A8865F] text-white px-8 py-4 rounded-lg font-['Newsreader'] text-lg transition-all duration-300 hover:shadow-lg whitespace-nowrap"
            >
              Learn more
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Ways to Pay */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-4">
            Multiple ways to pay
          </h2>
          <p className="text-base text-[#091747]/70 font-['Newsreader'] mb-6 max-w-2xl mx-auto">
            We accept most major insurance plans including HMHI-BHN, Regence, SelectHealth, Medicaid, and more.
          </p>
          <Link
            href="/ways-to-pay"
            className="inline-block bg-[#BF9C73] hover:bg-[#A8865F] text-white px-8 py-4 rounded-xl font-['Newsreader'] transition-all duration-300 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-[#BF9C73]/20"
            aria-label="Learn about payment options and insurance"
          >
            See payment options
          </Link>
        </div>
      </section>

      {/* States We Serve */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-['Newsreader'] font-light text-[#091747] mb-3">
            States we serve
          </h2>
          <p className="text-base text-[#091747]/70 font-['Newsreader'] mb-12 max-w-2xl mx-auto">
            Licensed and available for telehealth appointments
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-12 sm:gap-16">
            <div className="text-center group cursor-default">
              <div className="relative">
                <Image
                  src="/images/utah-icon.png"
                  alt="Utah state outline"
                  width={80}
                  height={100}
                  className="mx-auto mb-4 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <h3 className="text-lg font-['Newsreader'] text-[#091747] mb-1">Utah</h3>
              <p className="text-sm text-[#091747]/60 font-['Newsreader']">All counties served</p>
            </div>
            
            <div className="text-center group cursor-default">
              <div className="relative">
                <Image
                  src="/images/Idaho-icon.png"
                  alt="Idaho state outline"
                  width={64}
                  height={100}
                  className="mx-auto mb-4 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <h3 className="text-lg font-['Newsreader'] text-[#091747] mb-1">Idaho</h3>
              <p className="text-sm text-[#091747]/60 font-['Newsreader']">All counties served</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

