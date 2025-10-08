import { LEGAL_VERSION, PRACTICE_INFO } from '@/lib/constants'
import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy | Moonlit Psychiatry',
  description: 'Privacy Policy for Moonlit Psychiatry'
}

export default function PrivacyPolicy() {
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
            Privacy Policy
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
                {PRACTICE_INFO.name} ("Moonlit," "we," "us," or "our") is committed to protecting
                your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard
                your information when you visit our website or use our services.
              </p>
              <p className="text-[#091747]/80 leading-relaxed">
                This Privacy Policy should be read in conjunction with our{' '}
                <Link href={`/legal/hipaa?v=${LEGAL_VERSION}`} className="text-[#BF9C73] hover:text-[#091747] underline">
                  Notice of Privacy Practices
                </Link>, which specifically addresses the use and disclosure of
                Protected Health Information (PHI) as required by HIPAA.
              </p>
            </section>

            {/* Information We Collect */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                2. Information We Collect
              </h2>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Personal Information
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                We collect personal information that you provide to us, including:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2 mb-6">
                <li>Name, address, phone number, and email address</li>
                <li>Date of birth and demographic information</li>
                <li>Insurance information</li>
                <li>Medical history and health information</li>
                <li>Payment and billing information</li>
              </ul>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Technical Information
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                When you visit our website, we may automatically collect:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2">
                <li>IP address and browser type</li>
                <li>Device information and operating system</li>
                <li>Pages visited and time spent on our site</li>
                <li>Referring website addresses</li>
              </ul>
            </section>

            {/* How We Use Information */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                3. How We Use Your Information
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                We use your information to:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2">
                <li>Provide psychiatric care and treatment services</li>
                <li>Schedule and manage appointments</li>
                <li>Process payments and insurance claims</li>
                <li>Communicate with you about your care</li>
                <li>Send appointment reminders and follow-up communications</li>
                <li>Improve our services and website functionality</li>
                <li>Comply with legal and regulatory requirements</li>
              </ul>
            </section>

            {/* Information Sharing */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                4. Information Sharing and Disclosure
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                We may share your information with:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2 mb-4">
                <li><strong>Healthcare Providers:</strong> Other healthcare professionals involved in your care</li>
                <li><strong>Insurance Companies:</strong> To process claims and verify coverage</li>
                <li><strong>Service Providers:</strong> Third-party vendors who assist with our operations (e.g., billing, IT services)</li>
                <li><strong>Legal Requirements:</strong> When required by law or to protect rights and safety</li>
              </ul>
              <p className="text-[#091747]/80 leading-relaxed">
                We require all third parties to maintain the confidentiality and security of your information
                and to comply with applicable privacy laws.
              </p>
            </section>

            {/* Data Security */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                5. Data Security
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your information,
                including:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2 mb-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure servers and access controls</li>
                <li>Regular security assessments and updates</li>
                <li>Employee training on privacy and security practices</li>
              </ul>
              <p className="text-[#091747]/80 leading-relaxed">
                However, no method of transmission over the Internet or electronic storage is 100% secure.
                While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            {/* Your Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                6. Your Privacy Rights
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                You have the right to:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2 mb-4">
                <li>Access and review your personal information</li>
                <li>Request corrections to your information</li>
                <li>Request restrictions on the use of your information</li>
                <li>Receive an accounting of disclosures of your information</li>
                <li>Receive a copy of this Privacy Policy</li>
              </ul>
              <p className="text-[#091747]/80 leading-relaxed">
                For more information about your HIPAA rights regarding Protected Health Information,
                please see our{' '}
                <Link href={`/legal/hipaa?v=${LEGAL_VERSION}`} className="text-[#BF9C73] hover:text-[#091747] underline">
                  Notice of Privacy Practices
                </Link>.
              </p>
            </section>

            {/* Cookies */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                7. Cookies and Tracking
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                Our website may use cookies and similar tracking technologies to enhance your experience.
                You can control cookies through your browser settings, though disabling cookies may affect
                website functionality.
              </p>
            </section>

            {/* Children's Privacy */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                8. Children's Privacy
              </h2>
              <p className="text-[#091747]/80 leading-relaxed">
                Our services are not directed to individuals under the age of 18. We do not knowingly
                collect personal information from children without parental consent. For patients under 18,
                a parent or legal guardian must provide consent for treatment and information collection.
              </p>
            </section>

            {/* Changes */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                9. Changes to This Privacy Policy
              </h2>
              <p className="text-[#091747]/80 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material
                changes by posting the new Privacy Policy on our website with a new effective date.
              </p>
            </section>

            {/* Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                10. Contact Us
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                If you have questions about this Privacy Policy or our privacy practices, please contact us:
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
