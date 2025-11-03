/**
 * X12 271 Financial Benefits Parser
 *
 * Comprehensive parser for extracting copay, deductible, coinsurance,
 * and out-of-pocket maximum information from X12 271 eligibility responses.
 *
 * This parser extracts detailed financial information to display to users
 * so they understand their financial responsibility before appointments.
 */

/**
 * X12 271 EB Segment Service Type Codes
 * https://www.stedi.com/edi/x12/segment/EB
 */
export const SERVICE_TYPE_CODES: Record<string, string> = {
  '1': 'Medical Care',
  '2': 'Surgical',
  '3': 'Consultation',
  '4': 'Diagnostic X-Ray',
  '5': 'Diagnostic Lab',
  '6': 'Radiation Therapy',
  '7': 'Anesthesia',
  '8': 'Surgical Assistance',
  '12': 'Durable Medical Equipment',
  '13': 'Ambulatory Service Center Facility',
  '14': 'Renal Supplies',
  '17': 'Pre-Admission Testing',
  '18': 'Durable Medical Equipment Purchase',
  '19': 'Durable Medical Equipment Rental',
  '20': 'Pneumonia Vaccine',
  '21': 'Second Surgical Opinion',
  '22': 'Third Surgical Opinion',
  '23': 'Social Work',
  '24': 'Diagnostic Dental',
  '25': 'Periodontics',
  '26': 'Restorative',
  '27': 'Endodontics',
  '28': 'Maxillofacial Prosthetics',
  '30': 'Health Benefit Plan Coverage',
  '33': 'Chiropractic',
  '35': 'Dental Care',
  '36': 'Dental Crowns',
  '37': 'Dental Accident',
  '38': 'Orthodontics',
  '39': 'Prosthodontics',
  '40': 'Oral Surgery',
  '41': 'Routine Preventive Dental',
  '42': 'Home Health Care',
  '43': 'Home Health Prescriptions',
  '44': 'Home Health Visits',
  '45': 'Hospice',
  '46': 'Respite Care',
  '47': 'Hospital',
  '48': 'Hospital - Inpatient',
  '49': 'Hospital - Room and Board',
  '50': 'Hospital - Outpatient',
  '51': 'Hospital - Emergency Accident',
  '52': 'Hospital - Emergency Medical',
  '53': 'Hospital - Ambulatory Surgical',
  '54': 'Long Term Care',
  '55': 'Major Medical',
  '56': 'Medically Related Transportation',
  '57': 'Air Transportation',
  '58': 'Cabulance',
  '59': 'Licensed Ambulance',
  '60': 'General Benefits',
  '61': 'In-vitro Fertilization',
  '62': 'MRI/CAT Scan',
  '63': 'Donor Procedures',
  '64': 'Acupuncture',
  '65': 'Newborn Care',
  '66': 'Pathology',
  '67': 'Smoking Cessation',
  '68': 'Well Baby Care',
  '69': 'Maternity',
  '70': 'Transplants',
  '71': 'Audiology Exam',
  '72': 'Inhalation Therapy',
  '73': 'Diagnostic Medical',
  '74': 'Private Duty Nursing',
  '75': 'Prosthetic Device',
  '76': 'Dialysis',
  '77': 'Otological Exam',
  '78': 'Chemotherapy',
  '79': 'Allergy Testing',
  '80': 'Immunizations',
  '81': 'Routine Physical',
  '82': 'Family Planning',
  '83': 'Infertility',
  '84': 'Abortion',
  '85': 'AIDS',
  '86': 'Emergency Services',
  '87': 'Cancer',
  '88': 'Pharmacy',
  '89': 'Free Standing Prescription Drug',
  '90': 'Mail Order Prescription Drug',
  '91': 'Brand Name Prescription Drug',
  '92': 'Generic Prescription Drug',
  '93': 'Podiatry',
  '94': 'Podiatry - Office Visits',
  '95': 'Podiatry - Nursing Home Visits',
  '96': 'Professional (Physician)',
  '97': 'Anesthetist',
  '98': 'Professional (Physician) Visit - Office',
  '99': 'Professional (Physician) Visit - Inpatient',
  'A0': 'Professional (Physician) Visit - Outpatient',
  'A1': 'Professional (Physician) Visit - Nursing Home',
  'A2': 'Professional (Physician) Visit - Skilled Nursing Facility',
  'A3': 'Professional (Physician) Visit - Home',
  'A4': 'Psychiatric',
  'A5': 'Psychiatric - Room and Board',
  'A6': 'Psychotherapy',
  'A7': 'Psychiatric - Inpatient',
  'A8': 'Psychiatric - Outpatient',
  'A9': 'Rehabilitation',
  'AA': 'Rehabilitation - Room and Board',
  'AB': 'Rehabilitation - Inpatient',
  'AC': 'Rehabilitation - Outpatient',
  'AD': 'Occupational Therapy',
  'AE': 'Physical Medicine',
  'AF': 'Speech Therapy',
  'AG': 'Skilled Nursing Care',
  'AH': 'Skilled Nursing Care - Room and Board',
  'AI': 'Substance Abuse',
  'AJ': 'Alcoholism',
  'AK': 'Drug Addiction',
  'AL': 'Vision (Optometry)',
  'AM': 'Frames',
  'AN': 'Routine Exam',
  'AO': 'Lenses',
  'AQ': 'Nonmedically Necessary Physical',
  'AR': 'Experimental Drug Therapy',
  'B1': 'Burn Care',
  'B2': 'Brand Name Prescription Drug - Formulary',
  'B3': 'Brand Name Prescription Drug - Non-Formulary',
  'BA': 'Independent Medical Evaluation',
  'BB': 'Partial Hospitalization (Psychiatric)',
  'BC': 'Day Care (Psychiatric)',
  'BD': 'Cognitive Therapy',
  'BE': 'Massage Therapy',
  'BF': 'Pulmonary Rehabilitation',
  'BG': 'Cardiac Rehabilitation',
  'BH': 'Pediatric',
  'BI': 'Nursery',
  'BJ': 'Skin',
  'BK': 'Orthopedic',
  'BL': 'Cardiac',
  'BM': 'Lymphatic',
  'BN': 'Gastrointestinal',
  'BP': 'Endocrine',
  'BQ': 'Neurology',
  'BR': 'Eye',
  'BS': 'Invasive Procedures',
  'BT': 'Gynecological',
  'BU': 'Obstetrical',
  'BV': 'Obstetrical/Gynecological',
  'BW': 'Mail Order Prescription Drug: Brand Name',
  'BX': 'Mail Order Prescription Drug: Generic',
  'BY': 'Physician Visit - Office: Sick',
  'BZ': 'Physician Visit - Office: Well',
  'C1': 'Coronary Care',
  'CA': 'Private Duty Nursing - Inpatient',
  'CB': 'Private Duty Nursing - Home',
  'CC': 'Surgical Benefits - Professional (Physician)',
  'CD': 'Surgical Benefits - Facility',
  'CE': 'Mental Health Provider - Inpatient',
  'CF': 'Mental Health Provider - Outpatient',
  'CG': 'Mental Health Facility - Inpatient',
  'CH': 'Mental Health Facility - Outpatient',
  'CI': 'Substance Abuse Facility - Inpatient',
  'CJ': 'Substance Abuse Facility - Outpatient',
  'CK': 'Screening X-ray',
  'CL': 'Screening laboratory',
  'CM': 'Mammogram, High Risk Patient',
  'CN': 'Mammogram, Low Risk Patient',
  'CO': 'Flu Vaccination',
  'CP': 'Eyewear and Eyewear Accessories',
  'CQ': 'Case Management',
  'DG': 'Dermatology',
  'DM': 'Durable Medical Equipment',
  'DS': 'Diabetic Supplies',
  'GF': 'Generic Prescription Drug - Formulary',
  'GN': 'Generic Prescription Drug - Non-Formulary',
  'GY': 'Allergy',
  'IC': 'Intensive Care',
  'MH': 'Mental Health',
  'NI': 'Neonatal Intensive Care',
  'ON': 'Oncology',
  'PT': 'Physical Therapy',
  'PU': 'Pulmonary',
  'RN': 'Renal',
  'RT': 'Residential Psychiatric Treatment',
  'SMH': 'Serious Mental Health',
  'SUD': 'Substance Use Disorder',
  'TC': 'Transitional Care',
  'TN': 'Transitional Nursery Care',
  'UC': 'Urgent Care'
};

