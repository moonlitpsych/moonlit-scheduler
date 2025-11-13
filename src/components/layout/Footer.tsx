'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
    const currentYear = new Date().getFullYear()
    const bookNavPath = process.env.NEXT_PUBLIC_BOOK_NAV_PATH || '/book-now'

    return (
        <footer 
            className="relative text-[#091747] bg-cover bg-center bg-no-repeat min-h-[200px]"
            style={{
                backgroundImage: 'url("/images/moonlit-footer-background.png")',
                backgroundSize: 'cover',
                backgroundPosition: 'center bottom',
                backgroundRepeat: 'no-repeat'
            }}
        >
            {/* Background overlay for better text readability */}
            <div className="absolute inset-0 bg-[#FEF8F1]/20"></div>
            
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Logo and Navigation */}
                    <div>
                        <Image
                            src="/images/MOONLIT-LOGO-WITH-TITLE.png"
                            alt="Moonlit Psychiatry"
                            width={200}
                            height={60}
                            className="h-8 w-auto mb-4"
                        />
                        
                        <nav className="flex flex-col space-y-0">
                            <Link href={bookNavPath} className="text-[#091747] hover:text-[#BF9C73] font-['Newsreader'] transition-colors leading-tight">
                                see a psychiatrist
                            </Link>
                            <Link href={`${bookNavPath}?scenario=case-manager`} className="text-[#091747] hover:text-[#BF9C73] font-['Newsreader'] transition-colors leading-tight">
                                refer someone
                            </Link>
                            <Link href="/ways-to-pay" className="text-[#091747] hover:text-[#BF9C73] font-['Newsreader'] transition-colors leading-tight">
                                how to pay
                            </Link>
                        </nav>
                    </div>

                    {/* Contact Information */}
                    <div>
                        <div className="space-y-1">
                            <div>
                                <p className="text-[#091747] font-['Newsreader'] leading-snug">
                                    Leave us a message<br />
                                    and we'll get back to you:
                                </p>
                                <p className="text-[#091747] font-['Newsreader'] mt-1">
                                    (385) 246-2522
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    )
}