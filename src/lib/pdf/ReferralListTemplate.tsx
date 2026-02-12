/**
 * Referral Resources PDF Template
 * Generates a branded document listing referral organizations
 */

import React from 'react'
import { Document, Page, Text, View, StyleSheet, Image, Link } from '@react-pdf/renderer'
import * as path from 'path'
import type { ReferralOrganization } from '@/types/referral-network'

// Moonlit brand colors (from official letterhead)
const MOONLIT_NAVY = '#1B2B4A'
const MOONLIT_GRAY = '#666666'
const MOONLIT_LIGHT_BG = '#F9F9F9'

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    fontSize: 10
  },
  // Header (letterhead)
  header: {
    marginBottom: 20
  },
  logo: {
    width: 130,
    height: 'auto',
    marginBottom: 8
  },
  headerContact: {
    fontSize: 8,
    color: MOONLIT_GRAY,
    marginBottom: 2
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: MOONLIT_NAVY,
    marginTop: 8,
    marginBottom: 15
  },
  // Document title
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  // Search criteria info box
  criteriaBox: {
    backgroundColor: MOONLIT_LIGHT_BG,
    padding: 12,
    marginBottom: 20,
    borderRadius: 2,
    borderLeft: `3px solid ${MOONLIT_NAVY}`
  },
  criteriaRow: {
    flexDirection: 'row',
    marginBottom: 4
  },
  criteriaLabel: {
    width: 100,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: MOONLIT_NAVY
  },
  criteriaValue: {
    flex: 1,
    fontSize: 9,
    color: '#333333'
  },
  // Organization cards
  orgCard: {
    marginBottom: 15,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0'
  },
  orgName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 4
  },
  orgAddress: {
    fontSize: 9,
    color: '#333333',
    marginBottom: 2
  },
  orgContactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2
  },
  orgContactItem: {
    fontSize: 9,
    color: '#333333',
    marginRight: 15
  },
  orgLink: {
    fontSize: 9,
    color: '#2980B9',
    textDecoration: 'none'
  },
  orgHours: {
    fontSize: 8,
    color: MOONLIT_GRAY,
    marginTop: 4,
    fontStyle: 'italic'
  },
  orgNotes: {
    fontSize: 8,
    color: MOONLIT_GRAY,
    marginTop: 4,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#E0E0E0'
  },
  // Primary contact
  contactSection: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0'
  },
  contactLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: MOONLIT_NAVY,
    marginBottom: 2
  },
  contactName: {
    fontSize: 9,
    color: '#333333'
  },
  contactDetails: {
    fontSize: 8,
    color: MOONLIT_GRAY
  },
  // Care types badges
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6
  },
  badge: {
    fontSize: 7,
    backgroundColor: '#E8F4F8',
    color: MOONLIT_NAVY,
    padding: '2 6',
    marginRight: 4,
    marginBottom: 2,
    borderRadius: 2
  },
  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: 40,
    color: MOONLIT_GRAY
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 35,
    left: 50,
    right: 50,
    fontSize: 8,
    color: MOONLIT_GRAY,
    borderTopWidth: 1,
    borderTopColor: '#CCCCCC',
    paddingTop: 8
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  footerText: {
    textAlign: 'center',
    marginBottom: 2
  },
  pageNumber: {
    textAlign: 'right',
    fontSize: 8,
    color: MOONLIT_GRAY
  }
})

export interface ReferralListPDFData {
  payerName: string
  careTypeNames: string[]
  specialtyTagNames?: string[]
  organizations: ReferralOrganization[]
  generatedBy: string
  generatedAt: string
}

// Helper to format address - use service_area for multi-location orgs
function formatAddress(org: ReferralOrganization): string {
  const parts: string[] = []
  if (org.address) parts.push(org.address)

  // For multi-location orgs, show service_area instead of single city
  if (org.service_area) {
    let locationLine = org.service_area
    if (org.state && !org.service_area.includes(org.state)) {
      locationLine += `, ${org.state}`
    }
    parts.push(locationLine)
  } else {
    // Format as "City, ST 12345"
    let locationLine = ''
    if (org.city) {
      locationLine = org.city
      if (org.state) locationLine += `, ${org.state}`
      if (org.postal_code) locationLine += ` ${org.postal_code}`
    }
    if (locationLine) parts.push(locationLine)
  }

  return parts.join(', ')
}