/**
 * Insurance Amount Qualifier Codes
 */
export const AMOUNT_QUALIFIERS: Record<string, string> = {
  'C1': 'Deductible',
  'R': 'Co-Insurance',
  'B': 'Co-Payment',
  'G8': 'Out of Pocket (Stop Loss)',
  'F5': 'Lifetime Reserve Days'
};

/**
 * Time Period Qualifiers
 */
export const TIME_PERIOD_QUALIFIERS: Record<string, string> = {
  '23': 'Individual',
  '24': 'Family',
  '25': 'Year to Date',
  '26': 'Contract',
  '27': 'Episode',
  '28': 'Month',
  '29': 'Visit',
  '30': 'Outlier',
  '31': 'Remaining',
  '32': 'Used',
  '33': 'Day'
};

/**
 * Raw benefit detail from EB segment
 */
export interface RawBenefit {
  serviceTypes: string[];
  insurancePlan: string | undefined;
  monetaryAmount: number | null;
  percentage: number | null;
  coverageLevel: string | undefined;
}

/**
 * Comprehensive financial information extracted from X12 271
 */
export interface FinancialBenefits {
  // Network Status
  isInNetwork: boolean | null;
  networkStatus: 'IN_NETWORK' | 'OUT_OF_NETWORK' | null;

