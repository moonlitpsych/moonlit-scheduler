'use client';

import ProviderAvailabilityManager from '@/components/providers/ProviderAvailabilityManager';
import { authService } from '@/services/authService';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ProviderAvailabilityPage() {
  const router = useRouter();
  const [provider, setProvider] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { user, provider } = await authService.getCurrentUser();
    
    if (!user || !provider) {
      router.push('/auth/login');
      return;
    }
    
    setProvider(provider);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await authService.signOut();
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#BF9C73] mx-auto"></div>
          <p className="mt-4 text-[#091747]/70">Loading...</p>
        </div>
      </div>
    );
  }

  if (!provider) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FEF8F1] via-[#F6B398]/20 to-[#FEF8F1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with User Info */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader']">
              Manage Your Availability
            </h1>
            <p className="mt-2 text-[#091747]/70">
              Set your weekly schedule, time off, and booking preferences.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-[#BF9C73]" />
                <span className="text-[#091747] font-semibold">
                  Dr. {provider.first_name} {provider.last_name}
                </span>
              </div>
              <p className="text-sm text-[#091747]/60">{provider.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="p-2 text-[#091747]/60 hover:text-[#091747] transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Availability Manager */}
        <ProviderAvailabilityManager 
          providerId={provider.id}
          providerName={`${provider.first_name} ${provider.last_name}`}
        />
      </div>
    </div>
  );
}