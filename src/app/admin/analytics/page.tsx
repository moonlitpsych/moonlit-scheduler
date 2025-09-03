'use client'

import { BarChart3, TrendingUp, Users, Building2 } from 'lucide-react'

export default function AdminAnalyticsPage() {
  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Analytics & Reporting
        </h1>
        <p className="text-[#091747]/70">
          Business intelligence and partnership metrics
        </p>
      </div>

      {/* Coming Soon */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-12 text-center">
        <div className="p-6 bg-[#BF9C73]/10 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <BarChart3 className="h-12 w-12 text-[#BF9C73]" />
        </div>
        <h3 className="text-2xl font-bold text-[#091747] mb-4">
          Analytics Coming Soon
        </h3>
        <p className="text-gray-600 mb-8 max-w-md mx-auto">
          Advanced analytics and reporting features are in development. 
          This will include partner pipeline metrics, conversion rates, and business intelligence dashboards.
        </p>
        
        {/* Planned Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="p-6 border border-stone-200 rounded-lg">
            <TrendingUp className="h-8 w-8 text-[#BF9C73] mx-auto mb-3" />
            <h4 className="font-semibold text-[#091747] mb-2">Pipeline Analytics</h4>
            <p className="text-sm text-gray-600">
              Track conversion rates, stage progression, and deal velocity
            </p>
          </div>
          
          <div className="p-6 border border-stone-200 rounded-lg">
            <Users className="h-8 w-8 text-[#BF9C73] mx-auto mb-3" />
            <h4 className="font-semibold text-[#091747] mb-2">User Metrics</h4>
            <p className="text-sm text-gray-600">
              Monitor partner engagement and user activity patterns
            </p>
          </div>
          
          <div className="p-6 border border-stone-200 rounded-lg">
            <Building2 className="h-8 w-8 text-[#BF9C73] mx-auto mb-3" />
            <h4 className="font-semibold text-[#091747] mb-2">Organization Reports</h4>
            <p className="text-sm text-gray-600">
              Generate comprehensive reports for stakeholders
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}