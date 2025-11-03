/**
 * Database-Driven Eligibility Service
 *
 * Office Ally eligibility checking with Supabase database-driven configuration.
 * Supports dynamic form generation and multi-payer eligibility verification.
 *
 * @module database-driven-eligibility
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import https from 'https';
import { extractFinancialBenefits } from './x12-271-financial-parser';
import { checkMoonlitBillability, type BillabilityResult } from './billabilityService';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export type FieldRequirement = 'required' | 'recommended' | 'optional' | 'not_needed';

export interface PayerConfig {
  id: string;
  name: string;
  displayName: string;
  category: string;
  officeAllyPayerId: string;
  payerName: string;
  fields: Record<string, FieldRequirement>;
  x12Specifics: {
    requiresGenderInDMG: boolean;
    supportsMemberIdInNM1: boolean;
    dtpFormat: 'D8' | 'RD8';
    allowsNameOnly: boolean;
  };
  notes: string | null;
  tested: boolean;
}

export interface ProviderInfo {
  name: string;
  npi: string;
  tin: string | null;
}

export interface PayerDropdownOption {
  value: string;
  label: string;
  description: string | null;
  tested: boolean;
}

export interface PayerCategory {
  category: string;
  payers: PayerDropdownOption[];
}

export interface FormFieldConfig {
  name: string;
  label: string;
  placeholder: string;
  helpText: string;
  type: 'text' | 'date' | 'select' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  requirement: FieldRequirement;
  isRequired: boolean;
  isRecommended: boolean;
  isOptional: boolean;
}

export interface DynamicFormConfig {
  payerId: string;
  payerName: string;
  category: string;
  notes: string | null;
  fields: FormFieldConfig[];
  submitRequirements: {
    required: string[];
    recommended: string[];
    optional: string[];
  };
}

export interface PatientData {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'M' | 'F' | 'U' | 'X';
  memberNumber?: string;
  medicaidId?: string;
  groupNumber?: string;
  ssn?: string;
  address?: string;
  serviceDate?: string;
}

export interface ExtractedData {
  phone: string | null;
  medicaidId: string | null;
  gender: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  } | null;
  memberInfo: {
    subscriberId: string;
  } | null;
}

export interface EligibilityResult {
  enrolled: boolean;
  program?: string;
  details?: string;
  effectiveDate?: string;
  verified: boolean;
  error?: string;
  extractedData?: ExtractedData;
}

// =============================================================================
// OFFICE ALLY CONFIGURATION
// =============================================================================

const OFFICE_ALLY_CONFIG = {
  endpoint: process.env.OFFICE_ALLY_ENDPOINT || 'https://wsd.officeally.com/TransactionService/rtx.svc',
  username: process.env.OFFICE_ALLY_USERNAME,
  password: process.env.OFFICE_ALLY_PASSWORD,
  senderID: process.env.OFFICE_ALLY_SENDER_ID || '1161680',
  receiverID: 'OFFALLY'
} as const;

// =============================================================================
// SUPABASE CLIENT INITIALIZATION
// =============================================================================

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials in environment variables');
    }

    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }

  return supabaseClient;
}

// =============================================================================
// PAYER CONFIGURATION FUNCTIONS
// =============================================================================

/**
 * Get all available payers for dropdown options, grouped by category
 */
export async function getPayerDropdownOptions(): Promise<PayerCategory[]> {
  try {
    const supabase = getSupabaseClient();

    const { data: configs, error } = await supabase
      .from('v_office_ally_eligibility_configs')
      .select('*')
      .order('category, payer_display_name');

    if (error) throw error;

    // Group by category
    const categories: Record<string, PayerDropdownOption[]> = {};

    configs?.forEach((config: any) => {
      if (!categories[config.category]) {
        categories[config.category] = [];
      }

      categories[config.category].push({
        value: config.office_ally_payer_id,
        label: config.payer_display_name,
        description: config.test_notes,
        tested: config.is_tested
      });
    });

    // Convert to array format expected by frontend
    return Object.entries(categories).map(([category, payers]) => ({
      category,
      payers
    }));

  } catch (error) {
    console.error('Error fetching payer dropdown options:', error);
    return [];
  }
}

