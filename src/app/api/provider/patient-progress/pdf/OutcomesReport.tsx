import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { PatientProgressData } from '@/lib/outcome-measures'
import { severityLabel } from '@/lib/outcome-measures'

const NAVY = '#091747'
const GOLD = '#BF9C73'
const CREAM = '#FAF8F5'
const PEACH_TINT = '#FDF2EA'
const TEXT = '#1f2937'
const MUTED = '#64748b'
const BORDER = '#e5e7eb'

const styles = StyleSheet.create({
  page: {
    paddingTop: 88,
    paddingBottom: 185,
    paddingHorizontal: 52,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: TEXT,
    backgroundColor: '#ffffff',
  },
  letterheadBg: { position: 'absolute', top: 0, left: 0, width: 612, height: 792 },
  contentCard: { backgroundColor: '#ffffff', paddingTop: 14, paddingHorizontal: 14, paddingBottom: 12, borderRadius: 6, marginLeft: -6, marginRight: -6 },
  reportMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  reportTitle: { fontSize: 10, color: NAVY, letterSpacing: 1.6, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  generated: { fontSize: 8.5, color: MUTED, letterSpacing: 0.4 },
  divider: { height: 0.75, backgroundColor: GOLD, marginBottom: 8, opacity: 0.7 },
  scopeLine: { fontSize: 10, color: MUTED, marginBottom: 8 },
  tilesRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tile: { flex: 1, borderWidth: 1, borderColor: BORDER, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 9, backgroundColor: CREAM },
  tileAccent: { flex: 1, borderRadius: 4, paddingVertical: 7, paddingHorizontal: 9, backgroundColor: NAVY },
  tileLabel: { fontSize: 7, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  tileLabelLight: { fontSize: 7, color: GOLD, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  tileValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: NAVY },
  tileValueLight: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  caption: { fontSize: 8.5, color: MUTED, fontStyle: 'italic', marginBottom: 8, lineHeight: 1.35 },
  sectionTitle: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 4, marginTop: 2 },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, marginBottom: 8 },
  tableHeader: { flexDirection: 'row', backgroundColor: CREAM, borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 4, paddingHorizontal: 7 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 4, paddingHorizontal: 7 },
  tableRowLast: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 7 },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  td: { fontSize: 9, color: TEXT },
  tdBold: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: NAVY },
  colPatient: { flex: 3 },
  colMeasure: { flex: 1.1 },
  colScore: { flex: 1.1, textAlign: 'right' },
  colChange: { flex: 1, textAlign: 'right' },
  colN: { flex: 0.9, textAlign: 'right' },
  colStatus: { flex: 1.3, textAlign: 'right' },
  footer: { backgroundColor: PEACH_TINT, borderLeftWidth: 3, borderLeftColor: GOLD, paddingVertical: 8, paddingHorizontal: 12, marginTop: 4 },
  footerText: { fontSize: 9.5, fontFamily: 'Times-Roman', color: NAVY, lineHeight: 1.4 },
})

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`
}

function statusFor(p: PatientProgressData['patients'][number]): string {
  if (p.scores.length < 2) return 'New (1 score)'
  if (p.remissionAchieved) return 'In Remission'
  if (p.responseAchieved) return 'Response'
  if (p.improved) return 'Improved'
  if (p.scoreChange === 0) return 'Stable'
  return 'Worsened'
}

interface Props {
  data: PatientProgressData
  providerName: string
  measureFilter: string | null
  generatedAt: Date
  letterheadImage?: Buffer | string
}

export function OutcomesReport({ data, providerName, measureFilter, generatedAt, letterheadImage }: Props) {
  const multi = data.patients.filter(p => p.scores.length >= 2)
  const pctImproved = multi.length > 0 ? Math.round((multi.filter(p => p.improved).length / multi.length) * 100) : null
  const pctRemission = multi.length > 0 ? Math.round((multi.filter(p => p.remissionAchieved).length / multi.length) * 100) : null

  const scopeParts: string[] = []
  scopeParts.push(measureFilter && measureFilter !== 'all' ? measureFilter : 'PHQ-9 & GAD-7')
  if (data.dateRange.earliest && data.dateRange.latest) {
    scopeParts.push(`${formatDate(data.dateRange.earliest)} – ${formatDate(data.dateRange.latest)}`)
  }

  return (
    <Document title="Moonlit Patient Outcomes Report" author="Moonlit Psychiatry">
      <Page size="LETTER" style={styles.page}>
        {letterheadImage && (
          <Image src={letterheadImage as unknown as string} style={styles.letterheadBg} fixed />
        )}
        <View style={styles.contentCard}>
          <View style={styles.reportMeta}>
            <Text style={styles.reportTitle}>Patient Progress Report</Text>
            <Text style={styles.generated}>{formatDate(generatedAt.toISOString().slice(0, 10))}</Text>
          </View>
          <View style={styles.divider} />
          <Text style={styles.scopeLine}>{providerName}  ·  {scopeParts.join('  ·  ')}</Text>

          <View style={styles.tilesRow}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Patients Tracked</Text>
              <Text style={styles.tileValue}>{data.uploadSummary.patientCount}</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>Total Assessments</Text>
              <Text style={styles.tileValue}>{data.uploadSummary.totalMeasures}</Text>
            </View>
            <View style={styles.tileAccent}>
              <Text style={styles.tileLabelLight}>% Improved</Text>
              <Text style={styles.tileValueLight}>{pctImproved === null ? '—' : `${pctImproved}%`}</Text>
            </View>
            <View style={styles.tileAccent}>
              <Text style={styles.tileLabelLight}>% In Remission</Text>
              <Text style={styles.tileValueLight}>{pctRemission === null ? '—' : `${pctRemission}%`}</Text>
            </View>
          </View>

          <Text style={styles.caption}>
            Improved = lower score on most recent screening than at baseline (2+ visits). Remission = most recent score below 5.
            Percentages reflect only patients with two or more administrations.
          </Text>

          <Text style={styles.sectionTitle}>Patient Detail</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, styles.colPatient]}>Patient</Text>
              <Text style={[styles.th, styles.colMeasure]}>Measure</Text>
              <Text style={[styles.th, styles.colScore]}>First → Last</Text>
              <Text style={[styles.th, styles.colChange]}>Change</Text>
              <Text style={[styles.th, styles.colN]}>N</Text>
              <Text style={[styles.th, styles.colStatus]}>Status</Text>
            </View>
            {data.patients.map((p, i) => {
              const isLast = i === data.patients.length - 1
              const first = p.scores[0]
              const last = p.scores[p.scores.length - 1]
              return (
                <View key={`${p.patientId}-${p.measureType}`} style={isLast ? styles.tableRowLast : styles.tableRow}>
                  <Text style={[styles.tdBold, styles.colPatient]}>{p.patientName}</Text>
                  <Text style={[styles.td, styles.colMeasure]}>{p.measureType}</Text>
                  <Text style={[styles.td, styles.colScore]}>
                    {p.firstScore} ({severityLabel(first?.severity)}) → {p.lastScore} ({severityLabel(last?.severity)})
                  </Text>
                  <Text style={[styles.td, styles.colChange]}>{p.scoreChange > 0 ? '+' : ''}{p.scoreChange}</Text>
                  <Text style={[styles.td, styles.colN]}>{p.scores.length}</Text>
                  <Text style={[styles.td, styles.colStatus]}>{statusFor(p)}</Text>
                </View>
              )
            })}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Confidential — patient identifiers included. For internal clinical use only.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