export const ReferralListPDF: React.FC<ReferralListPDFData> = ({
  payerName,
  careTypeNames,
  specialtyTagNames,
  organizations,
  generatedBy,
  generatedAt
}) => {
  // Get absolute path to logo
  const logoPath = path.join(process.cwd(), 'public', 'images', 'MOONLIT-LOGO-WITH-TITLE.png')

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Letterhead Header */}
        <View style={styles.header} fixed>
          <Image style={styles.logo} src={logoPath} />
          <Text style={styles.headerContact}>
            (385) 246-2522 | 1336 S 1100 E Salt Lake City, UT 84105 | trymoonlit.com
          </Text>
          <Text style={styles.headerContact}>hello@trymoonlit.com</Text>
          <View style={styles.headerDivider} />
        </View>

        {/* Document Title */}
        <Text style={styles.title}>Referral Resources</Text>

        {/* Search Criteria */}
        <View style={styles.criteriaBox}>
          <View style={styles.criteriaRow}>
            <Text style={styles.criteriaLabel}>Insurance:</Text>
            <Text style={styles.criteriaValue}>{payerName}</Text>
          </View>
          <View style={styles.criteriaRow}>
            <Text style={styles.criteriaLabel}>Care Types:</Text>
            <Text style={styles.criteriaValue}>{careTypeNames.join(', ')}</Text>
          </View>
          {specialtyTagNames && specialtyTagNames.length > 0 && (
            <View style={styles.criteriaRow}>
              <Text style={styles.criteriaLabel}>Specialties:</Text>
              <Text style={styles.criteriaValue}>{specialtyTagNames.join(', ')}</Text>
            </View>
          )}
          <View style={styles.criteriaRow}>
            <Text style={styles.criteriaLabel}>Results:</Text>
            <Text style={styles.criteriaValue}>
              {organizations.length} organization{organizations.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        </View>

        {/* Organization List */}
        {organizations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text>No matching organizations found for the selected criteria.</Text>
            <Text style={{ marginTop: 8, fontSize: 9 }}>
              Please try different care types or specialties, or contact Moonlit for assistance.
            </Text>
          </View>
        ) : (
          organizations.map((org, index) => (
            <View key={org.id} style={styles.orgCard} wrap={false}>
              {/* Organization Name */}
              <Text style={styles.orgName}>{org.name}</Text>

              {/* Address */}
              {formatAddress(org) && <Text style={styles.orgAddress}>{formatAddress(org)}</Text>}

              {/* Contact Info Row */}
              <View style={styles.orgContactRow}>
                {org.phone && (
                  <Text style={styles.orgContactItem}>Phone: {org.phone}</Text>
                )}
                {org.fax && <Text style={styles.orgContactItem}>Fax: {org.fax}</Text>}
                {org.website && (
                  <Link src={org.website.startsWith('http') ? org.website : `https://${org.website}`} style={styles.orgLink}>
                    {org.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                  </Link>
                )}
              </View>

              {/* Hours */}
              {org.hours_of_operation && (
                <Text style={styles.orgHours}>Hours: {org.hours_of_operation}</Text>
              )}

              {/* Notes */}
              {org.referral_notes && <Text style={styles.orgNotes}>{org.referral_notes}</Text>}

              {/* Email Contact */}
              {org.email && (
                <View style={styles.contactSection}>
                  <Text style={styles.contactLabel}>Email:</Text>
                  <Link src={`mailto:${org.email}`} style={styles.orgLink}>
                    {org.email}
                  </Link>
                </View>
              )}

              {/* Care Type Badges */}
              {org.care_types && org.care_types.length > 0 && (
                <View style={styles.badgeRow}>
                  {org.care_types.map((ct) => (
                    <Text key={ct.id} style={styles.badge}>
                      {ct.care_type?.display_name || 'Unknown'}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text>Generated by {generatedBy}</Text>
            <Text>{generatedAt}</Text>
          </View>
          <Text style={styles.footerText}>
            moonlit | (385) 246-2522 | hello@trymoonlit.com
          </Text>
          <Text style={styles.footerText}>
            This document is provided for informational purposes. Please verify availability and
            insurance acceptance directly with each organization.
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
            fixed
          />
        </View>
      </Page>
    </Document>
  )
}
