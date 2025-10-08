import { LEGAL_VERSION, PRACTICE_INFO } from '@/lib/constants'
import Link from 'next/link'

export const metadata = {
  title: 'Notice of Privacy Practices | Moonlit Psychiatry',
  description: 'HIPAA Notice of Privacy Practices for Moonlit Psychiatry'
}

export default function HipaaNotice() {
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
            Notice of Privacy Practices
          </h1>
          <p className="text-[#091747]/60 text-sm mb-2">
            Effective Date: {LEGAL_VERSION}
          </p>
          <p className="text-[#091747]/60 text-sm mb-8 italic">
            This notice describes how medical information about you may be used and disclosed
            and how you can get access to this information.
          </p>

          <div className="prose prose-lg max-w-none">
            {/* Our Commitment */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                Our Commitment to Your Privacy
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                {PRACTICE_INFO.name} is committed to protecting the privacy of your health information.
                We are required by law to:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2">
                <li>Maintain the privacy of your Protected Health Information (PHI)</li>
                <li>Provide you with this Notice of our legal duties and privacy practices</li>
                <li>Follow the terms of the Notice currently in effect</li>
                <li>Notify you if we are unable to agree to a requested restriction</li>
              </ul>
            </section>

            {/* How We May Use and Disclose Information */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                How We May Use and Disclose Your Health Information
              </h2>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                For Treatment
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                We may use and disclose your health information to provide, coordinate, or manage your
                psychiatric care and related services. This includes consultation with other healthcare
                providers regarding your treatment.
              </p>
              <p className="text-[#091747]/80 leading-relaxed mb-6 italic">
                Example: We may share your medical history with a consulting physician to coordinate your care.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                For Payment
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                We may use and disclose your health information to bill and collect payment for services
                we provide. This may include submitting claims to your insurance company.
              </p>
              <p className="text-[#091747]/80 leading-relaxed mb-6 italic">
                Example: We may send your diagnosis and treatment information to your insurance company
                to obtain payment for services.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                For Healthcare Operations
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                We may use and disclose your health information for healthcare operations, including
                quality improvement, staff training, and business planning.
              </p>
              <p className="text-[#091747]/80 leading-relaxed mb-6 italic">
                Example: We may review your medical records to assess the quality of care you received.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Other Uses and Disclosures
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                We may use or disclose your health information without your authorization for:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2">
                <li><strong>Appointment Reminders:</strong> To remind you of scheduled appointments</li>
                <li><strong>Treatment Alternatives:</strong> To inform you about treatment options</li>
                <li><strong>Required by Law:</strong> When required by federal, state, or local law</li>
                <li><strong>Public Health Activities:</strong> To prevent or control disease, injury, or disability</li>
                <li><strong>Health Oversight:</strong> To government agencies for audits, investigations, or inspections</li>
                <li><strong>Judicial Proceedings:</strong> In response to a court order or subpoena</li>
                <li><strong>Law Enforcement:</strong> For law enforcement purposes as required by law</li>
                <li><strong>Serious Threat:</strong> To prevent serious threat to health or safety</li>
                <li><strong>Abuse or Neglect:</strong> To report suspected abuse, neglect, or domestic violence</li>
              </ul>
            </section>

            {/* Your Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                Your Rights Regarding Your Health Information
              </h2>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Right to Inspect and Copy
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-6">
                You have the right to inspect and obtain a copy of your health information. We may charge
                a reasonable fee for copying and mailing costs.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Right to Amend
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-6">
                If you believe your health information is incorrect or incomplete, you may request an
                amendment. We may deny your request in certain circumstances, but we will provide you
                with a written explanation.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Right to an Accounting of Disclosures
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-6">
                You have the right to request a list of certain disclosures we have made of your health
                information. The first accounting in a 12-month period is free; we may charge a reasonable
                fee for additional requests.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Right to Request Restrictions
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-6">
                You have the right to request restrictions on how we use or disclose your health information.
                We are not required to agree to your request, except in certain circumstances involving
                disclosure to health plans for services you have paid for in full out-of-pocket.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Right to Request Confidential Communications
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-6">
                You have the right to request that we communicate with you about your health information
                by alternative means or at alternative locations. We will accommodate reasonable requests.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Right to a Paper Copy of This Notice
              </h3>
              <p className="text-[#091747]/80 leading-relaxed mb-6">
                You have the right to a paper copy of this Notice, even if you have agreed to receive
                it electronically. You may request a copy at any time.
              </p>

              <h3 className="text-xl font-light text-[#091747] mb-3 font-['Newsreader']">
                Right to Be Notified of a Breach
              </h3>
              <p className="text-[#091747]/80 leading-relaxed">
                You have the right to be notified if there is a breach of your unsecured health information.
              </p>
            </section>

            {/* Authorization Required */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                Uses and Disclosures Requiring Your Authorization
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                Other uses and disclosures not described in this Notice will be made only with your
                written authorization. You may revoke your authorization at any time by providing
                written notice, except to the extent we have already taken action in reliance on it.
              </p>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                The following uses and disclosures always require your authorization:
              </p>
              <ul className="list-disc pl-6 text-[#091747]/80 space-y-2">
                <li>Most uses and disclosures of psychotherapy notes</li>
                <li>Uses and disclosures for marketing purposes</li>
                <li>Disclosures that constitute a sale of your health information</li>
              </ul>
            </section>

            {/* Changes to Notice */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                Changes to This Notice
              </h2>
              <p className="text-[#091747]/80 leading-relaxed">
                We reserve the right to change this Notice and make the new Notice apply to health
                information we already have as well as information we receive in the future. We will
                post the current Notice on our website and provide copies in our office.
              </p>
            </section>

            {/* Complaints */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                Complaints
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                If you believe your privacy rights have been violated, you may file a complaint with:
              </p>
              <div className="text-[#091747]/80 leading-relaxed mb-4">
                <p className="font-semibold">Our Privacy Officer:</p>
                <p>{PRACTICE_INFO.name}</p>
                <p>{PRACTICE_INFO.address}</p>
                <p>{PRACTICE_INFO.city}, {PRACTICE_INFO.state} {PRACTICE_INFO.zip}</p>
                <p>Phone: {PRACTICE_INFO.phone}</p>
                <p>Email: {PRACTICE_INFO.email}</p>
              </div>
              <div className="text-[#091747]/80 leading-relaxed mb-4">
                <p className="font-semibold">Or with the U.S. Department of Health and Human Services:</p>
                <p>Office for Civil Rights</p>
                <p>U.S. Department of Health and Human Services</p>
                <p>200 Independence Avenue, S.W.</p>
                <p>Washington, D.C. 20201</p>
                <p>Phone: 1-877-696-6775</p>
                <p>Website: <a href="https://www.hhs.gov/ocr/privacy/hipaa/complaints/" className="text-[#BF9C73] hover:text-[#091747] underline">www.hhs.gov/ocr/privacy/hipaa/complaints</a></p>
              </div>
              <p className="text-[#091747]/80 leading-relaxed font-semibold">
                You will not be penalized or retaliated against for filing a complaint.
              </p>
            </section>

            {/* Contact */}
            <section className="mb-8">
              <h2 className="text-2xl font-light text-[#091747] mb-4 font-['Newsreader']">
                Questions
              </h2>
              <p className="text-[#091747]/80 leading-relaxed mb-4">
                If you have questions about this Notice or need more information, please contact:
              </p>
              <div className="text-[#091747]/80 leading-relaxed">
                <p>{PRACTICE_INFO.name}</p>
                <p>{PRACTICE_INFO.address}</p>
                <p>{PRACTICE_INFO.city}, {PRACTICE_INFO.state} {PRACTICE_INFO.zip}</p>
                <p>Phone: {PRACTICE_INFO.phone}</p>
                <p>Email: {PRACTICE_INFO.email}</p>
              </div>
            </section>

            {/* Acknowledgment */}
            <section className="mb-8 bg-[#FEF8F1] p-6 rounded-lg border-l-4 border-[#BF9C73]">
              <p className="text-[#091747]/80 leading-relaxed font-semibold mb-2">
                Acknowledgment
              </p>
              <p className="text-[#091747]/80 leading-relaxed">
                By using our services, you acknowledge that you have received and reviewed this
                Notice of Privacy Practices. If you have any questions or concerns, please contact
                us before proceeding with treatment.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
