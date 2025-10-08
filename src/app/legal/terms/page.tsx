import { LEGAL_VERSION, PRACTICE_INFO } from '@/lib/constants'
import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service | Moonlit',
  description: 'Terms of Service for Moonlit, PLLC'
}

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-[#FEF8F1] py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
          {/* Header */}
          <div className="mb-8">
            <Link
              href="/"
              className="text-[#BF9C73] hover:text-[#091747] font-['Newsreader'] transition-colors"
            >
              ← Back to Home
            </Link>
          </div>

          <h1 className="text-4xl font-light text-[#091747] mb-2 font-['Newsreader']">
            Terms of Service
          </h1>
          <p className="text-[#091747]/60 text-sm mb-8">
            Effective Date: {LEGAL_VERSION}
          </p>

          <div className="prose prose-lg max-w-none">
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                1. Introduction
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                Welcome to {PRACTICE_INFO.name} ("Moonlit," "we," "us," or "our"). These Terms of Service
                govern your use of our website, appointment booking system, and telehealth services.
              </p>
              <p className="text-[#091747]/80 leading-relaxed">
                By accessing or using our services, you agree to be bound by these Terms. If you do not
                agree to these Terms, please do not use our services.
              </p>
            </section>

            {/* Services */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                2. Services Provided
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                Moonlit provides psychiatric care services including:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2">
                <li>Initial psychiatric evaluations</li>
                <li>Medication management</li>
                <li>Ongoing psychiatric care</li>
                <li>Telehealth appointments via secure video conferencing</li>
              </ul>
            </section>

            {/* Appointments */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                3. Appointments and Cancellations
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                <strong>Scheduling:</strong> Appointments can be scheduled through our online booking system
                or by contacting our office at {PRACTICE_INFO.phone}.
              </p>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                <strong>Cancellations:</strong> We require at least 24 hours' notice for appointment
                cancellations or rescheduling. Late cancellations or no-shows may result in a cancellation fee.
              </p>
              <p className="text-[#091747]/80 leading-relaxed">
                <strong>Telehealth:</strong> For telehealth appointments, you are responsible for ensuring
                you have a reliable internet connection and are in a private, quiet location.
              </p>
            </section>

            {/* Payment */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                4. Payment and Insurance
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                <strong>Insurance:</strong> We accept various insurance plans. It is your responsibility
                to verify coverage with your insurance provider before your appointment.
              </p>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                <strong>Self-Pay:</strong> Self-pay rates are available. Payment is due at the time of service.
              </p>
              <p className="text-[#091747]/80 leading-relaxed">
                <strong>Billing:</strong> We will submit claims to your insurance company on your behalf.
                You are responsible for any deductibles, co-pays, or services not covered by your insurance.
              </p>
            </section>

            {/* Patient Responsibilities */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                5. Patient Responsibilities
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                As a patient, you agree to:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2">
                <li>Provide accurate and complete medical and insurance information</li>
                <li>Follow treatment plans and recommendations provided by your provider</li>
                <li>Communicate openly and honestly with your provider</li>
                <li>Notify us of any changes to your contact or insurance information</li>
                <li>Treat staff and providers with respect and courtesy</li>
              </ul>
            </section>

            {/* Privacy */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                6. Privacy and Confidentiality
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                Your privacy is important to us. We comply with HIPAA regulations and maintain strict
                confidentiality of your health information.
              </p>
              <p className="text-[#091747]/80 leading-relaxed">
                For more information, please review our{' '}
                <Link href={`/legal/privacy?v=${LEGAL_VERSION}`} className="text-[#BF9C73] hover:text-[#091747] underline">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href={`/legal/hipaa?v=${LEGAL_VERSION}`} className="text-[#BF9C73] hover:text-[#091747] underline">
                  Notice of Privacy Practices
                </Link>.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                7. Limitation of Liability
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                Our services are provided on an "as is" basis. While we strive to provide high-quality
                care, we cannot guarantee specific outcomes or results.
              </p>
              <p className="text-[#091747]/80 leading-relaxed">
                In emergency situations, please call 911 or go to your nearest emergency room. Our services
                are not appropriate for emergencies.
              </p>
            </section>

            {/* Changes to Terms */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                8. Changes to Terms
              </h2>
              <p className="text-[#091747]/80 leading-relaxed">
                We reserve the right to modify these Terms at any time. Changes will be effective
                immediately upon posting to our website. Your continued use of our services after
                changes constitutes acceptance of the modified Terms.
              </p>
            </section>

            {/* Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                9. Contact Information
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                If you have questions about these Terms, please contact us:
              </p>
              <div className="text-[#091747]/80 leading-relaxed">
                <p>{PRACTICE_INFO.name}</p>
                <p>{PRACTICE_INFO.address}</p>
                <p>{PRACTICE_INFO.city}, {PRACTICE_INFO.state} {PRACTICE_INFO.zip}</p>
                <p>Phone: {PRACTICE_INFO.phone}</p>
                <p>Email: {PRACTICE_INFO.email}</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
