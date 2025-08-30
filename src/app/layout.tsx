// src/app/layout.tsx
import { AuthProvider } from '@/contexts/AuthContext'
import { ProviderModalProvider } from '@/contexts/ProviderModalContext'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import ProviderModal from '@/components/shared/ProviderModal'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Moonlit Psychiatry - Professional Psychiatric Care',
    description: 'We only work with physicians with the best training — both in medicine and in bedside manner. Book your telehealth appointment today.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <ProviderModalProvider>
                        <div className="min-h-screen flex flex-col">
                            <Header />
                            <main className="flex-grow pt-16">
                                {children}
                            </main>
                            <Footer />
                        </div>
                        <ProviderModal />
                    </ProviderModalProvider>
                </AuthProvider>
            </body>
        </html>
    )
}