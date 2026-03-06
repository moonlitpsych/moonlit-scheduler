import type { Metadata } from 'next'
import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import PrintGuideButton from './PrintGuideButton'
import { insuranceCardExamples } from './cardExamples'

/* ─── SEO ────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Will My Psychiatrist Accept My U of U Insurance? | Behavioral Health Coverage Guide',
  description:
    'How to verify a psychiatrist or therapist accepts your University of Utah employee insurance before your first visit — including how Regence, UUHP, and HMHI BHN behavioral health coverage works.',
  keywords: [
    'university of utah behavioral health coverage',
    'HMHI BHN',
    'HMHI Behavioral Health Network',
    'Huntsman Mental Health Institute Behavioral Health Network',
    'Regence mental health network',
    'UUHP behavioral health',
    'U of U employee insurance mental health',
    'avoid surprise behavioral health bills',
    'psychiatrist Salt Lake City',
    'medication management Utah',
    'psychiatrist Utah HMHI BHN',
    'ADHD psychiatrist Salt Lake City',
    'anxiety medication management Utah',
    'depression medication management Salt Lake City',
    'psychiatry clinic Salt Lake City',
    'mental health medication Utah',
    'University of Utah employee psychiatrist',
  ],
  alternates: { canonical: 'https://trymoonlit.com/university-of-utah-bhn-guide' },
  openGraph: {
    title: 'Will My Psychiatrist Accept My U of U Insurance? | Behavioral Health Coverage Guide',
    description: 'How to verify a psychiatrist or therapist accepts your University of Utah employee insurance before your first visit — including how Regence, UUHP, and HMHI BHN behavioral health coverage works.',
    url: 'https://trymoonlit.com/university-of-utah-bhn-guide',
    siteName: 'Moonlit',
    locale: 'en_US',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Will My Psychiatrist Accept My U of U Insurance? | Behavioral Health Coverage Guide',
    description: 'How to verify a psychiatrist or therapist accepts your University of Utah employee insurance before your first visit — including how Regence, UUHP, and HMHI BHN behavioral health coverage works.',
  },
}

/* ─── FAQ data ───────────────────────────────────────────────────────────── */

