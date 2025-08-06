'use client';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createClient } from '@/supabase/client';
import { User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Provider {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface QuickProviderSelectorProps {
  onProviderSelect: (providerId: string, providerName: string) => void;
  currentProviderId?: string;
}

export default function QuickProviderSelector({ 
  onProviderSelect, 
  currentProviderId 
}: QuickProviderSelectorProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      const { data, error } = await supabase
        .from('providers')
        .select('id, first_name, last_name, email')
        .order('last_name', { ascending: true });

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error loading providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      onProviderSelect(
        providerId, 
        `${provider.first_name} ${provider.last_name}`
      );
    }
  };

  if (loading) {
    return <div className="animate-pulse h-10 bg-gray-200 rounded"></div>;
  }

  return (
    <div className="flex items-center gap-3">
      <User className="w-5 h-5 text-[#BF9C73]" />
      <Label htmlFor="provider-select" className="text-sm font-medium">
        Provider:
      </Label>
      <Select value={currentProviderId} onValueChange={handleSelect}>
        <SelectTrigger id="provider-select" className="w-[250px]">
          <SelectValue placeholder="Select a provider..." />
        </SelectTrigger>
        <SelectContent>
          {providers.map((provider) => (
            <SelectItem key={provider.id} value={provider.id}>
              {provider.first_name} {provider.last_name}
              <span className="text-xs text-gray-500 ml-2">
                ({provider.email})
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}