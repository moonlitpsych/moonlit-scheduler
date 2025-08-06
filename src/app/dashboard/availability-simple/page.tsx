'use client';
import ProviderAvailabilityManager from '@/components/providers/ProviderAvailabilityManager';
import QuickProviderSelector from '@/components/providers/QuickProviderSelector';
import { User } from 'lucide-react';
import { useState } from 'react';

export default function SimpleAvailabilityPage() {
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedProviderName, setSelectedProviderName] = useState<string>('');

  const handleProviderSelect = (providerId: string, providerName: string) => {
    setSelectedProviderId(providerId);
    setSelectedProviderName(providerName);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Provider Selector */}
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <QuickProviderSelector 
            onProviderSelect={handleProviderSelect}
            currentProviderId={selectedProviderId}
          />
        </div>

        {/* Availability Manager */}
        {selectedProviderId ? (
          <ProviderAvailabilityManager
            providerId={selectedProviderId}
            providerName={selectedProviderName}
          />
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <User className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">
              Please select a provider to manage their availability
            </p>
          </div>
        )}
      </div>
    </div>
  );
}