const faqs: { q: string; a: string; node?: React.ReactNode }[] = [
  {
    q: 'What is HMHI BHN?',
    a: 'HMHI BHN stands for Huntsman Mental Health Institute Behavioral Health Network. For many University of Utah employee and dependent plans, outpatient mental health benefits — including psychiatry and therapy — may be administered through HMHI BHN rather than Regence or UUHP.',
  },
  {
    q: 'Do I need a referral for behavioral health?',
    a: "Many U of U employee plans do not require a referral for outpatient behavioral health. However, some plans or specific service types may require prior authorization. Confirm your plan's rules by calling the behavioral health number on your card before scheduling. Moonlit, a psychiatry clinic in Salt Lake City, does not require referrals for behavioral health visits.",
    node: (
      <>
        Many U of U employee plans do not require a referral for outpatient behavioral health. However, some plans or specific service types may require prior authorization. Confirm your plan&apos;s rules by calling the behavioral health number on your card before scheduling.{' '}
        Moonlit, a psychiatry clinic in Salt Lake City, does not require referrals for behavioral health visits.{' '}
        <Link href="/book-now" className="underline text-[#BF9C73] hover:text-[#a07d55]">
          See when a local psychiatrist is available here.
        </Link>
      </>
    ),
  },
  {
    q: 'Are my dependents covered under the same behavioral health network?',
    a: "Many U of U employee plans include spouse and dependent behavioral health coverage. However, benefit levels, network rules, and cost-sharing can differ from the employee's own coverage. Verify eligibility for each dependent separately before their first visit.",
  },
  {
    q: 'Does Moonlit prescribe and manage psychiatric medication?',
    a: 'Yes. Moonlit is a psychiatry clinic — our physicians specialize in psychiatric medication management for conditions including anxiety, depression, ADHD, and OCD. Unlike therapy-only practices, we can evaluate, prescribe, and adjust medications as part of ongoing care. We are in-network with Regence, UUHP, and HMHI BHN for these services.',
  },
  {
    q: 'Is telehealth covered for behavioral health visits?',
    a: "Telehealth coverage for outpatient psychiatry and therapy is included in many plans, but coverage rules can vary by service type. University of Utah health plans do not network with telehealth-only national providers — all in-network behavioral health providers are local professionals. Your local provider may offer telehealth as an option alongside in-person visits, preserving the care quality and community focus that U of U employee plans are designed around. Confirm with your provider's billing team whether telehealth visits are covered in-network for your specific plan.",
    node: (
      <>
        <span className="block mb-3">Telehealth coverage for outpatient psychiatry and therapy is included in many plans, but coverage rules can vary by service type. University of Utah health plans do not network with telehealth-only national providers — all in-network behavioral health providers are local professionals.</span>
        <span className="block">Your local provider may offer telehealth as an option alongside in-person visits, preserving the care quality and community focus that U of U employee plans are designed around. Confirm with your provider&apos;s billing team whether telehealth visits are covered in-network for your specific plan.</span>
      </>
    ),
  },
  {
    q: "Why did my therapist say they take my insurance but the visit still wasn't covered?",
    a: 'The most common cause is a network mismatch: a provider may be in-network with Regence or UUHP for medical services but not credentialed with HMHI BHN for behavioral health. A secondary cause is a billing entity mismatch — the individual clinician\'s NPI may differ from the group practice NPI that submitted the claim. Always confirm behavioral health network participation specifically, not just the name of the medical carrier.',
  },
  {
    q: "What if my card doesn't mention HMHI BHN anywhere?",
    a: "Card layouts vary by plan year and employer group. If you see no HMHI BHN language, check the back of the card. If it's still unclear, call the member services number and ask: \"Which network administers outpatient behavioral health for my exact plan?\" Then ask your provider to run an eligibility check before your first visit.",
  },
  {
    q: "What if I'm a University of Utah student rather than an employee?",
    a: "Student health plans and employee benefit plans are administered separately. Do not assume they use the same behavioral health network. If you're a student, check your U of U Student Health plan details and confirm which network — if any — administers behavioral health under your plan. Start by visiting studenthealth.utah.edu or calling the Student Health Center directly to ask which network covers outpatient mental health for your specific student plan.",
  },
]

/* ─── FAQ JSON-LD ────────────────────────────────────────────────────────── */

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
}

/* ─── Business JSON-LD ───────────────────────────────────────────────────── */

const businessSchema = {
  '@context': 'https://schema.org',
  '@type': 'MedicalBusiness',
  name: 'Moonlit',
  description:
    'Psychiatry clinic in Salt Lake City, UT, specializing in medication management for anxiety, depression, ADHD, and other mental health conditions. In-network with Regence, UUHP, and HMHI BHN.',
  url: 'https://trymoonlit.com',
  telephone: '+13852462522',
  email: 'hello@trymoonlit.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Salt Lake City',
    addressRegion: 'UT',
    addressCountry: 'US',
  },
  medicalSpecialty: 'Psychiatry',
  availableService: [
    { '@type': 'MedicalTherapy', name: 'Psychiatric Medication Management' },
    { '@type': 'MedicalTherapy', name: 'ADHD Evaluation and Treatment' },
    { '@type': 'MedicalTherapy', name: 'Anxiety Treatment' },
    { '@type': 'MedicalTherapy', name: 'Depression Treatment' },
  ],
  areaServed: [
    { '@type': 'State', name: 'Utah' },
    { '@type': 'State', name: 'Idaho' },
  ],
}

/* ─── TOC ────────────────────────────────────────────────────────────────── */

const sections = [
  { id: 'quick-answer', label: 'Finding mental healthcare for U of U employees and dependents' },
  { id: 'decision-tree', label: 'Coverage check: where to start' },
  { id: 'read-your-card', label: 'How to read your insurance card' },
  { id: 'what-is-hmhi-bhn', label: 'What is HMHI BHN?' },
  { id: 'why-different', label: 'Why Regence/UUHP and mental health differ' },
  { id: 'confirm-in-network', label: 'How to confirm a provider is in-network' },
  { id: 'common-pitfalls', label: 'Common pitfalls that cause surprise bills' },
  { id: 'find-care', label: 'Find care quickly and confidently' },
  { id: 'faq', label: 'Frequently asked questions' },
]

