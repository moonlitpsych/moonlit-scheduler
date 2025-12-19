import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Psychiatrist for University of Utah Employees | HMHI-BHN In-Network | Moonlit Psychiatry',
  description: 'U of U employees: Your mental health coverage is through HMHI-BHN, not Regence. Moonlit Psychiatry is in-network with HMHI-BHN. MD/DO physicians only. Evening & weekend appointments available.',
  keywords: [
    'university of utah psychiatrist',
    'HMHI-BHN psychiatrist',
    'psychiatrist regence utah',
    'university of utah health plans psychiatrist',
    'UUHP mental health',
    'psychiatrist salt lake city',
    'u of u employee mental health',
    'huntsman mental health institute network'
  ],
  openGraph: {
    title: 'Psychiatry for University of Utah Employees',
    description: 'We\'re in-network with HMHI-BHN — your actual behavioral health plan. MD/DO physicians. Evening & weekend availability.',
    url: 'https://booking.trymoonlit.com/university-of-utah-employees',
    siteName: 'Moonlit Psychiatry',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Psychiatry for U of U Employees | Moonlit',
    description: 'In-network with HMHI-BHN. MD/DO physicians only. Book today.',
  },
  alternates: {
    canonical: 'https://booking.trymoonlit.com/university-of-utah-employees',
  },
}

export default function UniversityOfUtahLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
