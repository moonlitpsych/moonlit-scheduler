'use client'

import React from 'react'

interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}

export default function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const percentage = Math.min(100, (currentStep / totalSteps) * 100)

  return (
    <div className="w-full h-2 bg-stone-200 sticky top-0">
      <div
        className="h-full bg-[#BF9C73] transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  )
}
