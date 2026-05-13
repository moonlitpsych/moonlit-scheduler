import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Svg, Line, Polyline, Circle, Rect } from '@react-pdf/renderer'
import { maxScore, severityColor, severityLabel } from '@/lib/outcome-measures'
import type { MeasureType, SeverityLevel } from '@/lib/outcome-measures'

const NAVY = '#091747'
const GOLD = '#BF9C73'
const CREAM = '#FAF8F5'
const PEACH_TINT = '#FDF2EA'
const TEXT = '#1f2937'
const MUTED = '#64748b'
const BORDER = '#e5e7eb'

interface Assessment {
  id: string
  date: string
  measureType: MeasureType
  totalScore: number
  severity: SeverityLevel
}

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
  meta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  title: { fontSize: 10, color: NAVY, letterSpacing: 1.6, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  generated: { fontSize: 8.5, color: MUTED, letterSpacing: 0.4 },
  divider: { height: 0.75, backgroundColor: GOLD, marginBottom: 8, opacity: 0.7 },
  patientName: { fontSize: 16, color: NAVY, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  patientSub: { fontSize: 10, color: MUTED, marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NAVY, marginBottom: 6, marginTop: 8 },
  sectionSummary: { fontSize: 10, color: MUTED, marginBottom: 8 },
  chartBox: { backgroundColor: CREAM, padding: 8, borderRadius: 4, marginBottom: 8 },
  table: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, marginBottom: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: CREAM, borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 4, paddingHorizontal: 7 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BORDER, paddingVertical: 4, paddingHorizontal: 7 },
  tableRowLast: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 7 },
  th: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, textTransform: 'uppercase', letterSpacing: 0.6 },
  td: { fontSize: 9.5, color: TEXT },
  tdBold: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: NAVY },
  colDate: { flex: 1.4 },
  colScore: { flex: 1, textAlign: 'right' },
  colSeverity: { flex: 1.4 },
  caption: { fontSize: 8.5, color: MUTED, fontStyle: 'italic', marginBottom: 6, lineHeight: 1.35 },
  footer: { backgroundColor: PEACH_TINT, borderLeftWidth: 3, borderLeftColor: GOLD, paddingVertical: 8, paddingHorizontal: 12, marginTop: 6 },
  footerText: { fontSize: 9.5, fontFamily: 'Times-Roman', color: NAVY, lineHeight: 1.45 },
})

function formatDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[Number(m) - 1]} ${Number(d)}, ${y}`
}

const CHART_W = 480
const CHART_H = 140
const CHART_PAD_L = 26
const CHART_PAD_R = 12
const CHART_PAD_T = 10
const CHART_PAD_B = 22

function MeasureChart({ measureType, assessments }: { measureType: MeasureType; assessments: Assessment[] }) {
  const max = maxScore(measureType)
  const innerW = CHART_W - CHART_PAD_L - CHART_PAD_R
  const innerH = CHART_H - CHART_PAD_T - CHART_PAD_B
  const n = assessments.length
  const x = (i: number) => CHART_PAD_L + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1))
  const y = (score: number) => CHART_PAD_T + innerH - (score / max) * innerH

  // Remission threshold line (score = 5)
  const yRemission = y(5)

  const points = assessments.map((a, i) => `${x(i)},${y(a.totalScore)}`).join(' ')

  return (
    <View style={styles.chartBox}>
      <Svg width={CHART_W} height={CHART_H}>
        {/* Y-axis grid + labels (0, max/2, max) */}
        {[0, Math.round(max / 2), max].map(v => (
          <React.Fragment key={v}>
            <Line
              x1={CHART_PAD_L}
              y1={y(v)}
              x2={CHART_W - CHART_PAD_R}
              y2={y(v)}
              stroke="#e2e8f0"
              strokeWidth={0.5}
            />
            <Text style={{ fontSize: 7, fill: MUTED } as never} x={4} y={y(v) + 3}>{v}</Text>
          </React.Fragment>
        ))}
        {/* Remission threshold */}
        <Line
          x1={CHART_PAD_L}
          y1={yRemission}
          x2={CHART_W - CHART_PAD_R}
          y2={yRemission}
          stroke={GOLD}
          strokeWidth={0.6}
          strokeDasharray="3 3"
        />
        {/* Series line */}
        {n >= 2 && (
          <Polyline points={points} stroke={NAVY} strokeWidth={1.6} fill="none" />
        )}
        {/* Dots colored by severity */}
        {assessments.map((a, i) => (
          <Circle
            key={a.id}
            cx={x(i)}
            cy={y(a.totalScore)}
            r={3}
            fill={severityColor(a.severity)}
            stroke="#ffffff"
            strokeWidth={1}
          />
        ))}
        {/* X-axis labels (first, last, middle if many) */}
        {assessments.map((a, i) => {
          if (n > 6 && i !== 0 && i !== n - 1 && i !== Math.floor(n / 2)) return null
          return (
            <Text
              key={`xlabel-${a.id}`}
              style={{ fontSize: 7, fill: MUTED } as never}
              x={x(i) - 18}
              y={CHART_H - 6}
            >
              {formatDate(a.date)}
            </Text>
          )
        })}
        {/* Remission label */}
        <Rect x={CHART_W - CHART_PAD_R - 38} y={yRemission - 8} width={38} height={9} fill="#ffffff" />
        <Text style={{ fontSize: 6.5, fill: GOLD } as never} x={CHART_W - CHART_PAD_R - 36} y={yRemission - 2}>
          Remission
        </Text>
      </Svg>
    </View>
  )
}

function MeasureSection({ measureType, assessments }: { measureType: MeasureType; assessments: Assessment[] }) {
  if (assessments.length === 0) return null
  const first = assessments[0]
  const last = assessments[assessments.length - 1]
  const change = last.totalScore - first.totalScore
  const trendCopy =
    assessments.length < 2
      ? 'Baseline established — your next visit will show how things have changed.'
      : change < 0
        ? `Down ${Math.abs(change)} points since your first assessment — a meaningful sign of improvement.`
        : change > 0
          ? `Up ${change} points since your first assessment. Bring this to your next visit — your provider can use it to adjust your plan.`
          : 'Scores have held steady since your first assessment.'

  return (
    <View>
      <Text style={styles.sectionTitle}>{measureType === 'PHQ-9' ? 'Depression (PHQ-9)' : 'Anxiety (GAD-7)'}</Text>
      <Text style={styles.sectionSummary}>{trendCopy}</Text>
      <MeasureChart measureType={measureType} assessments={assessments} />
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, styles.colDate]}>Date</Text>
          <Text style={[styles.th, styles.colScore]}>Score</Text>
          <Text style={[styles.th, styles.colSeverity]}>Severity</Text>
        </View>
        {assessments.map((a, i) => {
          const isLast = i === assessments.length - 1
          return (
            <View key={a.id} style={isLast ? styles.tableRowLast : styles.tableRow}>
              <Text style={[styles.tdBold, styles.colDate]}>{formatDate(a.date)}</Text>
              <Text style={[styles.td, styles.colScore]}>{a.totalScore}</Text>
              <Text style={[styles.td, styles.colSeverity, { color: severityColor(a.severity) }]}>
                {severityLabel(a.severity)}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

interface Props {
  patientName: string
  assessments: Assessment[]
  generatedAt: Date
  letterheadImage?: Buffer | string
}

export function PatientReport({ patientName, assessments, generatedAt, letterheadImage }: Props) {
  const phq9 = assessments.filter(a => a.measureType === 'PHQ-9')
  const gad7 = assessments.filter(a => a.measureType === 'GAD-7')
  const dates = assessments.map(a => a.date).sort()

  return (
    <Document title={`Patient Progress — ${patientName}`} author="Moonlit Psychiatry">
      <Page size="LETTER" style={styles.page}>
        {letterheadImage && (
          <Image src={letterheadImage as unknown as string} style={styles.letterheadBg} fixed />
        )}
        <View style={styles.contentCard}>
          <View style={styles.meta}>
            <Text style={styles.title}>Your Progress</Text>
            <Text style={styles.generated}>{formatDate(generatedAt.toISOString().slice(0, 10))}</Text>
          </View>
          <View style={styles.divider} />

          <Text style={styles.patientName}>{patientName}</Text>
          <Text style={styles.patientSub}>
            {dates.length > 0
              ? `${assessments.length} assessment${assessments.length === 1 ? '' : 's'} from ${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}`
              : 'No assessments on file yet.'}
          </Text>

          <Text style={styles.caption}>
            PHQ-9 measures depression symptoms; GAD-7 measures anxiety symptoms. Scores below 5 are considered in clinical
            remission. The dashed gold line marks that threshold; dot colors show severity at each visit.
          </Text>

          {phq9.length > 0 && <MeasureSection measureType="PHQ-9" assessments={phq9} />}
          {gad7.length > 0 && <MeasureSection measureType="GAD-7" assessments={gad7} />}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Bring this to your next visit if it helps you talk with your provider about how things have changed. Your scores
              are one signal among many — your own sense of how you&apos;re doing matters just as much.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