  // Deductibles
  deductibleTotal: number | null;
  deductibleMet: number | null;
  deductibleRemaining: number | null;
  familyDeductibleTotal: number | null;
  familyDeductibleMet: number | null;
  familyDeductibleRemaining: number | null;

  // Out-of-Pocket Maximum
  oopMaxTotal: number | null;
  oopMaxMet: number | null;
  oopMaxRemaining: number | null;
  familyOopMaxTotal: number | null;
  familyOopMaxMet: number | null;
  familyOopMaxRemaining: number | null;

  // Copays by service type
  primaryCareCopay: number | null;
  specialistCopay: number | null;
  urgentCareCopay: number | null;
  emergencyCopay: number | null;
  mentalHealthInpatient: number | null;
  mentalHealthOutpatient: number | null;
  substanceUse: number | null;

  // Coinsurance percentages
  primaryCareCoinsurance: number | null;
  specialistCoinsurance: number | null;

  // Raw benefit details for debugging
  rawBenefits: RawBenefit[];
}

/**
 * Extract comprehensive financial benefits from X12 271 response
 * @param x12_271 - Raw X12 271 response data
 * @returns Comprehensive financial information or null if no financial data found
 */
export function extractFinancialBenefits(x12_271: string): FinancialBenefits | null {
  const copayInfo: FinancialBenefits = {
    // Network Status
    isInNetwork: null,
    networkStatus: null,

    // Deductibles
    deductibleTotal: null,
    deductibleMet: null,
    deductibleRemaining: null,
    familyDeductibleTotal: null,
    familyDeductibleMet: null,
    familyDeductibleRemaining: null,

    // Out-of-Pocket Maximum
    oopMaxTotal: null,
    oopMaxMet: null,
    oopMaxRemaining: null,
    familyOopMaxTotal: null,
    familyOopMaxMet: null,
    familyOopMaxRemaining: null,

    // Copays by service type
    primaryCareCopay: null,
    specialistCopay: null,
    urgentCareCopay: null,
    emergencyCopay: null,
    mentalHealthInpatient: null,
    mentalHealthOutpatient: null,
    substanceUse: null,

    // Coinsurance percentages
    primaryCareCoinsurance: null,
    specialistCoinsurance: null,

    // Raw benefit details for debugging
    rawBenefits: []
  };

  const segments = x12_271.split('~').filter(seg => seg.trim());

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i].trim();

    // EB segments contain eligibility and benefit information
    if (segment.startsWith('EB*')) {
      const parts = segment.split('*');
      const eligibilityCode = parts[1]; // 1=Active, C=Deductible, G=OOP Max, B=Copay, etc.
      const coverageLevel = parts[2]; // IND=Individual, FAM=Family
      const serviceTypes = parts[3] ? parts[3].split('^') : [];

      // Handle three different EB segment formats:
      // Format 1 (Standard): EB*C*IND*30**C1*1250  (amount in position 6)
      // Format 2 (UUHP):     EB*C*IND*30***25*1250*****Y (amount in position 7, time period in position 6)
      // Format 3 (Aetna):    EB*B*FAM*98****40*****Y (amount in position 7, positions 4-6 empty)

      let insurancePlan = parts[4];
      let timePeriodQualifier = parts[5];
      let monetaryAmount: number | null = null;
      let percentage: number | null = null;
      let networkFlag: string | null = null;

      // Try position 7 first (most common for Aetna and UUHP)
      if (parts[7] && /^\d+(\.\d+)?$/.test(parts[7])) {
        // Format 2 or 3: Amount is in position 7
        if (parts[6] && /^\d+(\.\d+)?$/.test(parts[6])) {
          // Format 2 (UUHP): Time period in position 6, amount in position 7
          timePeriodQualifier = parts[6];
        }
        monetaryAmount = parseFloat(parts[7]);
        percentage = parts[8] ? parseFloat(parts[8]) : null;
        networkFlag = parts[12] ? parts[12].trim() : null;
      } else if (parts[6] && /^\d+(\.\d+)?$/.test(parts[6])) {
        // Format 1: Amount is in position 6
        monetaryAmount = parseFloat(parts[6]);
        percentage = parts[7] ? parseFloat(parts[7]) : null;
        networkFlag = parts[12] ? parts[12].trim() : null;
      }

      // Set network status if we find the flag
      if (networkFlag === 'Y' && copayInfo.networkStatus === null) {
        copayInfo.isInNetwork = true;
        copayInfo.networkStatus = 'IN_NETWORK';
      } else if (networkFlag === 'N' && copayInfo.networkStatus === null) {
        copayInfo.isInNetwork = false;
        copayInfo.networkStatus = 'OUT_OF_NETWORK';
      }

      // Process deductibles and OOP max (eligibility codes C and G)
      // For code '1' (active coverage), skip if no monetary amount
      if (eligibilityCode === '1' && !monetaryAmount) continue;

      // Store raw benefit for debugging
      copayInfo.rawBenefits.push({
        serviceTypes: serviceTypes.map(st => SERVICE_TYPE_CODES[st] || st),
        insurancePlan,
        monetaryAmount,
        percentage,
        coverageLevel
      });

      const isIndividual = coverageLevel === 'IND';
      const isFamily = coverageLevel === 'FAM';

      // Only process IN-NETWORK amounts for display (networkFlag === 'Y')
      // Skip out-of-network amounts (networkFlag === 'N')
      const isInNetwork = networkFlag === 'Y' || networkFlag === null;
      if (!isInNetwork) continue;

      // Parse based on eligibility code and insurance type
      // Eligibility codes: C = Deductible, G = OOP Max, 1 = Active Coverage
      // Insurance Type codes: C1 = Deductible, R = Co-Insurance, B = Co-Payment, G8 = Out of Pocket Max
      // Time Period: 25 = Total, 29 = Remaining, 32 = Used/Met

      // Deductibles (eligibility code C or insurance type C1)
      if ((eligibilityCode === 'C' || insurancePlan === 'C1') && monetaryAmount) {
        // Handle both standard and UUHP formats
        // Standard: 31=Remaining, 32=Used/Met, no qualifier=Total
        // UUHP: 29=Remaining, 25=Total
        if (timePeriodQualifier === '29' || timePeriodQualifier === '31') { // Remaining
          if (isIndividual) {
            copayInfo.deductibleRemaining = monetaryAmount;
          } else if (isFamily) {
            copayInfo.familyDeductibleRemaining = monetaryAmount;
          }
        } else if (timePeriodQualifier === '32') { // Used/Met
          if (isIndividual) {
            copayInfo.deductibleMet = monetaryAmount;
          } else if (isFamily) {
            copayInfo.familyDeductibleMet = monetaryAmount;
          }
        } else if (timePeriodQualifier === '25' || !timePeriodQualifier) { // Total
          if (isIndividual) {
            copayInfo.deductibleTotal = monetaryAmount;
          } else if (isFamily) {
            copayInfo.familyDeductibleTotal = monetaryAmount;
          }
        }
      }

      // Out-of-Pocket Maximum (eligibility code G or insurance type G8)
      if ((eligibilityCode === 'G' || insurancePlan === 'G8') && monetaryAmount) {
        // Handle both standard and UUHP formats
        if (timePeriodQualifier === '29' || timePeriodQualifier === '31') { // Remaining
          if (isIndividual) {
            copayInfo.oopMaxRemaining = monetaryAmount;
          } else if (isFamily) {
            copayInfo.familyOopMaxRemaining = monetaryAmount;
          }
        } else if (timePeriodQualifier === '32') { // Used/Met
          if (isIndividual) {
            copayInfo.oopMaxMet = monetaryAmount;
          } else if (isFamily) {
            copayInfo.familyOopMaxMet = monetaryAmount;
          }
        } else if (timePeriodQualifier === '25' || !timePeriodQualifier) { // Total
          if (isIndividual) {
            copayInfo.oopMaxTotal = monetaryAmount;
          } else if (isFamily) {
            copayInfo.familyOopMaxTotal = monetaryAmount;
          }
        }
      }

      // Co-payments (eligibility code B) and Co-insurance (R)
      // Check BOTH eligibility code (field 1) AND insurance plan (field 4) for copayment
      if ((eligibilityCode === 'B' || insurancePlan === 'B' || insurancePlan === 'A') && monetaryAmount) {
        // Match service types to copay categories
        // Note: For service type 98, need to check MSG segments to distinguish PCP vs specialist
        // For now, we'll capture both and specialist will override if it comes later
        if (serviceTypes.includes('98') || serviceTypes.includes('BY')) { // Office Visit
          // Check the next segments for MSG to determine if PCP or specialist
          const nextSegments = segments.slice(i + 1, i + 5).join('~');
          if (nextSegments.includes('SPECIALIST')) {
            copayInfo.specialistCopay = monetaryAmount;
          } else if (nextSegments.includes('PRIMARY CARE')) {
            copayInfo.primaryCareCopay = monetaryAmount;
          } else {
            // Default to primary care if unclear
            if (copayInfo.primaryCareCopay === null) {
              copayInfo.primaryCareCopay = monetaryAmount;
            }
          }
        } else if (serviceTypes.includes('A0') || serviceTypes.includes('3')) { // Specialist
          copayInfo.specialistCopay = monetaryAmount;
        } else if (serviceTypes.includes('UC') || serviceTypes.includes('86')) { // Urgent Care / Emergency Services
          copayInfo.urgentCareCopay = monetaryAmount;
        } else if (serviceTypes.includes('51') || serviceTypes.includes('52')) { // Emergency
          copayInfo.emergencyCopay = monetaryAmount;
        } else if (serviceTypes.includes('A7') || serviceTypes.includes('CG')) { // Psychiatric Inpatient / Mental Health Facility Inpatient
          copayInfo.mentalHealthInpatient = monetaryAmount;
        } else if (serviceTypes.includes('A8') || serviceTypes.includes('CH')) { // Psychiatric Outpatient / Mental Health Facility Outpatient
          copayInfo.mentalHealthOutpatient = monetaryAmount;
        } else if (serviceTypes.includes('AI') || serviceTypes.includes('CJ')) { // Substance Abuse / Substance Abuse Facility Outpatient
          copayInfo.substanceUse = monetaryAmount;
        }
      }

      // Co-insurance percentages
      if (insurancePlan === 'R' && percentage) {
        if (serviceTypes.includes('98') || serviceTypes.includes('BY')) { // Primary Care
          copayInfo.primaryCareCoinsurance = percentage;
        } else if (serviceTypes.includes('A0') || serviceTypes.includes('3')) { // Specialist
          copayInfo.specialistCoinsurance = percentage;
        }
      }
    }
  }

  // Calculate missing amounts based on what we have
  // If we have total and remaining, calculate met
  if (copayInfo.deductibleTotal !== null && copayInfo.deductibleRemaining !== null && copayInfo.deductibleMet === null) {
    copayInfo.deductibleMet = copayInfo.deductibleTotal - copayInfo.deductibleRemaining;
  }
  // If we have total and met, calculate remaining
  if (copayInfo.deductibleTotal !== null && copayInfo.deductibleMet !== null && copayInfo.deductibleRemaining === null) {
    copayInfo.deductibleRemaining = copayInfo.deductibleTotal - copayInfo.deductibleMet;
  }

  // Same for family deductible
  if (copayInfo.familyDeductibleTotal !== null && copayInfo.familyDeductibleRemaining !== null && copayInfo.familyDeductibleMet === null) {
    copayInfo.familyDeductibleMet = copayInfo.familyDeductibleTotal - copayInfo.familyDeductibleRemaining;
  }
  if (copayInfo.familyDeductibleTotal !== null && copayInfo.familyDeductibleMet !== null && copayInfo.familyDeductibleRemaining === null) {
    copayInfo.familyDeductibleRemaining = copayInfo.familyDeductibleTotal - copayInfo.familyDeductibleMet;
  }

  // Same for OOP max
  if (copayInfo.oopMaxTotal !== null && copayInfo.oopMaxRemaining !== null && copayInfo.oopMaxMet === null) {
    copayInfo.oopMaxMet = copayInfo.oopMaxTotal - copayInfo.oopMaxRemaining;
  }
  if (copayInfo.oopMaxTotal !== null && copayInfo.oopMaxMet !== null && copayInfo.oopMaxRemaining === null) {
    copayInfo.oopMaxRemaining = copayInfo.oopMaxTotal - copayInfo.oopMaxMet;
  }

  // Same for family OOP max
  if (copayInfo.familyOopMaxTotal !== null && copayInfo.familyOopMaxRemaining !== null && copayInfo.familyOopMaxMet === null) {
    copayInfo.familyOopMaxMet = copayInfo.familyOopMaxTotal - copayInfo.familyOopMaxRemaining;
  }
  if (copayInfo.familyOopMaxTotal !== null && copayInfo.familyOopMaxMet !== null && copayInfo.familyOopMaxRemaining === null) {
    copayInfo.familyOopMaxRemaining = copayInfo.familyOopMaxTotal - copayInfo.familyOopMaxMet;
  }

  // Return null if no financial info was found
  const hasAnyFinancialInfo = Object.keys(copayInfo).some(key =>
    key !== 'rawBenefits' && copayInfo[key as keyof FinancialBenefits] !== null
  );

  return hasAnyFinancialInfo ? copayInfo : null;
}
