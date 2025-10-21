// Partner Dashboard Layout - Excludes public website header/footer
'use client'

export default function PartnerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-moonlit-cream">
      {children}
    </div>
  )
}
