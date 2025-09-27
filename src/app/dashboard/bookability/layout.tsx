import BookabilityDashboard from '@/components/bookability/BookabilityDashboard'

export default function BookabilityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BookabilityDashboard basePath="/dashboard/bookability" isReadOnly={true}>
      {children}
    </BookabilityDashboard>
  )
}