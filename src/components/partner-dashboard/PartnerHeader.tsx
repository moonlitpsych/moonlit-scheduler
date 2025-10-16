// Partner Dashboard Header Component
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PartnerUser } from '@/types/partner-types'

interface PartnerHeaderProps {
  partnerUser: PartnerUser
  currentPage?: string
}

export function PartnerHeader({ partnerUser, currentPage }: PartnerHeaderProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  
  const getInitials = (fullName?: string) => {
    if (!fullName) return 'PU'
    const parts = fullName.trim().split(' ')
    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase()
    }
    return fullName.substring(0, 2).toUpperCase()
  }

  const isAdmin = partnerUser.role === 'partner_admin'

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Organization */}
          <div className="flex items-center space-x-4">
            <Link href="/partner-dashboard" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-moonlit-brown rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold text-sm font-['Newsreader']">M</span>
              </div>
              <div>
                <div className="text-lg font-semibold text-moonlit-navy font-['Newsreader']">
                  {partnerUser.organization?.name}
                </div>
                <div className="text-xs text-gray-500">
                  Partner Dashboard
                </div>
              </div>
            </Link>
          </div>

          {/* Navigation - Only functional pages */}
          <nav className="hidden md:flex items-center space-x-6">
            <Link
              href="/partner-dashboard"
              className={`px-3 py-2 text-sm font-medium font-['Newsreader'] rounded-md transition-colors ${
                currentPage === 'dashboard'
                  ? 'bg-moonlit-cream text-moonlit-brown'
                  : 'text-gray-600 hover:text-moonlit-navy'
              }`}
            >
              Dashboard
            </Link>

            <Link
              href="/partner-dashboard/patients"
              className={`px-3 py-2 text-sm font-medium font-['Newsreader'] rounded-md transition-colors ${
                currentPage === 'patients'
                  ? 'bg-moonlit-cream text-moonlit-brown'
                  : 'text-gray-600 hover:text-moonlit-navy'
              }`}
            >
              Patients
            </Link>
          </nav>

          {/* User Menu */}
          <div className="flex items-center">
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 bg-moonlit-navy rounded-full flex items-center justify-center">
                  <span className="text-white font-medium text-sm">
                    {getInitials(partnerUser.full_name)}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900 font-['Newsreader']">
                    {partnerUser.full_name || partnerUser.email}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {partnerUser.role.replace('partner_', '').replace('_', ' ')}
                  </div>
                </div>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <Link 
                    href="/partner-dashboard/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Profile & Settings
                  </Link>
                  <Link 
                    href="/partner-dashboard/notifications"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Notifications
                  </Link>
                  {isAdmin && (
                    <Link 
                      href="/partner-dashboard/organization"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      Organization Settings
                    </Link>
                  )}
                  <div className="border-t border-gray-100 my-2"></div>
                  <Link 
                    href="/partner-auth/logout"
                    className="block px-4 py-2 text-sm text-red-600 hover:bg-red-50 font-['Newsreader']"
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    Sign out
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Navigation - Only functional pages */}
      <div className="md:hidden border-t border-gray-200 bg-gray-50 px-4 py-2">
        <div className="flex space-x-4 overflow-x-auto">
          <Link
            href="/partner-dashboard"
            className={`px-3 py-1 text-sm font-medium font-['Newsreader'] rounded-md whitespace-nowrap ${
              currentPage === 'dashboard'
                ? 'bg-moonlit-brown text-white'
                : 'text-gray-600'
            }`}
          >
            Dashboard
          </Link>

          <Link
            href="/partner-dashboard/patients"
            className={`px-3 py-1 text-sm font-medium font-['Newsreader'] rounded-md whitespace-nowrap ${
              currentPage === 'patients'
                ? 'bg-moonlit-brown text-white'
                : 'text-gray-600'
            }`}
          >
            Patients
          </Link>
        </div>
      </div>
    </header>
  )
}