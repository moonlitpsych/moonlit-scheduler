import {
    BarChart3,
    Calendar,
    CalendarDays,
    ChevronRight,
    Clock,
    FileText,
    Home,
    LogOut,
    Settings,
    User,
    Users,
    Video
} from 'lucide-react';
import React, { useState } from 'react';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  section?: string;
}

interface SidebarProps {
  currentPath?: string;
  userRole?: 'admin' | 'practitioner' | 'psychiatrist' | 'psychiatry_resident';
  userName?: string;
  onLogout?: () => void;
}

const DashboardSidebar: React.FC<SidebarProps> = ({ 
  currentPath = '/dashboard', 
  userRole = 'practitioner',
  userName = 'Dr. Norseth',
  onLogout
}) => {
  const [activeItem, setActiveItem] = useState(currentPath);

  const navigationItems: NavigationItem[] = [
    // Main Dashboard
    { id: 'dashboard', label: 'Dashboard', icon: Home, href: '/dashboard' },
    
    // Scheduling Section
    { id: 'availability', label: 'My Availability', icon: Calendar, href: '/dashboard/availability', section: 'scheduling' },
    { id: 'calendar', label: 'My Calendar', icon: CalendarDays, href: '/dashboard/calendar', section: 'scheduling' },
    { id: 'exceptions', label: 'Schedule Exceptions', icon: Clock, href: '/dashboard/exceptions', section: 'scheduling' },
    
    // Clinical Work Section
    { id: 'appointments', label: 'Appointments', icon: Calendar, href: '/dashboard/appointments', section: 'clinical' },
    { id: 'patients', label: 'Patient Records', icon: Users, href: '/dashboard/patients', section: 'clinical' },
    { id: 'notes', label: 'Clinical Notes', icon: FileText, href: '/dashboard/notes', section: 'clinical' },
    { id: 'visits', label: 'Virtual Visits', icon: Video, href: '/dashboard/visits', section: 'clinical' },
    
    // Personal Profile Section
    { id: 'profile', label: 'Edit Profile', icon: User, href: '/dashboard/profile', section: 'profile' },
    { id: 'settings', label: 'Account Settings', icon: Settings, href: '/dashboard/settings', section: 'profile' },
    
    // Admin Section (if admin role)
    ...(userRole === 'admin' ? [
      { id: 'providers', label: 'Manage Providers', icon: Users, href: '/dashboard/admin/providers', section: 'admin' },
      { id: 'analytics', label: 'Practice Analytics', icon: BarChart3, href: '/dashboard/admin/analytics', section: 'admin' }
    ] : [])
  ];

  const handleNavigation = (href: string) => {
    setActiveItem(href);
    // In real implementation, this would trigger Next.js navigation
    console.log(`Navigate to: ${href}`);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      console.log('Logout clicked');
    }
  };

  const getSectionLabel = (section: string | undefined) => {
    switch (section) {
      case 'scheduling': return 'Scheduling';
      case 'profile': return 'Personal Profile';
      case 'admin': return 'Administration';
      default: return null;
    }
  };

  const renderNavigationSection = (sectionName: string | undefined) => {
    const sectionItems = navigationItems.filter(item => item.section === sectionName);
    if (sectionItems.length === 0) return null;

    const sectionLabel = getSectionLabel(sectionName);

    return (
      <div key={sectionName || 'main'} className="mb-6">
        {sectionLabel && (
          <h3 className="text-xs font-semibold text-[#BF9C73] uppercase tracking-wider mb-3 px-3">
            {sectionLabel}
          </h3>
        )}
        <nav className="space-y-1">
          {sectionItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.href;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.href)}
                className={`
                  w-full flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                  ${isActive 
                    ? 'bg-[#BF9C73] text-white shadow-sm' 
                    : 'text-[#091747] hover:bg-[#FEF8F1] hover:text-[#BF9C73]'
                  }
                `}
              >
                <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-white' : 'text-[#BF9C73]'}`} />
                {item.label}
                {isActive && <ChevronRight className="ml-auto h-4 w-4" />}
              </button>
            );
          })}
        </nav>
      </div>
    );
  };

  return (
    <div className="w-64 bg-white h-screen border-r border-[#FEF8F1] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[#FEF8F1]">
        <div className="flex items-center space-x-3">
          {/* Moonlit Logo */}
          <div className="flex-shrink-0">
            <div className="w-8 h-8 bg-[#091747] rounded-lg flex items-center justify-center">
              <div className="w-3 h-3 bg-[#BF9C73] rounded-full"></div>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#091747]" style={{ fontFamily: 'Newsreader, serif' }}>
              Provider Dashboard
            </h1>
          </div>
        </div>
      </div>

      {/* User Info */}
      <div className="p-4 border-b border-[#FEF8F1]">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-[#BF9C73] rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-sm">
              {userName.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#091747]">{userName}</p>
            <p className="text-xs text-gray-500 capitalize">{userRole.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Main Dashboard Item */}
        {renderNavigationSection(undefined)}
        
        {/* Scheduling Section */}
        {renderNavigationSection('scheduling')}
        
        {/* Profile Section */}
        {renderNavigationSection('profile')}
        
        {/* Admin Section (if applicable) */}
        {userRole === 'admin' && renderNavigationSection('admin')}
      </div>

      {/* Logout */}
      <div className="p-4 border-t border-[#FEF8F1]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all duration-200"
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

export default DashboardSidebar;