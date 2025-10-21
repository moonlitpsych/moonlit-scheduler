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
      value: stats.total_patients,
      icon: '👥',
      description: 'Patients affiliated with your organization',
      color: 'bg-moonlit-cream border-moonlit-brown/20',
      textColor: 'text-moonlit-navy',
      link: '/partner-dashboard/patients'
    },
    {
      title: 'Active Patients',
      value: stats.active_patients,
      icon: '✅',
      description: 'Patients with valid ROI consent',
      color: 'bg-moonlit-peach/20 border-moonlit-peach/40',
      textColor: 'text-moonlit-navy',
      link: '/partner-dashboard/patients'
    },
    {
      title: 'This Week\'s Appointments',
      value: stats.appointments_this_week,
      icon: '📅',
      description: 'Appointments scheduled this week',
      color: 'bg-moonlit-brown/10 border-moonlit-brown/30',
      textColor: 'text-moonlit-brown',
      link: '/partner-dashboard/patients'
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, index) => (
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

          {/* Progress indicator for some stats */}
          {stat.title === 'Active Patients' && stats.total_patients > 0 && (
            <div className="mt-4">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-moonlit-peach h-2 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${Math.min((stats.active_patients / stats.total_patients) * 100, 100)}%` 
                  }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1 font-['Newsreader']">
                {Math.round((stats.active_patients / stats.total_patients) * 100)}% of total patients
              </p>
            </div>
          )}

        </Link>
      ))}
    </div>
  )
}