/**
 * Get payer configuration by Office Ally payer ID
 */
export async function getPayerConfig(officeAllyPayerId: string): Promise<PayerConfig | null> {
  try {
    const supabase = getSupabaseClient();

    const { data: config, error } = await supabase
      .from('v_office_ally_eligibility_configs')
      .select('*')
      .eq('office_ally_payer_id', officeAllyPayerId)
      .single();

    if (error) throw error;

    return {
      id: officeAllyPayerId,
      name: config.payer_name,
      displayName: config.payer_display_name,
      category: config.category,
      officeAllyPayerId: config.office_ally_payer_id,
      payerName: config.payer_display_name.toUpperCase(),
      fields: parseFieldRequirements(config),
      x12Specifics: {
        requiresGenderInDMG: config.requires_gender_in_dmg,
        supportsMemberIdInNM1: config.supports_member_id_in_nm1,
        dtpFormat: config.dtp_format,
        allowsNameOnly: config.allows_name_only
      },
      notes: config.test_notes,
      tested: config.is_tested
    };

  } catch (error) {
    console.error(`Error fetching config for payer ${officeAllyPayerId}:`, error);
    return null;
  }
}

/**
 * Parse field requirements from database JSON into form format
 */
function parseFieldRequirements(config: any): Record<string, FieldRequirement> {
  const FIELD_TYPES = {
    REQUIRED: 'required' as const,
    RECOMMENDED: 'recommended' as const,
    OPTIONAL: 'optional' as const
  };

  const fields: Record<string, FieldRequirement> = {};
  const allFieldNames: string[] = [
    'firstName', 'lastName', 'dateOfBirth', 'gender',
    'memberNumber', 'medicaidId', 'groupNumber', 'ssn', 'address'
  ];

  // Initialize all fields as not needed
  allFieldNames.forEach(fieldName => {
    fields[fieldName] = 'not_needed';
  });

  // Set required fields
  if (config.required_fields) {
    config.required_fields.forEach((fieldName: string) => {
      fields[fieldName] = FIELD_TYPES.REQUIRED;
    });
  }

  // Set recommended fields
  if (config.recommended_fields) {
    config.recommended_fields.forEach((fieldName: string) => {
      fields[fieldName] = FIELD_TYPES.RECOMMENDED;
    });
  }

  // Set optional fields
  if (config.optional_fields) {
    config.optional_fields.forEach((fieldName: string) => {
      fields[fieldName] = FIELD_TYPES.OPTIONAL;
    });
  }

  return fields;
}

// =============================================================================
// PROVIDER SELECTION FUNCTIONS
// =============================================================================

/**
 * Get preferred provider for a given Office Ally payer ID
 */
export async function getPreferredProvider(officeAllyPayerId: string): Promise<ProviderInfo> {
  try {
    const supabase = getSupabaseClient();

    // Helper function to get TIN from providers table
    async function getTinForNPI(npi: string): Promise<string | null> {
      const { data: providerData } = await supabase
        .from('providers')
        .select('tax_id')
        .eq('npi', npi)
        .single();
      return providerData?.tax_id || null;
    }

    // First try to find a provider who has this payer as preferred
    const { data: preferredProvider, error: preferredError } = await supabase
      .from('v_provider_office_ally_configs')
      .select('*')
      .contains('is_preferred_for_payers', [officeAllyPayerId])
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!preferredError && preferredProvider) {
      const tin = await getTinForNPI(preferredProvider.provider_npi);
      return {
        name: preferredProvider.office_ally_provider_name,
        npi: preferredProvider.provider_npi,
        tin: tin
      };
    }

    // Fallback: Find any provider that supports this payer
    const { data: supportingProvider, error: supportError } = await supabase
      .from('v_provider_office_ally_configs')
      .select('*')
      .contains('supported_office_ally_payer_ids', [officeAllyPayerId])
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!supportError && supportingProvider) {
      const tin = await getTinForNPI(supportingProvider.provider_npi);
      return {
        name: supportingProvider.office_ally_provider_name,
        npi: supportingProvider.provider_npi,
        tin: tin
      };
    }

    // Final fallback: Use first active provider
    const { data: fallbackProvider, error: fallbackError } = await supabase
      .from('v_provider_office_ally_configs')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!fallbackError && fallbackProvider) {
      console.warn(`No specific provider found for ${officeAllyPayerId}, using fallback: ${fallbackProvider.office_ally_provider_name}`);
      const tin = await getTinForNPI(fallbackProvider.provider_npi);
      return {
        name: fallbackProvider.office_ally_provider_name,
        npi: fallbackProvider.provider_npi,
        tin: tin
      };
    }

    throw new Error('No active providers found in database');

  } catch (error) {
    console.error(`Error finding provider for ${officeAllyPayerId}:`, error);

    // Hard fallback to known working providers with TINs
    if (officeAllyPayerId === '60054') { // Aetna
      return { name: 'TRAVIS NORSETH', npi: '1902336593', tin: '332185708' }; // Moonlit's TIN
    }
    return { name: 'MOONLIT PLLC', npi: '1275348807', tin: '332185708' }; // Moonlit's TIN
  }
}

