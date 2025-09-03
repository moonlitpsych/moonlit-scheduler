// Partner Dashboard Statistics Component
'use client'

interface DashboardStatsProps {
  stats: {
    total_patients: number
    active_patients: number
    appointments_this_week: number
    pending_changes: number
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
      textColor: 'text-moonlit-navy'
    },
    {
      title: 'Active Patients',
      value: stats.active_patients,
      icon: '✅',
      description: 'Currently active patient relationships',
      color: 'bg-moonlit-peach/20 border-moonlit-peach/40',
      textColor: 'text-moonlit-navy'
    },
    {
      title: 'This Week\'s Appointments',
      value: stats.appointments_this_week,
      icon: '📅',
      description: 'Appointments scheduled this week',
      color: 'bg-moonlit-brown/10 border-moonlit-brown/30',
      textColor: 'text-moonlit-brown'
    },
    {
      title: 'Pending Changes',
      value: stats.pending_changes,
      icon: '⏳',
      description: 'Change requests awaiting approval',
      color: 'bg-moonlit-orange/10 border-moonlit-orange/30',
      textColor: 'text-moonlit-orange'
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, index) => (
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <div 
          key={index}
          className={`bg-white rounded-lg border-2 ${stat.color} p-6 transition-all hover:shadow-md`}
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

          {/* Alert for pending changes */}
          {stat.title === 'Pending Changes' && stats.pending_changes > 0 && (
            <div className="mt-3 text-xs text-moonlit-orange bg-moonlit-orange/10 rounded-full px-3 py-1 text-center font-['Newsreader']">
              {stats.pending_changes > 5 ? 'High priority' : 'Review needed'}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}