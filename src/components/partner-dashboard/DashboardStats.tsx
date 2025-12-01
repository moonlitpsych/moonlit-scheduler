// Partner Dashboard Statistics Component
'use client'

import Link from 'next/link'

interface DashboardStatsProps {
  stats: {
    total_patients: number
    active_patients: number
    appointments_this_week: number
  }
  loading?: boolean
}

export function DashboardStats({ stats, loading = false }: DashboardStatsProps) {
  const statCards = [
    {
      title: 'Total Patients',
      value: stats?.total_patients || 0,
      icon: '👥',
      description: 'Patients affiliated with your organization',
      color: 'bg-moonlit-cream border-moonlit-brown/20',
      textColor: 'text-moonlit-navy',
      link: '/partner-dashboard/patients'
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6">
        {[...Array(1)].map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="animate-pulse">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="w-12 h-12 bg-gray-200 rounded"></div>
              </div>
              <div className="w-3/4 h-4 bg-gray-200 rounded mb-2"></div>
              <div className="w-full h-3 bg-gray-200 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {statCards.map((stat, index) => (
        <Link
          key={index}
          href={stat.link}
          className={`bg-white rounded-lg border-2 ${stat.color} p-6 transition-all hover:shadow-lg cursor-pointer block`}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl">{stat.icon}</span>
            <div className={`text-3xl font-bold ${stat.textColor}`}>
              {stat.value.toLocaleString()}
            </div>
          </div>
          
          <div>
            <h3 className={`text-lg font-semibold ${stat.textColor} mb-1 font-['Newsreader']`}>
              {stat.title}
            </h3>
            <p className="text-sm text-gray-600 font-['Newsreader'] font-light">
              {stat.description}
            </p>
          </div>

        </Link>
      ))}
    </div>
  )
}