const mockProvider = {
  id: 'provider1',
  first_name: 'Alice',
  last_name: 'Smith',
  title: 'Dr',
  role: 'Physician',
  accepts_new_patients: true,
  telehealth_enabled: true,
};

jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: jest.fn(() => ({
    from: jest.fn((table: string) => {
      if (table === 'providers') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({ data: mockProvider, error: null })),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(() => Promise.resolve({ data: null, error: null })),
      };
    }),
  })),
}));

import { patientBookingAvailabilityService } from '../src/services/patientBookingAvailabilityService';

describe('patientBookingAvailabilityService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMergedAvailabilityForPayer', () => {
    it('aggregates and sorts slots from multiple providers', async () => {
      const service = patientBookingAvailabilityService as any;

      const providers = [
        { id: 'provider1', first_name: 'Alice', last_name: 'Smith' },
        { id: 'provider2', first_name: 'Bob', last_name: 'Jones' },
      ];

      jest
        .spyOn(service, 'getProvidersForPayer')
        .mockResolvedValue(providers);

      const slotsProvider1 = [
        {
          date: '2025-01-06',
          time: '12:00',
          providerId: 'provider1',
          providerName: 'Alice Smith',
          duration: 60,
          isAvailable: true,
          provider: mockProvider,
        },
        {
          date: '2025-01-06',
          time: '10:00',
          providerId: 'provider1',
          providerName: 'Alice Smith',
          duration: 60,
          isAvailable: true,
          provider: mockProvider,
        },
      ];

      const slotsProvider2 = [
        {
          date: '2025-01-05',
          time: '09:00',
          providerId: 'provider2',
          providerName: 'Bob Jones',
          duration: 60,
          isAvailable: true,
          provider: mockProvider,
        },
        {
          date: '2025-01-06',
          time: '09:00',
          providerId: 'provider2',
          providerName: 'Bob Jones',
          duration: 60,
          isAvailable: true,
          provider: mockProvider,
        },
      ];

      jest
        .spyOn(service, 'getAvailabilityForProvider')
        .mockImplementation(async (providerId: string) => {
          return providerId === 'provider1'
            ? slotsProvider1
            : slotsProvider2;
        });

      const result = await service.getMergedAvailabilityForPayer(
        'payer1',
        new Date('2025-01-05'),
        new Date('2025-01-06'),
        60,
      );

      expect(result).toHaveLength(4);
      expect(result.map((s: any) => `${s.date} ${s.time}`)).toEqual([
        '2025-01-05 09:00',
        '2025-01-06 09:00',
        '2025-01-06 10:00',
        '2025-01-06 12:00',
      ]);
    });
  });

  describe('getAvailabilityForProvider', () => {
    it('skips unavailable days and respects custom hours', async () => {
      const service = patientBookingAvailabilityService as any;

      const weeklySchedule = {
        1: { is_available: true, time_blocks: [{ start_time: '09:00', end_time: '17:00' }] },
        2: { is_available: true, time_blocks: [{ start_time: '09:00', end_time: '17:00' }] },
        3: { is_available: true, time_blocks: [{ start_time: '09:00', end_time: '17:00' }] },
      };

      jest
        .spyOn(service, 'getProviderWeeklySchedule')
        .mockResolvedValue(weeklySchedule);

      const exceptions = [
        {
          id: '1',
          exception_date: '2025-01-07',
          exception_type: 'unavailable',
        },
        {
          id: '2',
          exception_date: '2025-01-08',
          exception_type: 'custom_hours',
          start_time: '10:00',
          end_time: '12:00',
        },
      ];

      jest
        .spyOn(service, 'getProviderExceptions')
        .mockResolvedValue(exceptions);

      jest
        .spyOn(service, 'getProviderAppointments')
        .mockResolvedValue([]);

      const result = await service.getAvailabilityForProvider(
        'provider1',
        new Date('2025-01-06'),
        new Date('2025-01-08'),
        60,
      );
      const dates = result.map((r: any) => r.date);
      expect(dates).toContain('2025-01-06');
      expect(dates).not.toContain('2025-01-07');

      const wedSlots = result
        .filter((r: any) => r.date === '2025-01-08')
        .map((r: any) => r.time);
      expect(wedSlots).toEqual(['10:00', '11:15']);
    });
  });
});