// =============================================================================
// FORM GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate dynamic form configuration for frontend based on payer requirements
 */
export async function generateDynamicFormConfig(officeAllyPayerId: string): Promise<DynamicFormConfig> {
  const payerConfig = await getPayerConfig(officeAllyPayerId);
  if (!payerConfig) {
    throw new Error(`Invalid payer ID: ${officeAllyPayerId}`);
  }

  // Field labels and configurations
  const FIELD_CONFIG: Record<string, Omit<FormFieldConfig, 'name' | 'requirement' | 'isRequired' | 'isRecommended' | 'isOptional'>> = {
    firstName: {
      label: 'First Name',
      placeholder: 'Enter first name',
      helpText: 'Patient\'s legal first name',
      type: 'text'
    },
    lastName: {
      label: 'Last Name',
      placeholder: 'Enter last name',
      helpText: 'Patient\'s legal last name',
      type: 'text'
    },
    dateOfBirth: {
      label: 'Date of Birth',
      placeholder: 'YYYY-MM-DD',
      helpText: 'Patient\'s date of birth (required for all payers)',
      type: 'date'
    },
    gender: {
      label: 'Gender',
      placeholder: 'Select gender',
      helpText: 'M = Male, F = Female (required for most commercial payers)',
      type: 'select',
      options: [
        { value: 'M', label: 'Male' },
        { value: 'F', label: 'Female' },
        { value: 'U', label: 'Unknown' }
      ]
    },
    medicaidId: {
      label: 'Medicaid ID',
      placeholder: 'Enter Medicaid ID',
      helpText: 'State Medicaid identification number',
      type: 'text'
    },
    memberNumber: {
      label: 'Member ID',
      placeholder: 'Enter member number',
      helpText: 'Insurance member/subscriber ID from insurance card',
      type: 'text'
    },
    groupNumber: {
      label: 'Group Number',
      placeholder: 'Enter group number',
      helpText: 'Group/employer ID from insurance card',
      type: 'text'
    },
    ssn: {
      label: 'Social Security Number',
      placeholder: 'XXX-XX-XXXX',
      helpText: 'Patient\'s SSN (rarely needed for eligibility)',
      type: 'text'
    },
    address: {
      label: 'Address',
      placeholder: 'Enter address',
      helpText: 'Patient\'s current address',
      type: 'textarea'
    }
  };

  const formConfig: DynamicFormConfig = {
    payerId: officeAllyPayerId,
    payerName: payerConfig.displayName,
    category: payerConfig.category,
    notes: payerConfig.notes,
    fields: [],
    submitRequirements: {
      required: [],
      recommended: [],
      optional: []
    }
  };

  // Generate field configurations
  Object.entries(payerConfig.fields).forEach(([fieldName, requirement]) => {
    if (requirement === 'not_needed') return;

    const baseFieldConfig = FIELD_CONFIG[fieldName];
    if (!baseFieldConfig) return;

    const fieldConfig: FormFieldConfig = {
      name: fieldName,
      ...baseFieldConfig,
      requirement: requirement,
      isRequired: requirement === 'required',
      isRecommended: requirement === 'recommended',
      isOptional: requirement === 'optional'
    };

    formConfig.fields.push(fieldConfig);

    // Add to appropriate requirement list
    if (requirement === 'required') {
      formConfig.submitRequirements.required.push(fieldName);
    } else if (requirement === 'recommended') {
      formConfig.submitRequirements.recommended.push(fieldName);
    } else if (requirement === 'optional') {
      formConfig.submitRequirements.optional.push(fieldName);
    }
  });

  // Sort fields by priority (required first, then recommended, then optional)
  formConfig.fields.sort((a, b) => {
    const priorityMap: Record<FieldRequirement, number> = {
      required: 3,
      recommended: 2,
      optional: 1,
      not_needed: 0
    };
    return priorityMap[b.requirement] - priorityMap[a.requirement];
  });

  return formConfig;
}

