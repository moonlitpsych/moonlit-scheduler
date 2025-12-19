// src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext'
import { ProviderModalProvider } from '@/contexts/ProviderModalContext'
import { ConditionalLayout } from '@/components/layout/ConditionalLayout'
import ProviderModal from '@/components/shared/ProviderModal'
import { LocalBusinessStructuredData } from '@/components/seo/StructuredData'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: {
        default: 'Moonlit Psychiatry | MD/DO Psychiatrists in Utah',
        template: '%s | Moonlit Psychiatry'
    },
    description: 'Fast, telehealth psychiatry across Utah and Idaho. MD/DO physicians only. In-network with HMHI-BHN, Regence, SelectHealth, Medicaid, and more. Evening & weekend appointments available.',
    keywords: [
        'psychiatrist utah',
        'psychiatrist salt lake city',
        'telehealth psychiatry utah',
        'HMHI-BHN psychiatrist',
        'psychiatrist regence utah',
        'university of utah employee psychiatrist',
        'online psychiatrist utah',
        'psychiatrist accepting new patients utah'
    ],
    authors: [{ name: 'Moonlit Psychiatry' }],
    creator: 'Moonlit Psychiatry',
    publisher: 'Moonlit Psychiatry',
    openGraph: {
        title: 'Moonlit Psychiatry | MD/DO Psychiatrists in Utah',
        description: 'Fast, telehealth psychiatry across Utah and Idaho. MD/DO physicians only. In-network with major insurance plans.',
        url: 'https://booking.trymoonlit.com',
        siteName: 'Moonlit Psychiatry',
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Moonlit Psychiatry',
        description: 'Fast, telehealth psychiatry. MD/DO physicians only.',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <head>
                <LocalBusinessStructuredData />
            </head>
            <body className={inter.className}>
                <AuthProvider>
                    <ProviderModalProvider>
                        <div className="min-h-screen flex flex-col">
                            <ConditionalLayout>
                                {children}
                            </ConditionalLayout>
                        </div>
                        <ProviderModal />
                    </ProviderModalProvider>
                </AuthProvider>
            </body>
        </html>
    )
}