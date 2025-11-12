/**
 * StatsCards Component
 *
 * Displays patient roster statistics in card format.
 * Adapts to different user roles (partner, provider, admin).
 */

import { Users, Activity, Calendar, CheckCircle, Building2, UserCheck } from 'lucide-react'
import { RosterStats, UserRole } from '@/types/patient-roster'

interface StatsCardsProps {
  stats: RosterStats
  userType: UserRole
}

export function StatsCards({ stats, userType }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Patients - All roles */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 font-['Newsreader']">
              Total Patients
            </p>
            <p className="text-2xl font-bold text-moonlit-navy mt-1">{stats.total}</p>
          </div>
          <Users className="w-8 h-8 text-moonlit-brown" />
        </div>
      </div>

      {/* Active Patients - All roles */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 font-['Newsreader']">Active</p>
            <p className="text-2xl font-bold text-moonlit-navy mt-1">{stats.active}</p>
          </div>
          <Activity className="w-8 h-8 text-green-600" />
        </div>
      </div>

      {/* No Future Appointment - All roles */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 font-['Newsreader']">
              No Future Appt
            </p>
            <p className="text-2xl font-bold text-moonlit-navy mt-1">
              {stats.no_future_appointment}
            </p>
          </div>
          <Calendar className="w-8 h-8 text-orange-600" />
        </div>
      </div>

      {/* Role-specific fourth card */}
      {userType === 'partner' && stats.assigned_to_me !== undefined && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 font-['Newsreader']">
                Assigned to Me
              </p>
              <p className="text-2xl font-bold text-moonlit-navy mt-1">
                {stats.assigned_to_me}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-blue-600" />
          </div>
        </div>
      )}

      {userType === 'provider' && stats.with_case_management !== undefined && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 font-['Newsreader']">
                Case Management
              </p>
              <p className="text-2xl font-bold text-moonlit-navy mt-1">
                {stats.with_case_management}
              </p>
            </div>
            <UserCheck className="w-8 h-8 text-purple-600" />
          </div>
        </div>
      )}

      {userType === 'admin' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 font-['Newsreader']">
                With Organizations
              </p>
              <p className="text-2xl font-bold text-moonlit-navy mt-1">
                {stats.with_organizations || 0}
              </p>
            </div>
            <Building2 className="w-8 h-8 text-indigo-600" />
          </div>
        </div>
      )}
    </div>
  )
}