// =============================================================================
// X12 GENERATION FUNCTIONS
// =============================================================================

/**
 * Generate X12 270 request using database-driven configuration
 */
export async function generateDatabaseDrivenX12_270(
  officeAllyPayerId: string,
  patientData: PatientData,
  providerNpi?: string
): Promise<string> {
  const payerConfig = await getPayerConfig(officeAllyPayerId);
  const providerInfo = await getPreferredProvider(officeAllyPayerId);

  if (!payerConfig || !providerInfo) {
    throw new Error(`Configuration not found for payer: ${officeAllyPayerId}`);
  }

  const now = new Date();
  const ctrl = Date.now().toString().slice(-9);

  // Use LOCAL time for dates (not UTC) to avoid "future date" errors
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const yymmdd = `${String(year).slice(2)}${month}${day}`;
  const hhmm = `${hours}${minutes}`;

  // Use service date if provided (for historical eligibility checks)
  let ccyymmdd = `${year}${month}${day}`;
  if (patientData.serviceDate) {
    ccyymmdd = patientData.serviceDate.replace(/-/g, '');
  }

  const dob = (patientData.dateOfBirth || '').replace(/-/g,'');

  // Pad ISA fields to 15 characters
  const pad15 = (s: string | undefined | null) => (s ?? '').toString().padEnd(15, ' ');
  const ISA06 = pad15(OFFICE_ALLY_CONFIG.senderID);
  const ISA08 = pad15(OFFICE_ALLY_CONFIG.receiverID);

  const seg: string[] = [];

  // ISA - Interchange Control Header
  seg.push(`ISA*00*          *00*          *ZZ*${ISA06}*01*${ISA08}*${yymmdd}*${hhmm}*^*00501*${ctrl}*0*P*:`);

  // GS - Functional Group Header
  seg.push(`GS*HS*${OFFICE_ALLY_CONFIG.senderID}*${OFFICE_ALLY_CONFIG.receiverID}*${ccyymmdd}*${hhmm}*${ctrl}*X*005010X279A1`);

  // ST - Transaction Set Header
  seg.push(`ST*270*0001*005010X279A1`);

  // BHT - Beginning of Hierarchical Transaction
  seg.push(`BHT*0022*13*${providerInfo.name.replace(/\s/g, '')}-${ctrl}*20${yymmdd}*${hhmm}`);

  // 2100A: Information Source (Payer)
  seg.push(`HL*1**20*1`);
  seg.push(`NM1*PR*2*${payerConfig.payerName}*****PI*${payerConfig.officeAllyPayerId}`);

  // 2100B: Information Receiver (Provider)
  seg.push(`HL*2*1*21*1`);

  // Determine if provider is individual (Type 1) or organization (Type 2)
  const isOrganization = /\b(PLLC|LLC|PC|INC|CORP|ASSOCIATES|GROUP|CENTER|CLINIC)\b/i.test(providerInfo.name);

  if (isOrganization) {
    // Type 2: Non-Person Entity (Organization)
    seg.push(`NM1*1P*2*${providerInfo.name}*****XX*${providerInfo.npi}`);
  } else {
    // Type 1: Person (Individual Provider)
    const nameParts = providerInfo.name.replace(/_/g, ' ').trim().split(/\s+/);
    if (nameParts.length >= 2) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      seg.push(`NM1*1P*1*${lastName}*${firstName}****XX*${providerInfo.npi}`);
    } else {
      seg.push(`NM1*1P*1*${providerInfo.name}*****XX*${providerInfo.npi}`);
    }
  }

  // 2100C: Subscriber (Patient)
  seg.push(`HL*3*2*22*0`);
  seg.push(`TRN*1*${ctrl}*${providerInfo.npi}*ELIGIBILITY`);

  // NM1 - Patient Name segment with payer-specific requirements
  let nm1Segment = `NM1*IL*1*${(patientData.lastName||'').toUpperCase()}*${(patientData.firstName||'').toUpperCase()}`;

  // Add member ID if provided and supported by payer
  if (patientData.memberNumber && payerConfig.x12Specifics.supportsMemberIdInNM1) {
    nm1Segment += `****MI*${patientData.memberNumber}`;
  } else if (patientData.medicaidId && payerConfig.x12Specifics.supportsMemberIdInNM1) {
    nm1Segment += `****MI*${patientData.medicaidId}`;
  }

  seg.push(nm1Segment);

  // DMG - Demographics segment (only include if we have DOB)
  if (dob) {
    let dmgSegment = `DMG*D8*${dob}`;
    if (payerConfig.x12Specifics.requiresGenderInDMG && patientData.gender) {
      const validGender = patientData.gender.toUpperCase();
      if (['M', 'F'].includes(validGender)) {
        dmgSegment += `*${validGender}`;
      }
    }
    seg.push(dmgSegment);
  }

  // DTP - Date segment (only include if we have DOB)
  if (dob) {
    if (payerConfig.x12Specifics.dtpFormat === 'RD8') {
      seg.push(`DTP*291*RD8*${ccyymmdd}-${ccyymmdd}`);
    } else {
      seg.push(`DTP*291*D8*${ccyymmdd}`);
    }
  }

  // EQ - Eligibility or Benefit Inquiry
  seg.push(`EQ*30`); // 30 = Health Benefit Plan Coverage (general)
  seg.push(`EQ*98`); // 98 = Professional (Physician) Visit - Office
  seg.push(`EQ*A8`); // A8 = Psychiatric - Outpatient

  // SE - Transaction Set Trailer
  const stIndex = seg.findIndex(s => s.startsWith('ST*'));
  const count = seg.length - stIndex + 1;
  seg.push(`SE*${count}*0001`);

  // GE - Functional Group Trailer
  seg.push(`GE*1*${ctrl}`);

  // IEA - Interchange Control Trailer
  seg.push(`IEA*1*${ctrl}`);

  return seg.join('~') + '~';
}