/* ─── Shared tokens ──────────────────────────────────────────────────────── */

const CARD = 'coverage-section rounded-2xl border border-[#091747]/10 bg-white shadow-sm'
const F = { fontFamily: 'Newsreader, serif' }
const BODY = 'text-[#091747]/80 leading-relaxed'

/* ─── Small components ───────────────────────────────────────────────────── */

function TocLinks() {
  return (
    <nav aria-label="Page sections">
      <ol className="space-y-1.5">
        {sections.map(({ id, label }, i) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className="group flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[#091747]/70 transition-colors hover:bg-[#FEF8F1] hover:text-[#091747]"
              style={F}
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#091747]/8 text-xs font-semibold text-[#091747]/40 group-hover:bg-[#BF9C73]/20 group-hover:text-[#BF9C73]">
                {i + 1}
              </span>
              {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function SectionHeader({ eyebrow, id, title }: { eyebrow: string; id: string; title: string }) {
  return (
    <div className="mb-6 border-b border-[#091747]/8 pb-5">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#BF9C73]" style={F}>
        {eyebrow}
      </p>
      <h2 id={id} className="text-2xl font-light leading-snug text-[#091747] sm:text-3xl" style={F}>
        {title}
      </h2>
    </div>
  )
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#091747]/10">
        <svg className="h-3 w-3 text-[#091747]" fill="currentColor" viewBox="0 0 12 12">
          <path d="M10 3L5 8.5 2 5.5l-.7.7 3.7 3.6L10.7 3.7 10 3z" />
        </svg>
      </span>
      <span className={`${BODY} text-base`} style={F}>{children}</span>
    </li>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#BF9C73] text-sm font-semibold text-[#BF9C73]"
        style={F}
      >
        {n}
      </span>
      <span className={`${BODY} pt-0.5 text-base`} style={F}>
        {children}
      </span>
    </li>
  )
}

function Script({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-[#091747]/12 bg-[#FEF8F1] p-4">
      <p className="font-['Newsreader'] text-sm leading-relaxed text-[#091747]">&#8220;{children}&#8221;</p>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function UofUBHNGuidePage() {
  return (
    <div className="min-h-screen bg-[#FEF8F1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />

      <div className="coverage-shell mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="mb-10 rounded-2xl bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BF9C73]" style={F}>
                Educational coverage guide · University of Utah employees &amp; dependents
              </p>
              <h1 className="text-3xl font-light leading-tight text-[#091747] sm:text-4xl lg:text-5xl" style={F}>
                Will this psychiatrist accept my U of U insurance?
              </h1>
              <p className="mt-2 text-lg font-light text-[#091747]/70" style={F}>
                How to verify before your first visit.
              </p>
            </div>
            <PrintGuideButton />
          </div>

          {/* Disclaimer */}
          <p className="mt-6 text-sm italic leading-relaxed text-gray-400" style={F}>
            Coverage details vary by plan and year and can change at open enrollment. This guide is educational and is not legal, medical, or billing advice. Always verify your specific plan benefits directly with your insurance carrier before scheduling care.
          </p>
          <p className="mt-2 text-sm italic text-gray-400" style={F}>
            Last reviewed: March 2026
          </p>
        </header>

        {/* ── Two-column layout ──────────────────────────────────────────── */}
        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">

          {/* Sticky sidebar — desktop */}
          <aside className="coverage-print-hidden hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-[#091747]/10 bg-white p-5 shadow-sm">
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-[#BF9C73]" style={F}>
                On this page
              </p>
              <TocLinks />
            </div>
          </aside>

          <main className="space-y-8">

            {/* Mobile collapsible TOC */}
            <details className="coverage-print-hidden rounded-2xl border border-[#091747]/10 bg-white px-5 py-4 shadow-sm lg:hidden">
              <summary className="cursor-pointer text-sm font-semibold text-[#091747]" style={F}>
                On this page
              </summary>
              <div className="mt-4">
                <TocLinks />
              </div>
            </details>

            {/* 1 ── Quick answer ─────────────────────────────────────────── */}
            <section id="quick-answer" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader eyebrow="Start here" id="quick-answer" title="Finding mental healthcare for U of U employees and dependents" />
              <div className="rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-5 sm:p-6">
                <p className="mb-4 text-base font-medium text-[#091747]" style={F}>
                  Before your first behavioral health appointment:
                </p>
                <ul className="space-y-4">
                  <CheckItem>
                    The name on the front of your card (Regence or UUHP) may not be the network that covers
                    your mental health visits — behavioral health is often administered separately,
                    sometimes through a carve-out network like <strong>HMHI BHN</strong> — meaning behavioral health benefits are administered separately from medical.
                  </CheckItem>
                  <CheckItem>
                    If a therapist or psychiatrist tells you they accept your insurance, confirm by
                    searching for their name in your mental health insurance&apos;s provider
                    directory — <strong>HMHI BHN is a separate network</strong>, and providers
                    who are in-network with your medical carrier (Regence or UUHP) are not
                    automatically in-network with your behavioral health network.
                  </CheckItem>
                  <CheckItem>
                    Before your first visit: confirm which network administers your behavioral
                    health benefits — then verify your provider is in-network with that network
                    specifically, not just your medical carrier.
                  </CheckItem>
                  <CheckItem>
                    If a provider bills through a group practice, confirm which billing entity
                    (tax ID and NPI) is credentialed with your behavioral health network — not
                    just the individual clinician.
                  </CheckItem>
                </ul>
              </div>
            </section>

            {/* 2 ── Decision tree ────────────────────────────────────────── */}
            <section id="decision-tree" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader
                eyebrow="Step 1 — find your starting point"
                id="decision-tree"
                title="Coverage check: where to start"
              />
              <p className={`mb-6 text-base ${BODY}`} style={F}>
                Look at your insurance card now. Which of these describes it?
              </p>
              <div className="grid gap-4 md:grid-cols-3">

                <div className="flex flex-col rounded-xl border-2 border-[#091747]/12 bg-white p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#091747] text-sm font-semibold text-white" style={F}>
                    A
                  </div>
                  <h3 className="mb-4 text-base font-semibold text-[#091747]" style={F}>
                    My card says Regence
                  </h3>
                  <ol className="mt-auto space-y-2.5 text-sm text-[#091747]/80" style={F}>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#BF9C73]">1.</span>
                      Check whether behavioral health is through HMHI BHN (carve-out) or
                      administered directly through Regence — look for a separate behavioral
                      health phone number or HMHI BHN language on the card.
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#BF9C73]">2.</span>
                      If absent or unclear, call member services and ask who manages outpatient
                      behavioral health.
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#BF9C73]">3.</span>
                      Ask your provider: &ldquo;Are you in-network with my behavioral health
                      network for outpatient mental health?&rdquo; — name the network once
                      you&apos;ve identified it.
                    </li>
                  </ol>
                </div>

                <div className="flex flex-col rounded-xl border-2 border-[#091747]/12 bg-white p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#091747] text-sm font-semibold text-white" style={F}>
                    B
                  </div>
                  <h3 className="mb-4 text-base font-semibold text-[#091747]" style={F}>
                    My card says UUHP
                  </h3>
                  <ol className="mt-auto space-y-2.5 text-sm text-[#091747]/80" style={F}>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#BF9C73]">1.</span>
                      Check the back for a separate mental health or HMHI BHN contact line.
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#BF9C73]">2.</span>
                      Confirm which network administers behavioral health for your specific plan.
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-[#BF9C73]">3.</span>
                      Verify your provider is in-network with that behavioral health network —
                      not just with UUHP medical.
                    </li>
                  </ol>
                </div>

                <div className="flex flex-col rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-sm font-semibold text-white" style={F}>
                    ?
                  </div>
                  <h3 className="mb-1 text-base font-semibold text-[#091747]" style={F}>
                    I&apos;m not sure
                  </h3>
                  <p className={`mb-4 text-sm ${BODY}`} style={F}>
                    The card is unclear, missing, or you don&apos;t have it handy.
                  </p>
                  <ol className="mt-auto space-y-2.5 text-sm text-[#091747]/80" style={F}>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-amber-600">1.</span>
                      Log into your HR benefits portal to find your current plan name and ID.
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-amber-600">2.</span>
                      Call the benefits helpline and ask which network covers outpatient mental
                      health for your plan.
                    </li>
                    <li className="flex gap-2">
                      <span className="shrink-0 font-semibold text-amber-600">3.</span>
                      Do not schedule until network status is confirmed — this prevents surprise
                      bills.
                    </li>
                  </ol>
                </div>
              </div>
            </section>

            {/* 3 ── Read your card ──────────────────────────────────────── */}
            <section id="read-your-card" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader
                eyebrow="Card walkthrough"
                id="read-your-card"
                title="How to read your insurance card"
              />
              <p className={`mb-8 text-base ${BODY}`} style={F}>
                Card layouts vary by plan year — use these as a reference for where to look, then
                confirm with your own card.
              </p>

              <div className="space-y-10">
                {insuranceCardExamples.map((ex) => (
                  <article
                    key={ex.id}
                    className={`rounded-2xl border p-5 sm:p-7 ${
                      ex.isWarning
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-[#091747]/10 bg-[#FEF8F1]'
                    }`}
                  >
                    {ex.isWarning && (
                      <div className="mb-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                          Comparison — what the absent indicator looks like
                        </span>
                      </div>
                    )}

                    <h3 className="mb-5 text-xl font-medium text-[#091747]" style={F}>
                      {ex.title}
                    </h3>

                    <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                      <figure className="flex flex-col gap-3">
                        <div className={`relative overflow-hidden rounded-xl border bg-white ${ex.isWarning ? 'border-amber-200' : 'border-[#091747]/12'}`}>
                          <Image
                            src={ex.imageSrc}
                            alt={ex.alt}
                            width={ex.imageWidth}
                            height={ex.imageHeight}
                            className="h-auto w-full"
                            sizes="(min-width: 768px) 660px, 100vw"
                          />
                          {ex.callouts.map((c) => (
                            <div
                              key={`${ex.id}-pin-${c.number}`}
                              aria-hidden
                              className="absolute hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-sm font-bold shadow-lg md:flex"
                              style={{
                                top: `${c.top}%`,
                                left: `${c.left}%`,
                                backgroundColor: ex.isWarning ? 'rgba(245,158,11,0.7)' : 'rgba(191,156,115,0.7)',
                                color: '#fff',
                                borderColor: ex.isWarning ? 'rgba(245,158,11,0.9)' : 'rgba(191,156,115,0.9)',
                              }}
                            >
                              {c.number}
                            </div>
                          ))}
                        </div>
                        <figcaption className={`text-sm italic ${BODY}`} style={F}>
                          {ex.caption}
                        </figcaption>
                      </figure>

                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#BF9C73]" style={F}>
                          Callout legend
                        </p>
                        <ol className="space-y-3">
                          {ex.callouts.map((c) => (
                            <li
                              key={`${ex.id}-legend-${c.number}`}
                              className={`rounded-xl border p-3.5 ${
                                ex.isWarning ? 'border-amber-200 bg-white' : 'border-[#091747]/10 bg-white'
                              }`}
                            >
                              <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[#091747]" style={F}>
                                <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${ex.isWarning ? 'bg-amber-500' : 'bg-[#091747]'}`}>
                                  {c.number}
                                </span>
                                {c.title}
                              </p>
                              <p className={`pl-8 text-sm ${BODY}`} style={F}>{c.detail}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    {ex.isWarning && ex.warningNote && (
                      <div className="mt-6 flex gap-3 rounded-xl border border-amber-300 bg-amber-100 p-4">
                        <svg aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        <p className="text-sm font-medium leading-relaxed text-amber-900" style={F}>
                          {ex.warningNote}
                        </p>
                      </div>
                    )}

                    {ex.backSide && (
                      <div className="mt-8 border-t border-[#091747]/10 pt-8">
                        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#BF9C73]" style={F}>
                          Card back
                        </p>
                        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
                          <figure className="flex flex-col gap-3">
                            <div className="relative overflow-hidden rounded-xl border border-[#091747]/12 bg-white">
                              <Image
                                src={ex.backSide.imageSrc}
                                alt={ex.backSide.alt}
                                width={ex.backSide.imageWidth}
                                height={ex.backSide.imageHeight}
                                className="h-auto w-full"
                                sizes="(min-width: 768px) 660px, 100vw"
                              />
                              {ex.backSide.callouts.map((c) => (
                                <div
                                  key={`${ex.id}-back-pin-${c.number}`}
                                  aria-hidden
                                  className="absolute hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-sm font-bold shadow-lg md:flex"
                                  style={{
                                    top: `${c.top}%`,
                                    left: `${c.left}%`,
                                    backgroundColor: 'rgba(191,156,115,0.7)',
                                    color: '#fff',
                                    borderColor: 'rgba(191,156,115,0.9)',
                                  }}
                                >
                                  {c.number}
                                </div>
                              ))}
                            </div>
                            <figcaption className={`text-sm italic ${BODY}`} style={F}>
                              {ex.backSide.caption}
                            </figcaption>
                          </figure>

                          <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#BF9C73]" style={F}>
                              Callout legend
                            </p>
                            <ol className="space-y-3">
                              {ex.backSide.callouts.map((c) => (
                                <li
                                  key={`${ex.id}-back-legend-${c.number}`}
                                  className="rounded-xl border border-[#091747]/10 bg-white p-3.5"
                                >
                                  <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[#091747]" style={F}>
                                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#091747] text-xs font-bold text-white">
                                      {c.number}
                                    </span>
                                    {c.title}
                                  </p>
                                  <p className={`pl-8 text-sm ${BODY}`} style={F}>{c.detail}</p>
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {/* 4 ── What is HMHI BHN ─────────────────────────────────────── */}
            <section id="what-is-hmhi-bhn" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader eyebrow="Background" id="what-is-hmhi-bhn" title="What is HMHI BHN?" />
              <div className="space-y-5">
                <p className={`text-base ${BODY}`} style={F}>
                  <strong className="text-[#091747]">HMHI BHN</strong> —{' '}
                  <strong className="text-[#091747]">
                    the Huntsman Mental Health Institute Behavioral Health Network
                  </strong>{' '}
                  — is the most common reason verifying behavioral health coverage is more complex
                  than it sounds for U of U employees. For many plans, outpatient behavioral
                  health coverage — including psychiatry appointments, therapy, and related mental
                  health services — may be administered through this network, even when the front of
                  your insurance card emphasizes a different carrier name.
                </p>
                <p className={`text-base ${BODY}`} style={F}>
                  This arrangement is commonly called a{' '}
                  <strong className="text-[#091747]">behavioral health carve-out</strong>. The
                  insurer listed on your card may handle medical claims (doctor visits, prescriptions,
                  hospital stays) while a separate behavioral health network — HMHI BHN — manages
                  many outpatient psychiatry and therapy claims.
                </p>
              </div>
            </section>

            {/* 5 ── Why different ───────────────────────────────────────── */}
            <section id="why-different" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader
                eyebrow="The core concept"
                id="why-different"
                title="Why your card says Regence or UUHP but mental health may be different"
              />
              <div className="space-y-5">
                <p className={`text-base ${BODY}`} style={F}>
                  Card branding and claims administration are not always the same thing. The name
                  and logo on the front of your card identify the <em>medical</em> insurer — the
                  entity that processes claims for primary care, urgent care, and hospital stays.
                  Behavioral health claims may be processed separately.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-5">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#BF9C73]" style={F}>
                      In-network for medical means
                    </p>
                    <p className={`text-sm ${BODY}`} style={F}>
                      A provider is contracted with Regence or UUHP to deliver medical services
                      at in-network rates — office visits, labs, and procedures.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-5">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#BF9C73]" style={F}>
                      In-network for behavioral health means
                    </p>
                    <p className={`text-sm ${BODY}`} style={F}>
                      A provider is credentialed specifically with the behavioral health network
                      for your plan — which may be HMHI BHN or your medical carrier directly —
                      to deliver outpatient psychiatric and therapy services.
                    </p>
                  </div>
                </div>
                <p className={`text-base ${BODY}`} style={F}>
                  In practice: a psychiatry practice can be in-network with Regence for medical
                  services while simultaneously being out-of-network for behavioral health under
                  HMHI BHN. The fix is to ask specifically about HMHI BHN participation — not just
                  whether the provider &ldquo;accepts Regence.&rdquo;
                </p>
              </div>
            </section>

            {/* 6 ── Confirm in-network ──────────────────────────────────── */}
            <section id="confirm-in-network" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader
                eyebrow="Before you schedule"
                id="confirm-in-network"
                title="How to confirm a provider is in-network"
              />
              <p className={`mb-6 text-base ${BODY}`} style={F}>
                Before your first visit:
              </p>
              <ol className="mb-8 space-y-4">
                <Step n={1}>
                  Ask the provider&apos;s office: &ldquo;Are you in-network with my behavioral
                  health network for outpatient mental health?&rdquo; — not just &ldquo;Do you
                  take Regence?&rdquo; If your plan uses HMHI BHN, ask by name: &ldquo;Are you
                  in-network with HMHI BHN specifically?&rdquo;
                </Step>
                <Step n={2}>
                  Ask the office to run an eligibility check for your plan before your appointment.
                </Step>
                <Step n={3}>
                  If the provider bills through a group practice, ask: &ldquo;Which billing entity
                  — which tax ID and NPI — will be used on my claim?&rdquo; Verify that entity is
                  credentialed with HMHI BHN.
                </Step>
                <Step n={4}>
                  Request confirmation in writing — an email or a message through the patient
                  portal.
                </Step>
              </ol>

              <div className="border-t border-[#091747]/10 pt-6">
                <p className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#BF9C73]" style={F}>
                  Scripts you may copy/paste for your convenience
                </p>
                <div className="space-y-3">
                  <Script>
                    Which network covers my behavioral health, and are you in-network with that network for outpatient mental health?
                  </Script>
                  <Script>
                    Are you in-network with HMHI Behavioral Health Network (HMHI BHN) for outpatient mental health?
                  </Script>
                  <Script>
                    If you bill through a group, which tax ID/NPI is credentialed with HMHI BHN?
                  </Script>
                </div>
              </div>
            </section>

            {/* 7 ── Common pitfalls ─────────────────────────────────────── */}
            <section id="common-pitfalls" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader
                eyebrow="What goes wrong"
                id="common-pitfalls"
                title="Common pitfalls that cause surprise bills"
              />
              <div className="space-y-5">
                <p className={`text-base ${BODY}`} style={F}>
                  Most surprise bills for U of U employees seeking behavioral health care come from
                  one of these four scenarios:
                </p>
                <div className="space-y-3">
                  {[
                    {
                      title: 'Network mismatch',
                      body: 'The provider is in-network with Regence or UUHP for medical care but is not credentialed with HMHI BHN for behavioral health. The patient is told "we take your insurance" — technically accurate for medical, but irrelevant for the behavioral health carve-out.',
                    },
                    {
                      title: 'Billing entity mismatch',
                      body: 'The individual clinician is credentialed with HMHI BHN, but the claim is submitted under a group practice NPI or tax ID that is not credentialed. The individual is in-network; the billing entity is not.',
                    },
                    {
                      title: 'Dependent plan differences',
                      body: 'A spouse or dependent is on a plan with different behavioral health rules. Benefits confirmed for the employee may not apply identically to dependents.',
                    },
                    {
                      title: 'Telehealth vs. in-person assumption',
                      body: 'Some plans cover telehealth behavioral health visits differently than in-person visits. Confirming in-person coverage does not automatically confirm telehealth coverage.',
                    },
                  ].map(({ title, body }) => (
                    <div
                      key={title}
                      className="flex gap-4 rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-4 sm:p-5"
                    >
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#091747]/12">
                        <svg className="h-3.5 w-3.5 text-[#091747]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
                        </svg>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-[#091747]" style={F}>{title}</p>
                        <p className={`text-sm ${BODY}`} style={F}>{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 8 ── Find care ───────────────────────────────────────────── */}
            <section id="find-care" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader
                eyebrow="Next steps"
                id="find-care"
                title="Find care quickly and confidently"
              />
              <ol className="mb-8 space-y-4">
                <Step n={1}>
                  Start with your card. Identify who administers behavioral health coverage for
                  your plan — the HMHI BHN indicator or the behavioral health phone line is your
                  key signal.
                </Step>
                <Step n={2}>
                  Use your behavioral health network directory. Access it through your member
                  portal or by calling the behavioral health number on your card.
                </Step>
                <Step n={3}>
                  Use targeted search terms: &ldquo;HMHI BHN psychiatrist,&rdquo; &ldquo;HMHI BHN
                  therapist,&rdquo; and &ldquo;Huntsman Behavioral Health Network provider.&rdquo;
                  General searches for &ldquo;Regence psychiatrist&rdquo; may return providers
                  who are medical-only, not behavioral-health credentialed.
                </Step>
                <Step n={4}>
                  If you prefer telehealth, ask your local in-network provider whether they offer
                  remote visits — many do. Coverage for telehealth visits may differ from
                  in-person, so confirm with the billing team.
                </Step>
              </ol>
              <div className="rounded-xl border border-[#091747]/12 bg-[#FEF8F1] p-5 sm:p-6 space-y-3">
                <p className={`text-base ${BODY}`} style={F}>
                  Moonlit is in-network with Regence, UUHP, and HMHI BHN. We are currently
                  accepting new patients, including children and adolescents. If you&apos;d like to
                  establish care with a psychiatrist,{' '}
                  <Link
                    href="/book-now"
                    className="font-medium text-[#BF9C73] underline-offset-4 hover:underline"
                  >
                    book an appointment →
                  </Link>
                </p>
                <p className={`text-sm ${BODY}`} style={F}>
                  Reach out with any questions:{' '}
                  <a href="mailto:hello@trymoonlit.com" className="font-medium text-[#BF9C73] underline-offset-4 hover:underline">
                    hello@trymoonlit.com
                  </a>
                  ,{' '}
                  <a href="tel:+13852462522" className="font-medium text-[#BF9C73] underline-offset-4 hover:underline">
                    (385) 246-2522
                  </a>
                </p>
              </div>
            </section>

            {/* 10 ── FAQ ────────────────────────────────────────────────── */}
            <section id="faq" className={`${CARD} px-6 py-8 sm:px-10`}>
              <SectionHeader
                eyebrow="Common questions"
                id="faq"
                title="Frequently asked questions"
              />
              <div className="space-y-3">
                {faqs.map(({ q, a, node }) => (
                  <details
                    key={q}
                    className="group rounded-xl border border-[#091747]/10 bg-[#FEF8F1]"
                  >
                    <summary
                      className="flex cursor-pointer list-none items-start justify-between gap-4 p-5"
                      style={F}
                    >
                      <span className="text-base font-medium text-[#091747]">{q}</span>
                      <svg
                        aria-hidden
                        className="mt-0.5 h-5 w-5 shrink-0 text-[#BF9C73] transition-transform group-open:rotate-180"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="border-t border-[#091747]/8 px-5 pb-5 pt-4">
                      <p className={`text-base ${BODY}`} style={F}>{node ?? a}</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>

            {/* CTA repeat ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-[#091747]/12 bg-[#FEF8F1] p-5 sm:p-6 space-y-3">
              <p className={`text-base ${BODY}`} style={F}>
                Moonlit is in-network with Regence, UUHP, and HMHI BHN. We are currently
                accepting new patients, including children and adolescents. If you&apos;d like to
                establish care with a psychiatrist,{' '}
                <Link
                  href="/book-now"
                  className="font-medium text-[#BF9C73] underline-offset-4 hover:underline"
                >
                  book an appointment →
                </Link>
              </p>
              <p className={`text-sm ${BODY}`} style={F}>
                Reach out with any questions:{' '}
                <a href="mailto:hello@trymoonlit.com" className="font-medium text-[#BF9C73] underline-offset-4 hover:underline">
                  hello@trymoonlit.com
                </a>
                ,{' '}
                <a href="tel:+13852462522" className="font-medium text-[#BF9C73] underline-offset-4 hover:underline">
                  (385) 246-2522
                </a>
              </p>
            </div>

          </main>
        </div>
      </div>
    </div>
  )
}
