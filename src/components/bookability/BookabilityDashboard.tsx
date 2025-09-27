'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BarChart3, HeartHandshake, Users, FileSpreadsheet } from 'lucide-react'

interface BookabilityDashboardProps {
  basePath: string
  isReadOnly?: boolean
  children: React.ReactNode
}

export default function BookabilityDashboard({
  basePath,
  isReadOnly = false,
  children
}: BookabilityDashboardProps) {
  const pathname = usePathname()
  const router = useRouter()

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: FileSpreadsheet,
      path: basePath,
      description: 'All provider-payer relationships'
    },
    {
      id: 'health',
      label: 'Health',
      icon: HeartHandshake,
      path: `${basePath}/health`,
      description: isReadOnly ? 'Coverage insights and alerts' : 'Critical issues and alerts'
    },
    {
      id: 'coverage',
      label: 'Coverage',
      icon: Users,
      path: `${basePath}/coverage`,
      description: 'Provider and payer coverage views'
    }
  ]

  const activeTab = tabs.find(tab => pathname === tab.path)?.id || 'overview'

  const handleTabChange = (tabPath: string) => {
    router.push(tabPath)
  }

  return (
    <div className="p-6 max-w-full">
      {/* Main Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
          {isReadOnly ? 'My Network & Coverage' : 'Provider ↔ Payer Bookability'}
        </h1>
        <p className="text-[#091747]/60 mt-1">
          {isReadOnly
            ? 'View your network relationships and coverage status'
            : 'Monitor and manage all bookable provider-payer relationships'
          }
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-stone-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.path)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-[#BF9C73] text-[#BF9C73]'
                      : 'border-transparent text-[#091747]/60 hover:text-[#091747] hover:border-stone-300'
                  }`}
                >
                  <Icon className={`mr-2 h-5 w-5 ${
                    isActive
                      ? 'text-[#BF9C73]'
                      : 'text-[#091747]/40 group-hover:text-[#091747]/60'
                  }`} />
                  <div className="text-left">
                    <div className="font-medium">{tab.label}</div>
                    <div className={`text-xs ${
                      isActive
                        ? 'text-[#BF9C73]/70'
                        : 'text-[#091747]/40 group-hover:text-[#091747]/60'
                    }`}>
                      {tab.description}
                    </div>
                  </div>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[600px]">
        {children}
      </div>

      {/* Read-only Notice for Practitioners */}
      {isReadOnly && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-sm text-blue-800">
            <strong>Read-Only View:</strong> This dashboard provides visibility into your network relationships
            and coverage status. For changes to contracts or network status, please contact your administrator.
          </div>
        </div>
      )}
    </div>
  )
}