// =============================================================================
// X12 PARSING FUNCTIONS
// =============================================================================

/**
 * Parse X12 271 response for auto-population of patient data
 */
export async function parseX12_271ForAutoPopulation(
  x12_271: string,
  patientData: PatientData
): Promise<ExtractedData> {
  try {
    const extractedData: ExtractedData = {
      phone: null,
      medicaidId: null,
      gender: null,
      address: null,
      memberInfo: null
    };

    // Extract phone number from PER segments
    const perPhoneMatch = x12_271.match(/PER\*[^~]*\*[^~]*\*TE\*([0-9]{10})[^~]*/i);
    if (perPhoneMatch) {
      extractedData.phone = perPhoneMatch[1];
    } else {
      const phoneMatch = x12_271.match(/([0-9]{10})/);
      if (phoneMatch) {
        extractedData.phone = phoneMatch[1];
      }
    }

    // Extract gender from DMG segment
    const genderMatch = x12_271.match(/DMG\*D8\*[0-9]{8}\*([MFU])/i);
    if (genderMatch) {
      extractedData.gender = genderMatch[1].toUpperCase();
    }

    // Extract Medicaid ID
    const medicaidMatches = [
      x12_271.match(/NM1\*IL\*[^~]*\*[^~]*\*[^~]*\*[^~]*\*[^~]*\*MI\*([A-Z0-9]+)/i),
      x12_271.match(/REF\*1L\*([A-Z0-9]+)/i),
      x12_271.match(/REF\*SY\*([A-Z0-9]+)/i)
    ];

    for (const match of medicaidMatches) {
      if (match && match[1]) {
        extractedData.medicaidId = match[1];
        break;
      }
    }

    // Extract address from N3/N4 segments
    const addressMatch = x12_271.match(/N3\*([^~]+)~N4\*([^~]+)\*([^~]+)\*([^~]+)/i);
    if (addressMatch) {
      extractedData.address = {
        street: addressMatch[1],
        city: addressMatch[2],
        state: addressMatch[3],
        zip: addressMatch[4]
      };
    }

    // Extract member information
    const memberIdMatch = x12_271.match(/REF\*0F\*([A-Z0-9]+)/i);
    if (memberIdMatch) {
      extractedData.memberInfo = {
        subscriberId: memberIdMatch[1]
      };
    }

    console.log('📋 Extracted data from X12 271:', extractedData);
    return extractedData;

  } catch (error) {
    console.error('❌ X12 271 parsing failed:', error);
    return {
      phone: null,
      medicaidId: null,
      gender: null,
      address: null,
      memberInfo: null
    };
  }
}

