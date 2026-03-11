import type { Metadata } from 'next'
import Link from 'next/link'

/* ─── SEO ────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Have United Healthcare? Your Mental Health Is Probably Through Optum | Moonlit Psychiatry',
  description:
    'In Utah, United Healthcare carves out behavioral health benefits to Optum Commercial. A provider credentialed with UHC Medical is not automatically credentialed with Optum Commercial BH — they are separate networks. Here\'s how to check your coverage before your first visit.',
  keywords: [
    'united healthcare mental health utah',
    'UHC behavioral health carve-out utah',
    'optum commercial behavioral health',
    'optum psychiatric coverage utah',
    'optum commercial psychiatrist salt lake city',
    'united healthcare psychiatrist salt lake city',
  ],
  alternates: { canonical: 'https://trymoonlit.com/united-healthcare-mental-health-coverage' },
  openGraph: {
    title: 'Have United Healthcare? Your Mental Health Is Probably Through Optum | Moonlit Psychiatry',
    description:
      'In Utah, United Healthcare carves out behavioral health benefits to Optum Commercial. Here\'s what that means and how to verify your coverage.',
    url: 'https://trymoonlit.com/united-healthcare-mental-health-coverage',
    siteName: 'Moonlit',
    locale: 'en_US',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Have United Healthcare? Your Mental Health Is Probably Through Optum | Moonlit Psychiatry',
    description:
      'UHC carves out behavioral health to Optum Commercial in Utah. Here\'s how to check before your first visit.',
  },
}

/* ─── JSON-LD ────────────────────────────────────────────────────────────── */

