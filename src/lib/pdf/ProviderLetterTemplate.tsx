/**
 * Provider Letter PDF Template.
 *
 * Renders a Moonlit-letterhead clinical letter for a single patient. The
 * `bodyText` is provider-edited and rendered verbatim, with paragraphs split
 * on blank lines.
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import * as path from 'path'
import { LetterType, LETTER_TYPE_TITLES } from '@/lib/services/letterService'

const MOONLIT_NAVY = '#1B2B4A'
const MOONLIT_GRAY = '#666666'

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 60,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
  },
  header: { marginBottom: 24 },
  logo: { width: 150, height: 'auto', marginBottom: 8 },
  headerContact: { fontSize: 8, color: MOONLIT_GRAY, marginBottom: 2 },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: MOONLIT_NAVY,
    marginTop: 8,
    marginBottom: 18,
  },
  letterDate: { fontSize: 11, color: '#333', marginBottom: 18 },
  recipientBlock: { marginBottom: 18 },
  recipientLine: { fontSize: 11, color: '#333' },
  title: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reLine: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 14,
  },
  paragraph: { fontSize: 11, color: '#222', marginBottom: 10 },
  diagnosisBlock: {
    marginTop: 4,
    marginBottom: 14,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: MOONLIT_NAVY,
  },
  diagnosisLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  diagnosisItem: { fontSize: 11, color: '#222', marginBottom: 2 },
  signatureBlock: { marginTop: 30 },
  signedSincerely: { fontSize: 11, color: '#222', marginBottom: 28 },
  signatureName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Oblique', // italic stand-in for handwritten signature
    color: MOONLIT_NAVY,
    marginBottom: 4,
  },
  signatureCredentials: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
  },
  signatureSubline: { fontSize: 10, color: MOONLIT_GRAY, marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 36,
    left: 60,
    right: 60,
    fontSize: 8,
    color: MOONLIT_GRAY,
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    paddingTop: 8,
    textAlign: 'center',
  },
})

export interface ProviderLetterPDFProps {
  letterType: LetterType
  patientName: string
  patientDob?: string | null
  providerName: string
  providerCredentials: string
  providerNpi?: string | null
  recipientName?: string | null
  recipientOrganization?: string | null
  diagnosisCodes?: string[]
  bodyText: string                  // already-edited; rendered verbatim
  letterDate: string                // pretty-printed
}

const splitParagraphs = (body: string) =>
  body
    .replace(/\r\n/g, '\n')
    .split(/\n\s*\n/)            // blank-line separated paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0)

export const ProviderLetterPDF: React.FC<ProviderLetterPDFProps> = ({
  letterType,
  patientName,
  patientDob,
  providerName,
  providerCredentials,
  providerNpi,
  recipientName,
  recipientOrganization,
  diagnosisCodes = [],
  bodyText,
  letterDate,
}) => {
  const logoPath = path.join(process.cwd(), 'public', 'images', 'MOONLIT-LOGO-WITH-TITLE.png')
  const showDiagnosisBlock =
    (letterType === 'proof_of_care_with_dx' ||
      letterType === 'coordination_of_care' ||
      letterType === 'work_leave') &&
    diagnosisCodes.length > 0
  const dobSuffix = patientDob ? ` (DOB ${patientDob})` : ''
  const paragraphs = splitParagraphs(bodyText)

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.header}>
          <Image style={styles.logo} src={logoPath} />
          <Text style={styles.headerContact}>
            (385) 246-2522 | 1336 S 1100 E Salt Lake City, UT 84105 | trymoonlit.com
          </Text>
          <Text style={styles.headerContact}>hello@trymoonlit.com</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Date */}
        <Text style={styles.letterDate}>{letterDate}</Text>

        {/* Recipient block */}
        {(recipientName || recipientOrganization) && (
          <View style={styles.recipientBlock}>
            {recipientName ? <Text style={styles.recipientLine}>{recipientName}</Text> : null}
            {recipientOrganization ? (
              <Text style={styles.recipientLine}>{recipientOrganization}</Text>
            ) : null}
          </View>
        )}

        {/* Title */}
        <Text style={styles.title}>{LETTER_TYPE_TITLES[letterType]}</Text>

        {/* Re: line */}
        <Text style={styles.reLine}>Re: {patientName}{dobSuffix}</Text>

        {/* Body */}
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.paragraph}>
            {p}
          </Text>
        ))}

        {/* Diagnosis block (when applicable) */}
        {showDiagnosisBlock && (
          <View style={styles.diagnosisBlock}>
            <Text style={styles.diagnosisLabel}>Diagnoses</Text>
            {diagnosisCodes.map((dx, i) => (
              <Text key={i} style={styles.diagnosisItem}>
                • {dx}
              </Text>
            ))}
          </View>
        )}

        {/* Signature */}
        <View style={styles.signatureBlock}>
          <Text style={styles.signedSincerely}>Sincerely,</Text>
          <Text style={styles.signatureName}>{providerName}</Text>
          <Text style={styles.signatureCredentials}>
            {providerName}, {providerCredentials}
          </Text>
          <Text style={styles.signatureSubline}>Moonlit Psychiatry</Text>
          {providerNpi ? (
            <Text style={styles.signatureSubline}>NPI: {providerNpi}</Text>
          ) : null}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>
            This letter is confidential and intended only for the recipient named above.
          </Text>
          <Text>moonlit | (385) 246-2522 | hello@trymoonlit.com</Text>
        </View>
      </Page>
    </Document>
  )
}