// =============================================================================
// LOGGING FUNCTIONS
// =============================================================================

/**
 * Log eligibility check to database for audit trail
 */
export async function logEligibilityCheck(
  adminEmail: string,
  patientData: PatientData,
  officeAllyPayerId: string,
  x12_270: string,
  x12_271: string,
  result: EligibilityResult,
  responseTime: number
): Promise<any> {
  try {
    const supabase = getSupabaseClient();

    // Get payer and provider info for logging
    const payerConfig = await getPayerConfig(officeAllyPayerId);
    const providerInfo = await getPreferredProvider(officeAllyPayerId);

    // Get the actual payer UUID
    const { data: payerRecord } = await supabase
      .from('payer_office_ally_configs')
      .select('payer_id')
      .eq('office_ally_payer_id', officeAllyPayerId)
      .single();

    // Log to eligibility_checks table
    const { data: logEntry, error: logError } = await supabase
      .from('eligibility_checks')
      .insert([{
        admin_user_email: adminEmail,
        patient_first_name: patientData.firstName?.trim(),
        patient_last_name: patientData.lastName?.trim(),
        patient_dob: patientData.dateOfBirth,
        patient_gender: patientData.gender,
        patient_member_id: patientData.memberNumber || patientData.medicaidId || null,
        patient_group_number: patientData.groupNumber,
        payer_id: payerRecord?.payer_id || null,
        office_ally_payer_id: officeAllyPayerId,
        payer_display_name: payerConfig?.displayName,
        is_eligible: result.isEligible,
        coverage_status: result.coverageStatus,
        raw_x12_270_request: x12_270,
        raw_x12_271_response: x12_271,
        response_time_ms: responseTime
      }])
      .select()
      .single();

    if (logError) {
      console.error('Database logging failed:', logError);
      return null;
    }

    console.log('✅ Eligibility check logged successfully');
    return logEntry;

  } catch (error) {
    console.error('Error logging eligibility check:', error);
    return null;
  }
}

/**
 * Extract primary payer name from X12 271 response
 * Looks for NM1*PR segment (not within LS*2120 loop)
 */
function extractPayerName(x12_271: string): string | null {
  try {
    // Find the first NM1*PR segment (primary payer)
    // This should be before any LS*2120 loop segments
    const beforeLoop = x12_271.split('LS*2120')[0];
    const payerMatch = beforeLoop.match(/NM1\*PR\*2\*([^*]+)/);

    if (payerMatch && payerMatch[1]) {
      return payerMatch[1].trim();
    }
    return null;
  } catch (error) {
    console.error('Error extracting payer name:', error);
    return null;
  }
}

/**
 * Extract managed care organization name from X12 271 response
 * Looks for NM1*PR segment within LS*2120~...~LE*2120 loop
 */
function extractManagedCareOrg(x12_271: string): string | null {
  try {
    // Find LS*2120 loop sections (contains secondary payer info like MCOs)
    const loopMatches = x12_271.match(/LS\*2120~[^~]*~NM1\*PR\*2\*([^*]+)/g);

    if (loopMatches && loopMatches.length > 0) {
      // Extract the MCO name from the first LS*2120 loop
      const mcoMatch = loopMatches[0].match(/NM1\*PR\*2\*([^*]+)/);
      if (mcoMatch && mcoMatch[1]) {
        return mcoMatch[1].trim();
      }
    }
    return null;
  } catch (error) {
    console.error('Error extracting MCO name:', error);
    return null;
  }
}