const businessSchema = {
  '@context': 'https://schema.org',
  '@type': 'MedicalBusiness',
  name: 'Moonlit',
  description:
    'Psychiatry clinic in Salt Lake City, UT, specializing in medication management for anxiety, depression, ADHD, and other mental health conditions. In-network with Optum Commercial Behavioral Health, Regence, HMHI BHN, and more.',
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

/* ─── Design tokens ──────────────────────────────────────────────────────── */

const F = { fontFamily: 'Newsreader, serif' }
const BODY = 'text-[#091747]/80 leading-relaxed'

/* ─── Local components ───────────────────────────────────────────────────── */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-[#BF9C73] text-sm font-semibold text-[#BF9C73]"
        style={F}
      >
        {n}
      </span>
      <span className={`${BODY} pt-0.5 text-base`} style={F}>
        <strong className="font-semibold text-[#091747]">{title}</strong>{' '}
        {children}
      </span>
    </li>
  )
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function UnitedHealthcareMentalHealthCoveragePage() {
  return (
    <div className="min-h-screen bg-[#FEF8F1]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(businessSchema) }}
      />

      <div className="mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <header className="mb-10 rounded-2xl bg-white px-6 py-10 shadow-sm sm:px-10">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[#BF9C73]" style={F}>
            United Healthcare &amp; behavioral health coverage
          </p>
          <h1 className="text-3xl font-light leading-tight text-[#091747] sm:text-4xl lg:text-[2.625rem]" style={F}>
            Have United Healthcare? Your mental health coverage is probably through Optum.
          </h1>
          <p className="mt-4 text-lg font-light leading-relaxed text-[#091747]/70" style={F}>
            In Utah, United Healthcare almost always carves out behavioral health to Optum Commercial. The name on your card doesn&apos;t determine who covers psychiatry — the number on the back does.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-xl bg-[#091747] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#0d1f5c]"
              style={F}
            >
              Book with Optum Commercial
            </Link>
            <Link
              href="/ways-to-pay"
              className="text-sm text-[#091747]/60 underline underline-offset-2 hover:text-[#091747] sm:ml-2"
              style={F}
            >
              See all insurance we accept &rarr;
            </Link>
          </div>
        </header>

        {/* ── Why this keeps happening ───────────────────────────────────── */}
        <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 sm:px-8">
          <h2 className="mb-4 text-xl font-semibold text-[#091747]" style={F}>
            Why your card says &ldquo;United&rdquo; but your psychiatry claim routes somewhere else
          </h2>
          <p className={`${BODY} mb-3 text-base`} style={F}>
            United Healthcare carves out behavioral health administration to Optum. This means that while UHC handles your medical benefits — doctor visits, labs, urgent care — a separate company, Optum Commercial Behavioral Health, manages your mental health and psychiatry coverage.
          </p>
          <p className={`${BODY} text-base`} style={F}>
            A provider credentialed with United Healthcare Medical is <strong className="font-semibold text-[#091747]">not</strong> automatically credentialed with Optum Commercial Behavioral Health. They are entirely separate credentialing processes. When a provider says &ldquo;we take United,&rdquo; they may mean UHC Medical only — and have no relationship with Optum Commercial BH at all.
          </p>
        </section>

        {/* ── Two-network split ─────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl bg-white px-6 py-8 shadow-sm sm:px-8">
          <h2 className="mb-2 text-xl font-semibold text-[#091747]" style={F}>
            The two-network split
          </h2>
          <p className={`${BODY} mb-6 text-base`} style={F}>
            Most UHC members in Utah have both networks. Here&apos;s what each one covers.
          </p>

          {/* Side-by-side cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Medical card */}
            <div className="rounded-xl bg-[#091747] p-5 text-white">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BF9C73]" style={F}>
                United Healthcare (Medical)
              </p>
              <p className="mb-4 text-lg font-light" style={F}>Your general health coverage</p>
              <ul className="space-y-2 text-sm text-white/80" style={F}>
                <li>Doctor visits, labs, urgent care, ER</li>
                <li>The &ldquo;UHC&rdquo; name you see on your card</li>
              </ul>
            </div>

            {/* Behavioral health card */}
            <div className="rounded-xl border border-[#BF9C73]/40 bg-[#FEF8F1] p-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BF9C73]" style={F}>
                Optum Commercial Behavioral Health (Mental Health Carve-out)
              </p>
              <p className="mb-4 text-lg font-light text-[#091747]" style={F}>Your mental health coverage</p>
              <ul className="space-y-2 text-sm text-[#091747]/70" style={F}>
                <li>Therapy, psychiatry, medication management</li>
                <li>Separate phone number on the back of your UHC card</li>
                <li>Provider must be credentialed with Optum separately from UHC Medical</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-4">
            <p className="text-sm text-[#091747]/70" style={F}>
              Look at the back of your UHC card for a separate behavioral health phone number or the word &ldquo;Optum.&rdquo; That network — not UHC Medical — is what matters for psychiatry.
            </p>
          </div>
        </section>

        {/* ── 3-step check ─────────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl bg-white px-6 py-8 shadow-sm sm:px-8">
          <h2 className="mb-6 text-xl font-semibold text-[#091747]" style={F}>
            What to do right now
          </h2>
          <ol className="space-y-6">
            <Step n={1} title="Check the back of your card.">
              Look for a separate &ldquo;Behavioral Health&rdquo; or &ldquo;Mental Health&rdquo; phone number, or the Optum logo. That&apos;s your mental health network.
            </Step>
            <Step n={2} title="Call that number and ask">
              if Moonlit Psychiatry is in-network for outpatient psychiatry under Optum Commercial Behavioral Health. If there&apos;s no separate number, call the main member services line and specifically ask about your behavioral health benefits.
            </Step>
            <Step n={3} title="Confirm it is specifically &ldquo;Optum Commercial Behavioral Health.&rdquo;">
              Other Optum products — Optum Medicaid, Optum VA, etc. — are different networks with different provider panels. The product name matters.
            </Step>
          </ol>
        </section>

        {/* ── Moonlit CTA ───────────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl bg-[#091747] px-6 py-10 text-white shadow-sm sm:px-10">
          <h2 className="mb-4 text-2xl font-light text-white" style={F}>
            Moonlit is in-network with Optum Commercial Behavioral Health
          </h2>
          <p className="mb-6 text-base leading-relaxed text-white/80" style={F}>
            Moonlit accepts Optum Commercial Behavioral Health, effective December 2025. If your UHC plan uses Optum Commercial for mental health, you can book a psychiatry visit with us in-network. No referral required for your initial evaluation.
          </p>
          <Link
            href="/book"
            className="inline-flex items-center justify-center rounded-xl bg-[#BF9C73] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#a07d55]"
            style={F}
          >
            See available appointments
          </Link>
          <p className="mt-4 text-sm text-white/50" style={F}>
            Not sure if your specific plan qualifies?{' '}
            <Link href="/ways-to-pay" className="underline text-white/70 hover:text-white">
              Check our insurance page
            </Link>{' '}
            or call us at 385-246-2522.
          </p>
        </section>

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <p className="text-center text-xs leading-relaxed text-[#091747]/40" style={F}>
          Coverage details vary by plan and year. This page is educational and is not legal, medical, or billing advice. Always verify your specific plan benefits directly with your insurance carrier.
        </p>

      </div>
    </div>
  )
}
