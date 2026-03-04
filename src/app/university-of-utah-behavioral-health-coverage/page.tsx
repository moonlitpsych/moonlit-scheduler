import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import PrintGuideButton from './PrintGuideButton'
import { insuranceCardExamples } from './cardExamples'

const pageUrl = 'https://trymoonlit.com/university-of-utah-behavioral-health-coverage'

const tocSections = [
  { id: 'quick-answer', label: 'Quick answer' },
  { id: 'decision-tree', label: 'Coverage check decision tree' },
  { id: 'what-is-hmhi-bhn', label: 'What is HMHI BHN?' },
  {
    id: 'why-regence-uuhp-different',
    label: 'Why your card says Regence/UUHP but mental health is different',
  },
  { id: 'read-your-card', label: 'How to read your insurance card (examples)' },
  { id: 'confirm-in-network', label: 'How to confirm a provider is in-network' },
  { id: 'common-pitfalls', label: 'Common pitfalls that cause surprise bills' },
  { id: 'surprise-bill', label: 'What to do if you got a surprise bill' },
  { id: 'find-care', label: 'Find care quickly and confidently' },
  { id: 'faq', label: 'FAQ' },
]

const faqItems = [
  {
    question: 'What is HMHI BHN?',
    answer:
      'HMHI BHN stands for Huntsman Mental Health Institute Behavioral Health Network. For many University of Utah employee and dependent plans, behavioral health benefits may be administered through HMHI BHN rather than the medical carrier shown most prominently on the card.',
  },
  {
    question: 'Do I need a referral?',
    answer:
      'Some plans do not require referrals for outpatient mental health, while others may require referral or authorization depending on service type. Confirm your specific plan rules before your first visit.',
  },
  {
    question: 'Are dependents covered?',
    answer:
      'Many U of U employee plans include spouse and dependent behavioral health coverage, including many young adults on family plans. Benefit levels, network rules, and cost-sharing can differ, so verify your individual eligibility.',
  },
  {
    question: 'Is telehealth covered?',
    answer:
      'Telehealth is covered by many plans, but not all services or provider types are handled the same way. Ask whether telehealth outpatient psychiatry or therapy is covered in-network for your plan before your visit.',
  },
  {
    question: 'Why did my therapist say they take my insurance but it did not cover?',
    answer:
      'A common reason is network mismatch: a provider may accept your medical carrier but not the behavioral health network for your plan. Billing entity mismatch can also happen when the individual clinician and group billing NPI do not match credentialing records.',
  },
  {
    question: 'What if my card does not mention HMHI BHN?',
    answer:
      'Card layouts vary. If the wording is missing or unclear, call the member services number on the card and ask who administers outpatient behavioral health for your exact plan, then ask your provider to verify eligibility before the first appointment.',
  },
  {
    question: 'What if I am a student instead of an employee?',
    answer:
      'Student health plans and employee benefits can be administered differently. Do not assume they use the same behavioral health network. Verify your active plan and behavioral health network using your card and eligibility check.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

export const metadata: Metadata = {
  title: 'University of Utah Behavioral Health Coverage Guide | HMHI BHN',
  description:
    'Educational guide for University of Utah employees and dependents on HMHI BHN behavioral health coverage, reading Regence or UUHP cards, and verifying in-network psychiatry and therapy care before your first visit.',
  keywords: [
    'university of utah behavioral health coverage',
    'HMHI BHN',
    'HMHI Behavioral Health Network',
    'Regence mental health network',
    'UUHP mental health coverage',
    'University of Utah employee insurance mental health',
    'avoid surprise behavioral health bills',
  ],
  alternates: {
    canonical: pageUrl,
  },
  openGraph: {
    title: 'University of Utah Behavioral Health Coverage Guide (HMHI BHN)',
    description:
      'Neutral, step-by-step guide to understand carve-out behavioral health coverage and verify in-network care before your first appointment.',
    url: pageUrl,
    siteName: 'Moonlit Psychiatry',
    locale: 'en_US',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'U of U Behavioral Health Coverage Guide',
    description:
      'How to verify HMHI BHN coverage, read your card, and avoid surprise behavioral health bills.',
  },
}

function OnThisPageLinks() {
  return (
    <ul className="space-y-2">
      {tocSections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="text-sm text-[#091747]/80 hover:text-[#091747] hover:underline"
            style={{ fontFamily: 'Newsreader, serif' }}
          >
            {section.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

export default function UniversityOfUtahBehavioralHealthCoveragePage() {
  return (
    <div className="min-h-screen bg-[#FEF8F1]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <div className="coverage-shell mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
        <section className="mb-10 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-4xl">
              <p className="mb-3 text-sm font-medium uppercase tracking-wide text-[#BF9C73]" style={{ fontFamily: 'Newsreader, serif' }}>
                Educational coverage guide
              </p>
              <h1 className="text-3xl font-light leading-tight text-[#091747] sm:text-4xl lg:text-5xl" style={{ fontFamily: 'Newsreader, serif' }}>
                University of Utah behavioral health coverage: how HMHI BHN works
              </h1>
              <p className="mt-4 text-lg text-[#091747]/80" style={{ fontFamily: 'Newsreader, serif' }}>
                This page is a practical source of truth for University of Utah employees and dependents who want to understand their behavioral health coverage before starting care.
              </p>
            </div>
            <PrintGuideButton />
          </div>
          <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-[#091747]/80" style={{ fontFamily: 'Newsreader, serif' }}>
            Coverage details can vary by plan and year. This guide is educational and not legal, medical, or billing advice. Your insurance card and real-time eligibility verification are the best source of truth for your specific benefits.
          </p>
        </section>

        <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="coverage-print-hidden hidden lg:block">
            <div className="sticky top-24 rounded-2xl border border-[#091747]/10 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-lg font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                On this page
              </h2>
              <OnThisPageLinks />
            </div>
          </aside>

          <main className="space-y-8">
            <details className="coverage-print-hidden rounded-xl border border-[#091747]/10 bg-white p-4 lg:hidden">
              <summary className="cursor-pointer text-base font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                On this page
              </summary>
              <div className="mt-3">
                <OnThisPageLinks />
              </div>
            </details>

            <section id="quick-answer" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                Quick answer
              </h2>
              <ul className="space-y-3 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                <li>For many University of Utah employee and dependent plans, mental health benefits may be administered through HMHI BHN, even when the card says Regence or UUHP.</li>
                <li>Being in-network for medical care does not always mean being in-network for outpatient psychiatry or therapy.</li>
                <li>Before your first visit: check your card, look for behavioral health indicators, and ask the provider to confirm eligibility for your exact plan.</li>
                <li>If a provider bills through a group, confirm which billing entity (tax ID and NPI) is credentialed with your behavioral health network.</li>
                <li>When possible, get network confirmation in writing through email or patient portal messages.</li>
              </ul>
            </section>

            <section id="decision-tree" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                Coverage check decision tree
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <article className="rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-4">
                  <h3 className="text-lg font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                    My card says Regence
                  </h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                    <li>Look for HMHI BHN or behavioral health wording.</li>
                    <li>If unclear, call member services on the card.</li>
                    <li>Ask providers if they accept HMHI BHN for outpatient mental health.</li>
                  </ol>
                </article>
                <article className="rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-4">
                  <h3 className="text-lg font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                    My card says UUHP
                  </h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                    <li>Check the back for BHN or mental health indicators.</li>
                    <li>Confirm which network administers behavioral health.</li>
                    <li>Verify your provider is in-network with that behavioral network.</li>
                  </ol>
                </article>
                <article className="rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-4">
                  <h3 className="text-lg font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                    I am not sure
                  </h3>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                    <li>Use the number on the card to confirm behavioral health administrator.</li>
                    <li>Request a pre-visit eligibility check for outpatient mental health.</li>
                    <li>Do not assume coverage until the network match is verified.</li>
                  </ol>
                </article>
              </div>
            </section>

            <section id="what-is-hmhi-bhn" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                What is HMHI BHN?
              </h2>
              <div className="space-y-4 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                <p>
                  HMHI BHN is the Huntsman Mental Health Institute Behavioral Health Network. For many University of Utah employee and dependent plans, outpatient behavioral health coverage may be administered through this network, even when the medical card branding emphasizes Regence or UUHP.
                </p>
                <p>
                  This arrangement is often called a behavioral health carve-out. It means the medical insurer may handle medical claims while a separate behavioral health network manages many psychiatry and therapy claims.
                </p>
                <p>
                  Because plan designs vary, the safest approach is to verify using your insurance card and an eligibility check before your first visit.
                </p>
              </div>
            </section>

            <section id="why-regence-uuhp-different" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                Why your card says Regence/UUHP but mental health is different
              </h2>
              <div className="space-y-4 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                <p>
                  Card branding and claims administration are not always the same thing. The card may prominently show the medical plan while behavioral health is routed through another network.
                </p>
                <p>
                  In practical terms, in-network for medical does not always equal in-network for outpatient behavioral health. This can affect both psychiatry and therapy coverage.
                </p>
                <p>
                  If your card has HMHI BHN or behavioral health network language, ask providers specifically about HMHI BHN participation rather than asking only whether they accept Regence or UUHP.
                </p>
              </div>
            </section>

            <section id="read-your-card" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                How to read your insurance card (examples)
              </h2>
              <p className="mb-6 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                These are de-identified examples. Card layouts can change by year and plan. If HMHI BHN text or logos are missing or unclear, call member services and request the behavioral health network for your exact plan.
              </p>

              <div className="space-y-8">
                {insuranceCardExamples.map((example) => (
                  <article
                    key={example.id}
                    className={`rounded-xl border p-4 sm:p-5 ${
                      example.isWarning
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-[#091747]/10 bg-[#FEF8F1]'
                    }`}
                  >
                    {example.isWarning && (
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-800">
                          Comparison — what the absent indicator looks like
                        </span>
                      </div>
                    )}
                    <h3 className="mb-3 text-xl font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                      {example.title}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
                      <figure className="space-y-3">
                        <div className={`relative overflow-hidden rounded-lg border bg-white ${example.isWarning ? 'border-amber-200' : 'border-[#091747]/15'}`}>
                          <Image
                            src={example.imageSrc}
                            alt={example.alt}
                            width={example.imageWidth}
                            height={example.imageHeight}
                            className="h-auto w-full"
                            sizes="(min-width: 768px) 700px, 100vw"
                          />
                          {example.callouts.map((callout) => (
                            <div
                              key={`${example.id}-pin-${callout.number}`}
                              className={`absolute hidden h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white text-sm font-semibold text-white shadow-md md:flex ${
                                example.isWarning ? 'bg-amber-600' : 'bg-[#091747]'
                              }`}
                              style={{ top: `${callout.top}%`, left: `${callout.left}%` }}
                              aria-hidden
                            >
                              {callout.number}
                            </div>
                          ))}
                        </div>
                        <figcaption className="text-sm text-[#091747]/75" style={{ fontFamily: 'Newsreader, serif' }}>
                          {example.caption}
                        </figcaption>
                      </figure>

                      <div>
                        <h4 className="mb-2 text-base font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                          Callout legend
                        </h4>
                        <ol className="space-y-3" style={{ fontFamily: 'Newsreader, serif' }}>
                          {example.callouts.map((callout) => (
                            <li key={`${example.id}-legend-${callout.number}`} className={`rounded-lg border p-3 ${example.isWarning ? 'border-amber-200 bg-white' : 'border-[#091747]/10 bg-white'}`}>
                              <p className="text-sm font-semibold text-[#091747]">
                                <span className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs text-white ${example.isWarning ? 'bg-amber-600' : 'bg-[#091747]'}`}>
                                  {callout.number}
                                </span>
                                {callout.title}
                              </p>
                              <p className="mt-2 text-sm text-[#091747]/80">{callout.detail}</p>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>

                    {example.isWarning && example.warningNote ? (
                      <div className="mt-4 rounded-lg border border-amber-300 bg-amber-100 p-4">
                        <p className="text-sm font-medium text-amber-900" style={{ fontFamily: 'Newsreader, serif' }}>
                          {example.warningNote}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[#091747]/75" style={{ fontFamily: 'Newsreader, serif' }}>
                        What this implies for {example.cardType} cards: ask whether the provider is in-network with HMHI BHN for outpatient behavioral health, not only whether they accept the medical carrier name shown on the card.
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section id="confirm-in-network" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                How to confirm a provider is in-network
              </h2>
              <p className="mb-4 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                Use this checklist before your first visit to reduce billing surprises:
              </p>
              <ol className="list-decimal space-y-3 pl-5 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                <li>Ask whether the provider is in-network with the behavioral health network listed on your card.</li>
                <li>Ask the office to run eligibility for your specific plan and date of service.</li>
                <li>If the provider bills through a group, verify which billing entity is credentialed.</li>
                <li>Ask for confirmation in writing by email or portal message when possible.</li>
              </ol>

              <div className="mt-6 space-y-3">
                <h3 className="text-lg font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                  Copy/paste scripts
                </h3>
                <div className="rounded-lg border border-[#091747]/15 bg-[#FEF8F1] p-4">
                  <p className="font-mono text-sm text-[#091747]">
                    &quot;Are you in-network with HMHI Behavioral Health Network (HMHI BHN) for outpatient mental health?&quot;
                  </p>
                </div>
                <div className="rounded-lg border border-[#091747]/15 bg-[#FEF8F1] p-4">
                  <p className="font-mono text-sm text-[#091747]">
                    &quot;Can you confirm my benefits via eligibility (271) for my plan before the first visit?&quot;
                  </p>
                </div>
                <div className="rounded-lg border border-[#091747]/15 bg-[#FEF8F1] p-4">
                  <p className="font-mono text-sm text-[#091747]">
                    &quot;If you bill through a group, which tax ID/NPI is credentialed with HMHI BHN?&quot;
                  </p>
                </div>
              </div>
            </section>

            <section id="common-pitfalls" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                Common pitfalls that cause surprise bills
              </h2>
              <div className="space-y-4 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                <p>
                  The two most common failure modes are:
                </p>
                <ul className="list-disc space-y-2 pl-6">
                  <li>Provider says they are in-network with Regence, but they are not in-network with HMHI BHN for behavioral health.</li>
                  <li>The office confirms one clinician, but billing is submitted under a different group entity whose NPI or tax ID is not credentialed the same way.</li>
                </ul>
                <p>
                  Other pitfalls include assuming all dependents on a family plan share identical behavioral health rules, and assuming telehealth and in-person coverage are identical without checking.
                </p>
              </div>
            </section>

            <section id="surprise-bill" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                What to do if you got a surprise bill
              </h2>
              <ol className="list-decimal space-y-3 pl-5 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                <li>Request an itemized bill and the claim status details.</li>
                <li>Confirm which payer and network were used on the submitted claim.</li>
                <li>Ask the provider office to re-bill if the wrong network or billing entity was used.</li>
                <li>Check whether the denial reason references out-of-network or credentialing mismatch.</li>
                <li>If needed, request appeal steps from both the provider office and your plan administrator.</li>
              </ol>
              <p className="mt-4 text-sm text-[#091747]/70" style={{ fontFamily: 'Newsreader, serif' }}>
                This section is general educational information, not legal advice. Billing and appeal rights can vary by plan and circumstance.
              </p>
            </section>

            <section id="find-care" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                Find care quickly and confidently
              </h2>
              <ol className="list-decimal space-y-3 pl-5 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                <li>Start with your card and identify who administers behavioral health coverage for your plan.</li>
                <li>Use your behavioral health network directory, if available through your member portal or support line.</li>
                <li>Try targeted terms like: &quot;HMHI BHN psychiatrist&quot;, &quot;HMHI BHN therapist&quot;, and &quot;Huntsman Behavioral Health Network provider&quot;.</li>
                <li>Ask for first-available appointments and ask if telehealth visits are covered in-network for your specific plan.</li>
                <li>Keep written confirmation of network status before your first appointment.</li>
              </ol>
              <p className="mt-4 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                Moonlit is in-network with HMHI BHN. If helpful, you can start with our standard booking flow here:{' '}
                <Link className="text-[#BF9C73] underline-offset-4 hover:underline" href="/book-now">
                  book an appointment
                </Link>.
              </p>
            </section>

            <section id="faq" className="coverage-section rounded-2xl border border-[#091747]/10 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="mb-4 text-2xl font-light text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                FAQ
              </h2>
              <div className="space-y-3">
                {faqItems.map((item) => (
                  <details key={item.question} className="rounded-lg border border-[#091747]/10 bg-[#FEF8F1] p-4">
                    <summary className="cursor-pointer text-base font-medium text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
                      {item.question}
                    </summary>
                    <p className="mt-3 text-[#091747]/85" style={{ fontFamily: 'Newsreader, serif' }}>
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
