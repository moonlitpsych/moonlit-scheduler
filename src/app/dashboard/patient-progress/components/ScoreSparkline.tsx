'use client'

import { LineChart, Line, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts'
import type { SeverityLevel } from '@/lib/outcome-measures'

interface Props {
  scores: Array<{ date: string; score: number; severity: SeverityLevel }>
  maxScore: number
}

export default function ScoreSparkline({ scores, maxScore }: Props) {
  if (scores.length < 2) {
    return <span className="text-slate-400 text-xs">1 data point</span>
  }

  const improving = scores[scores.length - 1].score < scores[0].score
  const strokeColor = improving ? '#22c55e' : '#ef4444'

  return (
    <div style={{ width: 120, height: 40 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={scores}>
          <YAxis domain={[0, maxScore]} hide />
          <ReferenceLine y={5} stroke="#94a3b8" strokeDasharray="2 2" />
          <Line
            type="monotone"
            dataKey="score"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