/**
 * Main eligibility check function
 * Generates X12 270, sends to Office Ally, parses X12 271 response
 */
export async function checkEligibility(
  officeAllyPayerId: string,
  patientData: any,
  providerNpi?: string
): Promise<any> {
  try {
    console.log(`🔍 Checking eligibility for ${patientData.firstName} ${patientData.lastName} with payer ${officeAllyPayerId}`);

    // Generate X12 270 request
    const x12_270 = await generateDatabaseDrivenX12_270(
      officeAllyPayerId,
      patientData,
      providerNpi
    );

    if (!x12_270) {
      throw new Error('Failed to generate X12 270 request');
    }

    console.log('✅ Generated X12 270 request');
    console.log('📤 X12 270 Preview (first 200 chars):', x12_270.substring(0, 200));
    console.log('📊 X12 270 Length:', x12_270.length, 'bytes');

    // Send to Office Ally
    const endpoint = process.env.OFFICE_ALLY_ENDPOINT || 'https://wsd.officeally.com/TransactionService/rtx.svc';
    const username = process.env.OFFICE_ALLY_USERNAME;
    const password = process.env.OFFICE_ALLY_PASSWORD;

    console.log('🌐 Office Ally Endpoint:', endpoint);
    console.log('👤 Username:', username ? `${username.substring(0, 3)}***` : 'NOT SET');

    if (!username || !password) {
      throw new Error('Office Ally credentials not configured');
    }

    const x12_271 = await sendX12ToOfficeAlly(x12_270, endpoint, username, password);
    console.log('✅ Received X12 271 response from Office Ally');

    // Parse X12 271 response
    const financialData = extractFinancialBenefits(x12_271);

    // Check for eligibility
    const isEligible = x12_271.includes('EB*1') || x12_271.includes('EB*C');
    const coverageStatus = isEligible ? 'Active' : 'Inactive';

    // Extract actual payer/MCO name from response
    const payerName = extractPayerName(x12_271);
    const managedCareOrg = extractManagedCareOrg(x12_271);

    // Check Moonlit billability (separate from patient eligibility)
    console.log('💰 Checking Moonlit billability...');
    const billability = await checkMoonlitBillability(payerName, managedCareOrg);
    console.log(`💰 Billability result: ${billability.status} - ${billability.message}`);

    return {
      isEligible,
      coverageStatus,
      payerName: payerName || null,
      managedCareOrg: managedCareOrg || null,
      planType: financialData?.planType || null,
      effectiveDate: null,
      terminationDate: null,
      copayInfo: financialData ? {
        primaryCareCopay: financialData.primaryCareCopay,
        specialistCopay: financialData.specialistCopay,
        urgentCareCopay: financialData.urgentCareCopay,
        mentalHealthOutpatient: financialData.mentalHealthOutpatient
      } : null,
      deductibleInfo: financialData ? {
        deductibleTotal: financialData.deductibleTotal,
        deductibleMet: financialData.deductibleMet,
        deductibleRemaining: financialData.deductibleRemaining
      } : null,
      moonlitBillability: billability,
      warnings: [],
      raw270: x12_270,
      raw271: x12_271
    };

  } catch (error) {
    console.error('❌ Eligibility check failed:', error);
    throw error;
  }
}

/**
 * Generate SOAP envelope for Office Ally Real-Time Transaction
 */
