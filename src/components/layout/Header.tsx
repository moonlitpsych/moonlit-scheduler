'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

export default function Header() {
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY
            setScrolled(scrollTop > 50)
        }

        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const navigation = [
        { name: 'Our practitioners', href: '/providers' },
        { name: 'Ways to pay', href: '/insurance' },
        { name: 'About', href: '/about' }
    ]

    return (
        <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
            scrolled 
                ? 'bg-gradient-to-b from-[#FEF8F1] to-[#FEF8F1]/20 backdrop-blur-sm shadow-lg' 
                : 'bg-[#FEF8F1] shadow-sm'
        }`}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/images/MOONLIT-LOGO-WITH-TITLE.png"
                            alt="Moonlit Psychiatry"
                            width={200}
                            height={60}
                            className="h-10 w-auto"
                            priority
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-8" role="navigation" aria-label="Main navigation">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className="text-[#091747] hover:text-[#BF9C73] font-['Newsreader'] transition-all duration-200 py-2 px-3 rounded-lg hover:bg-[#BF9C73]/5 focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20"
                            >
                                {item.name}
                            </Link>
                        ))}
                        
                        {/* Enhanced CTA Button */}
                        <Link
                            href="/book"
                            className="bg-[#BF9C73] hover:bg-[#A8865F] text-white px-6 py-3 rounded-xl font-['Newsreader'] transition-all duration-200 hover:shadow-lg hover:scale-[1.02] focus:outline-none focus:ring-4 focus:ring-[#BF9C73]/20"
                            aria-label="Start booking your appointment"
                        >
                            Book now
                        </Link>
                    </nav>

                    {/* Mobile menu button */}
                    <div className="md:hidden">
                        <button
                            type="button"
                            className="text-[#091747] hover:text-[#BF9C73] transition-all duration-200 p-2 rounded-lg hover:bg-[#BF9C73]/5 focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20"
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            aria-expanded={isMenuOpen}
                            aria-controls="mobile-menu"
                            aria-label={isMenuOpen ? "Close main menu" : "Open main menu"}
                        >
                            {isMenuOpen ? (
                                <X className="h-6 w-6" />
                            ) : (
                                <Menu className="h-6 w-6" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Menu */}
            {isMenuOpen && (
                <div className="md:hidden" id="mobile-menu">
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-[#FEF8F1] border-t border-gray-100 shadow-lg">
                        {navigation.map((item) => (
                            <Link
                                key={item.name}
                                href={item.href}
                                className="block px-3 py-3 text-[#091747] hover:text-[#BF9C73] hover:bg-[#BF9C73]/5 font-['Newsreader'] transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                {item.name}
                            </Link>
                        ))}
                        <Link
                            href="/book"
                            className="block mx-3 mt-4 bg-[#BF9C73] hover:bg-[#A8865F] text-white px-6 py-3 rounded-xl font-['Newsreader'] text-center transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#BF9C73]/20"
                            onClick={() => setIsMenuOpen(false)}
                            aria-label="Start booking your appointment"
                        >
                            Book now
                        </Link>
                    </div>
                </div>
            )}
        </header>
    )
}