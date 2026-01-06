import type { Metadata } from 'next'
import { PublicationHeader } from '@/components/offlabel/PublicationHeader'
import { PublicationFooter } from '@/components/offlabel/PublicationFooter'

export const metadata: Metadata = {
  title: {
    default: 'Off-Label | Moonlit Psychiatry',
    template: '%s | Off-Label',
  },
  description:
    'Stories of psychiatric treatments discovered by accident, rediscovered from history, or used in ways their inventors never imagined.',
  openGraph: {
    title: 'Off-Label | Moonlit Psychiatry',
    description:
      'Stories of psychiatric treatments discovered by accident, rediscovered from history, or used in ways their inventors never imagined.',
    type: 'website',
    siteName: 'Off-Label',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function OffLabelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicationHeader />
      <main className="flex-grow">{children}</main>
      <PublicationFooter />
    </div>
  )
}