function generateOfficeAllySOAPRequest(x12Payload: string, username: string, password: string, senderID: string): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const payloadID = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });

  return `<soapenv:Envelope xmlns:soapenv="http://www.w3.org/2003/05/soap-envelope">
<soapenv:Header>
<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
<wsse:UsernameToken>
<wsse:Username>${username}</wsse:Username>
<wsse:Password>${password}</wsse:Password>
</wsse:UsernameToken>
</wsse:Security>
</soapenv:Header>
<soapenv:Body>
<ns1:COREEnvelopeRealTimeRequest xmlns:ns1="http://www.caqh.org/SOAP/WSDL/CORERule2.2.0.xsd">
<PayloadType>X12_270_Request_005010X279A1</PayloadType>
<ProcessingMode>RealTime</ProcessingMode>
<PayloadID>${payloadID}</PayloadID>
<TimeStamp>${timestamp}</TimeStamp>
<SenderID>${senderID}</SenderID>
<ReceiverID>OFFALLY</ReceiverID>
<CORERuleVersion>2.2.0</CORERuleVersion>
<Payload>
<![CDATA[${x12Payload}]]>
</Payload>
</ns1:COREEnvelopeRealTimeRequest>
</soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Parse Office Ally SOAP response to extract X12 271
 */
function parseOfficeAllySOAPResponse(soapResponse: string): string {
  const payloadMatch = soapResponse.match(/<Payload[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/Payload>/s) ||
                       soapResponse.match(/<Payload[^>]*>(.*?)<\/Payload>/s) ||
                       soapResponse.match(/<ns1:Payload[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/ns1:Payload>/s) ||
                       soapResponse.match(/<ns1:Payload[^>]*>(.*?)<\/ns1:Payload>/s);

  if (!payloadMatch) {
    console.log('🔍 Office Ally SOAP Response (first 500 chars):', soapResponse.substring(0, 500));
    throw new Error('No payload found in Office Ally SOAP response');
  }

  return payloadMatch[1].trim();
}

/**
 * Send SOAP request to Office Ally and receive X12 271 response
 */
async function sendX12ToOfficeAlly(
  x12_270: string,
  endpoint: string,
  username: string,
  password: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Wrap X12 in SOAP envelope
    const senderID = process.env.OFFICE_ALLY_SENDER_ID || '1161680';
    const soapRequest = generateOfficeAllySOAPRequest(x12_270, username, password, senderID);

    console.log('📤 SOAP Request Length:', soapRequest.length, 'bytes');

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8;action=RealTimeTransaction;',
        'Action': 'RealTimeTransaction',
        'Content-Length': Buffer.byteLength(soapRequest)
      }
    };

    const url = new URL(endpoint);
    const req = https.request({
      ...options,
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST'
    }, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`📥 Office Ally Response Status: ${res.statusCode}`);
        console.log(`📥 Response Headers:`, JSON.stringify(res.headers, null, 2));
        console.log(`📥 FULL Response Body:`, data);

        if (res.statusCode === 200 || res.statusCode === 201) {
          // Check if it's an error response
          if (data.includes('COREEnvelopeError')) {
            console.error(`❌ Office Ally returned a COREEnvelopeError`);
            // Extract error message
            const errorMatch = data.match(/<ErrorMessage[^>]*>(.*?)<\/ErrorMessage>/s);
            const errorDesc = data.match(/<ErrorDescription[^>]*>(.*?)<\/ErrorDescription>/s);
            const errorMsg = errorMatch ? errorMatch[1] : 'Unknown error';
            const errorDescMsg = errorDesc ? errorDesc[1] : '';
            console.error(`❌ Error Message: ${errorMsg}`);
            console.error(`❌ Error Description: ${errorDescMsg}`);
            reject(new Error(`Office Ally COREEnvelopeError: ${errorMsg} ${errorDescMsg}`));
            return;
          }

          // Parse SOAP response to extract X12 271
          try {
            const x12_271 = parseOfficeAllySOAPResponse(data);
            console.log('✅ Extracted X12 271 from SOAP response (length:', x12_271.length, 'bytes)');
            resolve(x12_271);
          } catch (parseError: any) {
            console.error(`❌ Failed to parse SOAP response:`, parseError.message);
            reject(parseError);
          }
        } else {
          console.error(`❌ Office Ally Error - Status: ${res.statusCode}, Body: ${data}`);
          reject(new Error(`Office Ally returned status ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Failed to connect to Office Ally: ${error.message}`));
    });

    req.write(soapRequest);
    req.end();
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

export const eligibilityService = {
  getPayerDropdownOptions,
  getPayerConfig,
  getPreferredProvider,
  generateDynamicFormConfig,
  generateDatabaseDrivenX12_270,
  parseX12_271ForAutoPopulation,
  checkEligibility,
  logEligibilityCheck
};
