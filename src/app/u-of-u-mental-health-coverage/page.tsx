import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

/* ─── SEO ────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  title: 'Who Accepts U of U Mental Health Insurance? | Moonlit Psychiatry',
  description:
    'University of Utah employee plans often use a separate mental health network — HMHI BHN. Here\'s what that means, why providers who "take Regence" may not cover your therapy or psychiatry, and how to check before your first visit.',
  keywords: [
    'u of u mental health coverage',
    'u of u insurance psychiatrist',
    'who takes u of u mental health insurance',
    'university of utah employee insurance mental health',
    'HMHI BHN',
    'Regence behavioral health',
    'UUHP mental health',
    'psychiatrist Salt Lake City',
    'in-network psychiatry Utah',
  ],
  alternates: { canonical: 'https://trymoonlit.com/u-of-u-mental-health-coverage' },
  openGraph: {
    title: 'Who Accepts U of U Mental Health Insurance? | Moonlit Psychiatry',
    description:
      'University of Utah employee plans often use a separate mental health network — HMHI BHN. Here\'s what that means, why providers who "take Regence" may not cover your therapy or psychiatry.',
    url: 'https://trymoonlit.com/u-of-u-mental-health-coverage',
    siteName: 'Moonlit',
    locale: 'en_US',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Who Accepts U of U Mental Health Insurance? | Moonlit Psychiatry',
    description:
      'University of Utah employee plans often use a separate mental health network — HMHI BHN. Here\'s what that means and how to check before your first visit.',
  },
}

/* ─── JSON-LD ────────────────────────────────────────────────────────────── */

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

