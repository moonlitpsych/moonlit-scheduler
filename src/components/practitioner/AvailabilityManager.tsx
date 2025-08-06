// src/app/practitioner/dashboard/page.tsx
'use client'

import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AvailabilityManager from '@/components/practitioner/AvailabilityManager'
import { useAuth } from '@/contexts/AuthContext'
import { Calendar, Clock, Home, LogOut, Settings, User, Users } from 'lucide-react'
import { useState } from 'react'

export default function PractitionerDashboard() {
    const { user, profile, signOut } = useAuth()
    const [activeTab, setActiveTab] = useState('overview')

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
                {/* Header */}
                <header className="bg-white shadow-sm border-b border-stone-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex justify-between items-center h-16">
                            <div className="flex items-center">
                                <h1 className="text-xl font-semibold text-[#091747] font-['Newsreader']">
                                    Moonlit Practitioner Portal
                                </h1>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-[#091747]/70">
                                    {user?.email}
                                </span>
                                <button
                                    onClick={signOut}
                                    className="flex items-center gap-2 text-sm text-[#091747]/70 hover:text-[#091747] transition-colors"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Welcome Section */}
                    <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
                        <h2 className="text-2xl font-bold text-[#091747] mb-2 font-['Newsreader']">
                            Welcome back, {profile?.providers?.first_name || 'Doctor'}!
                        </h2>
                        <p className="text-[#091747]/70 font-['Newsreader']">
                            Manage your schedule and availability from your dashboard
                        </p>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="bg-white rounded-xl shadow-sm mb-6">
                        <nav className="flex border-b border-stone-200">
                            {[
                                { id: 'overview', label: 'Overview', icon: Home },
                                { id: 'availability', label: 'Availability', icon: Clock },
                                { id: 'appointments', label: 'Appointments', icon: Calendar },
                                { id: 'patients', label: 'Patients', icon: Users },
                                { id: 'profile', label: 'Profile', icon: User },
                                { id: 'settings', label: 'Settings', icon: Settings },
                            ].map((tab) => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`
                                            flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors
                                            ${activeTab === tab.id
                                                ? 'text-[#BF9C73] border-b-2 border-[#BF9C73]'
                                                : 'text-[#091747]/60 hover:text-[#091747]'
                                            }
                                        `}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                )
                            })}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="bg-white rounded-xl shadow-sm p-6">
                        {activeTab === 'overview' && (
                            <div>
                                <h3 className="text-lg font-semibold text-[#091747] mb-6 font-['Newsreader']">
                                    Quick Overview
                                </h3>
                                
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                                    <div className="bg-gradient-to-br from-[#F6B398]/20 to-[#F6B398]/10 rounded-lg p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-[#091747]/70 mb-1">Today's Appointments</p>
                                                <p className="text-2xl font-bold text-[#091747]">5</p>
                                            </div>
                                            <Calendar className="w-8 h-8 text-[#BF9C73]" />
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gradient-to-br from-[#F6B398]/20 to-[#F6B398]/10 rounded-lg p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-[#091747]/70 mb-1">This Week</p>
                                                <p className="text-2xl font-bold text-[#091747]">23</p>
                                            </div>
                                            <Users className="w-8 h-8 text-[#BF9C73]" />
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gradient-to-br from-[#F6B398]/20 to-[#F6B398]/10 rounded-lg p-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm text-[#091747]/70 mb-1">Next Available</p>
                                                <p className="text-2xl font-bold text-[#091747]">2:30 PM</p>
                                            </div>
                                            <Clock className="w-8 h-8 text-[#BF9C73]" />
                                        </div>
                                    </div>
                                </div>

                                {/* Profile Info */}
                                <h4 className="text-md font-semibold text-[#091747] mb-4 font-['Newsreader']">
                                    Your Profile Information
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-medium text-[#091747]/70 mb-1">
                                            Name
                                        </label>
                                        <p className="text-[#091747]">
                                            {profile?.providers?.first_name} {profile?.providers?.last_name}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#091747]/70 mb-1">
                                            Title
                                        </label>
                                        <p className="text-[#091747]">
                                            {profile?.providers?.title || 'Not set'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#091747]/70 mb-1">
                                            Languages
                                        </label>
                                        <p className="text-[#091747]">
                                            {profile?.providers?.languages_spoken?.join(', ') || 'English'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-[#091747]/70 mb-1">
                                            Telehealth Enabled
                                        </label>
                                        <p className="text-[#091747]">
                                            {profile?.providers?.telehealth_enabled ? 'Yes' : 'No'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'availability' && (
                            <div>
                                <h3 className="text-lg font-semibold text-[#091747] mb-6 font-['Newsreader']">
                                    Manage Your Availability
                                </h3>
                                <AvailabilityManager providerId={profile?.provider_id || ''} />
                            </div>
                        )}

                        {activeTab === 'appointments' && (
                            <div>
                                <h3 className="text-lg font-semibold text-[#091747] mb-6 font-['Newsreader']">
                                    Your Appointments
                                </h3>
                                <div className="bg-[#F6B398]/10 border border-[#BF9C73]/30 rounded-lg p-6">
                                    <p className="text-[#091747]/70">
                                        Appointment management coming soon. You'll be able to view and manage all your upcoming appointments here.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'patients' && (
                            <div>
                                <h3 className="text-lg font-semibold text-[#091747] mb-6 font-['Newsreader']">
                                    Patient List
                                </h3>
                                <div className="bg-[#F6B398]/10 border border-[#BF9C73]/30 rounded-lg p-6">
                                    <p className="text-[#091747]/70">
                                        Patient roster coming soon. You'll be able to view your patient list and notes here.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div>
                                <h3 className="text-lg font-semibold text-[#091747] mb-6 font-['Newsreader']">
                                    Edit Your Profile
                                </h3>
                                <div className="bg-[#F6B398]/10 border border-[#BF9C73]/30 rounded-lg p-6">
                                    <p className="text-[#091747]/70">
                                        Profile editing coming soon. You'll be able to update your professional information, bio, and profile photo here.
                                    </p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div>
                                <h3 className="text-lg font-semibold text-[#091747] mb-6 font-['Newsreader']">
                                    Account Settings
                                </h3>
                                <div className="space-y-6">
                                    <div className="border-b border-stone-200 pb-6">
                                        <h4 className="text-md font-semibold text-[#091747] mb-4">
                                            Notification Preferences
                                        </h4>
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-3">
                                                <input type="checkbox" className="w-4 h-4 text-[#BF9C73] rounded" defaultChecked />
                                                <span className="text-sm text-[#091747]">Email notifications for new appointments</span>
                                            </label>
                                            <label className="flex items-center gap-3">
                                                <input type="checkbox" className="w-4 h-4 text-[#BF9C73] rounded" defaultChecked />
                                                <span className="text-sm text-[#091747]">SMS reminders for appointments</span>
                                            </label>
                                            <label className="flex items-center gap-3">
                                                <input type="checkbox" className="w-4 h-4 text-[#BF9C73] rounded" />
                                                <span className="text-sm text-[#091747]">Weekly schedule summary</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-md font-semibold text-[#091747] mb-4">
                                            Security
                                        </h4>
                                        <button className="bg-[#BF9C73] hover:bg-[#A88861] text-white px-4 py-2 rounded-lg transition-colors">
                                            Change Password
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    )
}