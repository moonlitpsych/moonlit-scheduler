'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ContextSwitcher from '@/components/auth/ContextSwitcher'

export default function PractitionerHeader() {
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY
            setScrolled(scrollTop > 50)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            scrolled 
                ? 'bg-gradient-to-b from-[#FEF8F1] to-[#FEF8F1]/95 backdrop-blur-sm shadow-lg' 
                : 'bg-[#FEF8F1] shadow-sm'
        }`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo - Links to dashboard instead of homepage */}
                    <Link href="/dashboard" className="flex items-center">
                        <Image
                            src="/images/MOONLIT-LOGO-WITH-TITLE.png"
                            alt="Moonlit Psychiatry"
                            width={200}
                            height={60}
                            className="h-10 w-auto"
                            priority
                        />
                    </Link>

                    {/* Context Switcher */}
                    <div className="flex items-center">
                        <div className="bg-[#BF9C73] rounded-lg">
                            <ContextSwitcher />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}