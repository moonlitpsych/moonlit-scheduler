import BookabilityDashboard from '@/components/bookability/BookabilityDashboard'

export default function BookabilityLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <BookabilityDashboard basePath="/admin/bookability" isReadOnly={false}>
      {children}
    </BookabilityDashboard>
  )
}