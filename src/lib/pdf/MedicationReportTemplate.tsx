/**
 * Medication Report PDF Template
 * Recreates Moonlit letterhead design using PDF primitives
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import * as path from 'path'

// Moonlit brand colors (from official letterhead)
const MOONLIT_NAVY = '#1B2B4A' // Dark blue for "moonlit"
const MOONLIT_GRAY = '#666666' // Contact info

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 11
  },
  // Header (recreated letterhead)
  header: {
    marginBottom: 30
  },
  logo: {
    width: 150,
    height: 'auto',
    marginBottom: 10
  },
  headerContact: {
    fontSize: 8,
    color: MOONLIT_GRAY,
    marginBottom: 2
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: MOONLIT_NAVY,
    marginTop: 10,
    marginBottom: 20
  },
  // Document title
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 20,
    marginTop: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  // Sections
  section: {
    marginBottom: 15
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  // Info box
  infoBox: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    marginBottom: 15,
    borderRadius: 2,
    border: '1px solid #E0E0E0'
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  infoLabel: {
    width: 140,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY
  },
  infoValue: {
    flex: 1,
    color: '#333333'
  },
  // Medication list
  medList: {
    marginLeft: 10
  },
  medItem: {
    marginBottom: 8,
    paddingLeft: 10
  },
  medName: {
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 2
  },
  medDetails: {
    fontSize: 10,
    color: '#666666',
    marginLeft: 10
  },
  // Change indicator
  changeIndicator: {
    padding: 10,
    backgroundColor: '#E8F4F8',
    borderLeft: `4px solid #3498DB`,
    marginBottom: 15
  },
  noChangeIndicator: {
    padding: 10,
    backgroundColor: '#F0F0F0',
    borderLeft: `4px solid #95A5A6`,
    marginBottom: 15
  },
  // Organization attribution (replaces signature)
  attribution: {
    marginTop: 30,
    paddingTop: 15,
    fontSize: 9,
    color: MOONLIT_GRAY
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 40,
    left: 50,
    right: 50,
    fontSize: 8,
    color: MOONLIT_GRAY,
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    paddingTop: 10
  },
  footerText: {
    textAlign: 'center',
    marginBottom: 3
  }
})

export interface MedicationReportData {
  patientName: string
  appointmentDate: string
  providerName: string
  providerCredentials: string
  organizationName: string
  medicationChanges: Array<{
    medication: string
    changeType: string
    previousDosage?: string
    newDosage?: string
    frequency?: string
    timing?: string
    notes?: string
  }>
  hasChanges: boolean
  noChangeIndicator: boolean
  previousMedications: string[]
  currentMedications: string[]
}

export const MedicationReportPDF: React.FC<MedicationReportData> = ({
  patientName,
  appointmentDate,
  providerName,
  providerCredentials,
  organizationName,
  medicationChanges,
  hasChanges,
  noChangeIndicator,
  previousMedications,
  currentMedications
}) => {
  // Get absolute path to logo
  const logoPath = path.join(process.cwd(), 'public', 'images', 'MOONLIT-LOGO-WITH-TITLE.png')

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Letterhead Header */}
        <View style={styles.header}>
          <Image style={styles.logo} src={logoPath} />
          <Text style={styles.headerContact}>(385) 246-2522 | 1336 S 1100 E Salt Lake City, UT 84105 | trymoonlit.com</Text>
          <Text style={styles.headerContact}>hello@trymoonlit.com</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Document Title */}
        <Text style={styles.title}>MEDICATION UPDATE REPORT</Text>

        {/* Patient & Appointment Info */}
        <View style={styles.infoBox}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patient:</Text>
            <Text style={styles.infoValue}>{patientName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Appointment Date:</Text>
            <Text style={styles.infoValue}>{appointmentDate}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Provider:</Text>
            <Text style={styles.infoValue}>
              {providerName}, {providerCredentials}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Organization:</Text>
            <Text style={styles.infoValue}>{organizationName}</Text>
          </View>
        </View>

        {/* Change Status */}
        {noChangeIndicator || !hasChanges ? (
          <View style={styles.noChangeIndicator}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
              ℹ️ NO MEDICATION CHANGES
            </Text>
            <Text>
              No medication changes were made during this visit. The patient is continuing their
              current medication regimen.
            </Text>
          </View>
        ) : (
          <View style={styles.changeIndicator}>
            <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
              ✓ MEDICATION CHANGES DETECTED
            </Text>
            <Text>
              The following medication changes were made during this appointment. Please review and
              update your records accordingly.
            </Text>
          </View>
        )}

        {/* Medication Changes */}
        {medicationChanges.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Medication Changes</Text>
            <View style={styles.medList}>
              {medicationChanges.map((med, index) => (
                <View key={index} style={styles.medItem}>
                  <Text style={styles.medName}>
                    {med.medication.charAt(0).toUpperCase() + med.medication.slice(1)}
                  </Text>
                  <Text style={styles.medDetails}>
                    Change: {med.changeType.replace('_', ' ').toUpperCase()}
                  </Text>
                  {med.previousDosage && (
                    <Text style={styles.medDetails}>Previous: {med.previousDosage}</Text>
                  )}
                  {med.newDosage && <Text style={styles.medDetails}>New: {med.newDosage}</Text>}
                  {med.frequency && <Text style={styles.medDetails}>Frequency: {med.frequency}</Text>}
                  {med.timing && <Text style={styles.medDetails}>Timing: {med.timing}</Text>}
                  {med.notes && <Text style={styles.medDetails}>Notes: {med.notes}</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Current Medications List */}
        {currentMedications.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Medications</Text>
            <View style={styles.medList}>
              {currentMedications.map((med, index) => (
                <Text key={index} style={styles.medItem}>
                  • {med.charAt(0).toUpperCase() + med.slice(1)}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* Organization Attribution */}
        <View style={styles.attribution}>
          <Text style={{ marginBottom: 5 }}>
            Report generated by moonlit on {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </Text>
          <Text style={{ fontSize: 8, color: '#999999', fontStyle: 'italic' }}>
            Prepared for coordination of care purposes as required by Joint Commission standards.
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            This report is confidential and intended for coordination of care purposes only.
          </Text>
          <Text style={styles.footerText}>
            moonlit | (385) 246-2522 | hello@trymoonlit.com
          </Text>
        </View>
      </Page>
    </Document>
  )
}
