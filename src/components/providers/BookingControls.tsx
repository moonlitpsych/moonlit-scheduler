'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { BookingSettings } from '@/services/providerAvailabilityService';
import {
    Bell,
    Building2,
    Calendar,
    Settings,
    Shield,
    Users,
    Video,
    X
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface BookingControlsProps {
  providerId: string;
  settings: BookingSettings | null;
  onSettingsChange: (settings: BookingSettings) => void;
}

export default function BookingControls({ 
  providerId, 
  settings, 
  onSettingsChange 
}: BookingControlsProps) {
  const [localSettings, setLocalSettings] = useState<BookingSettings>(
    settings || getDefaultSettings(providerId)
  );

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const updateSetting = (key: keyof BookingSettings, value: any) => {
    const newSettings = { ...localSettings, [key]: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const addAppointmentType = (type: string) => {
    if (type && !localSettings.new_patient_appointment_types.includes(type)) {
      updateSetting('new_patient_appointment_types', [
        ...localSettings.new_patient_appointment_types,
        type
      ]);
    }
  };

  const removeAppointmentType = (type: string) => {
    updateSetting(
      'new_patient_appointment_types',
      localSettings.new_patient_appointment_types.filter(t => t !== type)
    );
  };

  return (
    <div className="grid gap-6">
      {/* Appointment Capacity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#BF9C73]" />
            Appointment Capacity
          </CardTitle>
          <CardDescription>
            Control how many appointments can be booked per day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="max-daily">
              Maximum Daily Appointments: {localSettings.max_daily_appointments}
            </Label>
            <Slider
              id="max-daily"
              min={1}
              max={50}
              step={1}
              value={[localSettings.max_daily_appointments]}
              onValueChange={(value) => updateSetting('max_daily_appointments', value[0])}
              className="w-full"
            />
            <p className="text-sm text-gray-500">
              Limit the total number of appointments that can be scheduled per day
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buffer-time">
                Buffer Between Appointments (minutes)
              </Label>
              <Select
                value={localSettings.booking_buffer_minutes.toString()}
                onValueChange={(value) => updateSetting('booking_buffer_minutes', parseInt(value))}
              >
                <SelectTrigger id="buffer-time">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">No buffer</SelectItem>
                  <SelectItem value="5">5 minutes</SelectItem>
                  <SelectItem value="10">10 minutes</SelectItem>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="emergency-slots">
                Emergency Slots per Day
              </Label>
              <Input
                id="emergency-slots"
                type="number"
                min="0"
                max="10"
                value={localSettings.emergency_slots_per_day}
                onChange={(e) => updateSetting('emergency_slots_per_day', parseInt(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Windows */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#BF9C73]" />
            Booking Windows
          </CardTitle>
          <CardDescription>
            Set how far in advance patients can book appointments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="advance-booking">
                Advance Booking (days)
              </Label>
              <Input
                id="advance-booking"
                type="number"
                min="1"
                max="365"
                value={localSettings.advance_booking_days}
                onChange={(e) => updateSetting('advance_booking_days', parseInt(e.target.value))}
              />
              <p className="text-sm text-gray-500">
                How far in advance can appointments be booked
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-notice">
                Minimum Notice (hours)
              </Label>
              <Input
                id="minimum-notice"
                type="number"
                min="0"
                max="72"
                value={localSettings.minimum_notice_hours}
                onChange={(e) => updateSetting('minimum_notice_hours', parseInt(e.target.value))}
              />
              <p className="text-sm text-gray-500">
                Minimum time before an appointment can be booked
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="cancellation-notice">
              Cancellation Notice Required (hours)
            </Label>
            <Input
              id="cancellation-notice"
              type="number"
              min="0"
              max="72"
              value={localSettings.cancellation_notice_hours}
              onChange={(e) => updateSetting('cancellation_notice_hours', parseInt(e.target.value))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allow-cancellation">Allow Patient Cancellation</Label>
              <p className="text-sm text-gray-500">
                Patients can cancel their own appointments
              </p>
            </div>
            <Switch
              id="allow-cancellation"
              checked={localSettings.allow_patient_cancellation}
              onCheckedChange={(checked) => updateSetting('allow_patient_cancellation', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Appointment Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#BF9C73]" />
            Appointment Types
          </CardTitle>
          <CardDescription>
            Configure which types of appointments you offer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-blue-500" />
                <div>
                  <Label>Telehealth</Label>
                  <p className="text-sm text-gray-500">Virtual appointments</p>
                </div>
              </div>
              <Switch
                checked={localSettings.telehealth_enabled}
                onCheckedChange={(checked) => updateSetting('telehealth_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-green-500" />
                <div>
                  <Label>In-Person</Label>
                  <p className="text-sm text-gray-500">Office visits</p>
                </div>
              </div>
              <Switch
                checked={localSettings.in_person_enabled}
                onCheckedChange={(checked) => updateSetting('in_person_enabled', checked)}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>New Patient Appointment Types</Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add type..."
                  className="w-40"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addAppointmentType((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {localSettings.new_patient_appointment_types.map((type) => (
                <Badge key={type} variant="secondary" className="gap-1">
                  {type}
                  <X
                    className="w-3 h-3 cursor-pointer hover:text-red-500"
                    onClick={() => removeAppointmentType(type)}
                  />
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Booking Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#BF9C73]" />
            Booking Scenarios
          </CardTitle>
          <CardDescription>
            Control who can book appointments (Moonlit's unique three-scenario system)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Self-Booking Patients</Label>
                <p className="text-sm text-gray-500">
                  Patients can book their own appointments directly
                </p>
              </div>
              <Switch
                checked={localSettings.self_booking_enabled}
                onCheckedChange={(checked) => updateSetting('self_booking_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Third-Party Referrals</Label>
                <p className="text-sm text-gray-500">
                  External sources can book on behalf of patients
                </p>
              </div>
              <Switch
                checked={localSettings.third_party_booking_enabled}
                onCheckedChange={(checked) => updateSetting('third_party_booking_enabled', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <Label>Case Manager Bookings</Label>
                <p className="text-sm text-gray-500">
                  Case managers with ongoing care responsibility
                </p>
              </div>
              <Switch
                checked={localSettings.case_manager_booking_enabled}
                onCheckedChange={(checked) => updateSetting('case_manager_booking_enabled', checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification & Confirmations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#BF9C73]" />
            Verification & Confirmations
          </CardTitle>
          <CardDescription>
            Manage appointment confirmations and insurance verification
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-confirm">Auto-Confirm Appointments</Label>
              <p className="text-sm text-gray-500">
                Automatically confirm appointments without manual review
              </p>
            </div>
            <Switch
              id="auto-confirm"
              checked={localSettings.auto_confirm_appointments}
              onCheckedChange={(checked) => updateSetting('auto_confirm_appointments', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="insurance-verify">Require Insurance Verification</Label>
              <p className="text-sm text-gray-500">
                Verify insurance eligibility before confirming appointments
              </p>
            </div>
            <Switch
              id="insurance-verify"
              checked={localSettings.require_insurance_verification}
              onCheckedChange={(checked) => updateSetting('require_insurance_verification', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="new-patients">Accepting New Patients</Label>
              <p className="text-sm text-gray-500">
                Allow new patients to book appointments
              </p>
            </div>
            <Switch
              id="new-patients"
              checked={localSettings.accepts_new_patients}
              onCheckedChange={(checked) => updateSetting('accepts_new_patients', checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function getDefaultSettings(providerId: string): BookingSettings {
  return {
    provider_id: providerId,
    max_daily_appointments: 20,
    booking_buffer_minutes: 15,
    advance_booking_days: 90,
    minimum_notice_hours: 24,
    telehealth_enabled: true,
    in_person_enabled: true,
    emergency_slots_per_day: 2,
    emergency_slot_duration_minutes: 30,
    self_booking_enabled: true,
    third_party_booking_enabled: true,
    case_manager_booking_enabled: true,
    accepts_new_patients: true,
    new_patient_appointment_types: ['initial_consultation', 'follow_up', 'medication_management'],
    cancellation_notice_hours: 24,
    allow_patient_cancellation: true,
    auto_confirm_appointments: false,
    require_insurance_verification: true
  };
}