export default function UofUMentalHealthCoveragePage() {
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
            University of Utah employee insurance
          </p>
          <h1 className="text-3xl font-light leading-tight text-[#091747] sm:text-4xl lg:text-[2.625rem]" style={F}>
            Your U of U medical card and your mental health coverage may not be the same thing
          </h1>
          <p className="mt-4 text-base font-light leading-relaxed text-[#091747]/60" style={F}>
            Did your therapist or psychiatrist say they could take your insurance, then land you with a full bill for their services? You&apos;re not alone.
          </p>
          <p className="mt-3 text-lg font-light leading-relaxed text-[#091747]/70" style={F}>
            Some University of Utah employee plans use a separate network — HMHI BHN — specifically for outpatient psychiatry and therapy. If yours does, that&apos;s the network that matters for behavioral health visits, not Regence or UUHP. A provider can be in-network with one and completely out-of-network with the other.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/ways-to-pay"
              className="inline-flex items-center justify-center rounded-xl bg-[#091747] px-6 py-3 text-base font-medium text-white transition-colors hover:bg-[#0d1f5c]"
              style={F}
            >
              See if Moonlit accepts my plan
            </Link>
            <Link
              href="/university-of-utah-bhn-guide"
              className="text-sm text-[#091747]/60 underline underline-offset-2 hover:text-[#091747] sm:ml-2"
              style={F}
            >
              Read the full coverage guide &rarr;
            </Link>
          </div>
        </header>

        {/* ── Why this keeps happening ───────────────────────────────────── */}
        <section className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 sm:px-8">
          <h2 className="mb-4 text-xl font-semibold text-[#091747]" style={F}>
            Why providers say &ldquo;yes&rdquo; and then can&apos;t bill
          </h2>
          <p className={`${BODY} mb-3 text-base`} style={F}>
            Many University of Utah employee plans use a carve-out: HMHI BHN (Huntsman Mental Health Institute Behavioral Health Network) is a separate company that administers outpatient behavioral health benefits independently from your medical coverage. Not all plans do — but if yours does, Regence or UUHP handles your doctor visits and labs, while HMHI BHN handles your therapy and psychiatry.
          </p>
          <p className={`${BODY} text-base`} style={F}>
            A provider who is credentialed with Regence for medical visits has to separately apply to HMHI BHN for behavioral health — and many haven&apos;t. When they say &ldquo;we take Regence,&rdquo; they may mean medical Regence only. That&apos;s the mismatch.
          </p>
        </section>

        {/* ── Two-network split ─────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl bg-white px-6 py-8 shadow-sm sm:px-8">
          <h2 className="mb-2 text-xl font-semibold text-[#091747]" style={F}>
            The two-network split
          </h2>
          <p className={`${BODY} mb-6 text-base`} style={F}>
            Check your insurance card to see how your plan is set up. The examples below show what each arrangement looks like.
          </p>

          {/* Side-by-side cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Medical card */}
            <div className="rounded-xl bg-[#091747] p-5 text-white">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BF9C73]" style={F}>
                Your medical coverage
              </p>
              <p className="mb-4 text-lg font-light" style={F}>Regence or UUHP</p>
              <ul className="space-y-2 text-sm text-white/80" style={F}>
                <li>Doctor visits, labs, surgery, urgent care</li>
                <li>The name you see on the front of your card</li>
              </ul>
            </div>

            {/* Behavioral health card */}
            <div className="rounded-xl border border-[#BF9C73]/40 bg-[#FEF8F1] p-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#BF9C73]" style={F}>
                If your plan has a behavioral health carve-out
              </p>
              <p className="mb-4 text-lg font-light text-[#091747]" style={F}>Often HMHI BHN</p>
              <ul className="space-y-2 text-sm text-[#091747]/70" style={F}>
                <li>Therapy, psychiatry, medication management</li>
                <li>May appear on the back of your card as a separate phone number or network name</li>
                <li>Provider must be credentialed with this network separately from medical</li>
              </ul>
            </div>
          </div>

          {/* Card images */}
          <div className="mt-8">
            <p className="mb-4 text-sm font-medium text-[#091747]/60" style={F}>
              Card examples — what to look for
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <figure className="flex flex-col gap-1.5">
                <div className="overflow-hidden rounded-lg border border-[#091747]/10">
                  <Image
                    src="/images/hmhi-bhn-cards/Regence_card_HMHIBHN.png"
                    alt="Regence insurance card front showing HMHI BHN indicator"
                    width={280}
                    height={176}
                    className="w-full object-cover"
                  />
                </div>
                <figcaption className="text-center text-xs text-[#091747]/50" style={F}>
                  Regence front — HMHI BHN plan
                </figcaption>
              </figure>
              <figure className="flex flex-col gap-1.5">
                <div className="overflow-hidden rounded-lg border border-[#091747]/10">
                  <Image
                    src="/images/hmhi-bhn-cards/regence_card_HMHIBHN_back.png"
                    alt="Regence insurance card back showing behavioral health contact number"
                    width={280}
                    height={176}
                    className="w-full object-cover"
                  />
                </div>
                <figcaption className="text-center text-xs text-[#091747]/50" style={F}>
                  Regence back — HMHI BHN number
                </figcaption>
              </figure>
              <figure className="flex flex-col gap-1.5">
                <div className="overflow-hidden rounded-lg border border-[#091747]/10">
                  <Image
                    src="/images/hmhi-bhn-cards/UUHP_card_HMHIBHN.png"
                    alt="UUHP insurance card showing HMHI BHN behavioral health network"
                    width={280}
                    height={176}
                    className="w-full object-cover"
                  />
                </div>
                <figcaption className="text-center text-xs text-[#091747]/50" style={F}>
                  UUHP — with HMHI BHN
                </figcaption>
              </figure>
              <figure className="flex flex-col gap-1.5">
                <div className="overflow-hidden rounded-lg border border-[#091747]/10">
                  <Image
                    src="/images/hmhi-bhn-cards/UUHP_card_not_HMHIBHN.png"
                    alt="UUHP insurance card without HMHI BHN — single-network plan"
                    width={280}
                    height={176}
                    className="w-full object-cover"
                  />
                </div>
                <figcaption className="text-center text-xs text-[#091747]/50" style={F}>
                  UUHP — no HMHI BHN carve-out
                </figcaption>
              </figure>
            </div>
            <p className="mt-3 text-xs text-[#091747]/40" style={F}>
              Example only — your card may look different.
            </p>
          </div>

          <div className="mt-6 rounded-xl border border-[#091747]/10 bg-[#FEF8F1] p-4">
            <p className="text-sm text-[#091747]/70" style={F}>
              If your card shows only one carrier with no separate behavioral health number, your plan may administer medical and mental health together. Either way, confirm with your benefits support line before your first visit.
            </p>
          </div>
        </section>

        {/* ── 3-step check ─────────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl bg-white px-6 py-8 shadow-sm sm:px-8">
          <h2 className="mb-6 text-xl font-semibold text-[#091747]" style={F}>
            What to do right now
          </h2>
          <ol className="space-y-6">
            <Step n={1} title="Look at the front and back of your card.">
              The front shows your carrier (Regence or UUHP). The back may show a separate behavioral health phone number or HMHI BHN name — that&apos;s your mental health network if it&apos;s there.
            </Step>
            <Step n={2} title="If you see a separate behavioral health number, call it.">
              Ask: &ldquo;Is [provider name] in-network with my behavioral health plan for outpatient psychiatry or therapy?&rdquo; If there&apos;s no separate number, call the main member services number and ask the same question — some plans administer both together.
            </Step>
            <Step n={3} title="Ask your provider to run an eligibility check">
              before your first visit — specifically for behavioral/mental health, not just general insurance eligibility.
            </Step>
          </ol>
        </section>

        {/* ── Moonlit CTA ───────────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl bg-[#091747] px-6 py-10 text-white shadow-sm sm:px-10">
          <h2 className="mb-4 text-2xl font-light text-white" style={F}>
            Moonlit is credentialed with HMHI BHN
          </h2>
          <p className="mb-6 text-base leading-relaxed text-white/80" style={F}>
            If you have University of Utah employee insurance through Regence or UUHP and your plan uses HMHI BHN for behavioral health, Moonlit accepts it — for psychiatry and medication management visits. No referral required.
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

        {/* ── Full guide callout ────────────────────────────────────────── */}
        <section className="mb-8 rounded-2xl border border-[#BF9C73]/30 bg-white px-6 py-6 shadow-sm sm:px-8">
          <p className="text-base text-[#091747]/70" style={F}>
            Want the full breakdown of how U of U behavioral health coverage works, how to read your card, and common pitfalls?{' '}
            <Link
              href="/university-of-utah-bhn-guide"
              className="font-medium text-[#BF9C73] underline underline-offset-2 hover:text-[#a07d55]"
            >
              Read our complete coverage guide &rarr;
            </Link>
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
