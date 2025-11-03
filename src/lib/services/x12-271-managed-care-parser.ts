/**
 * X12 271 Managed Care Detection Parser
 *
 * Detects managed care organizations (MCOs) in X12 271 responses
 * to properly identify whether a patient is enrolled in:
 * - Fee-for-Service (FFS) Medicaid
 * - Managed Care Organization (MCO) Medicaid
 *
 * This is CRITICAL for Utah Medicaid because:
 * - FFS patients can see ANY Medicaid provider
 * - MCO patients must see IN-NETWORK providers for their specific MCO
 */

/**
 * Managed Care Organization details
 */
export interface ManagedCareOrgDetails {
  name: string;
  displayName: string;
  phone: string;
  type: 'ACO' | 'MCO';
  requires_network_verification: boolean;
}

/**
 * Utah Managed Care Organizations registry
 */
export const UTAH_MANAGED_CARE_ORGS: Record<string, ManagedCareOrgDetails> = {
  '2000002': {
    name: 'Health Choice Utah',
    displayName: 'Health Choice Utah (Integrated Medicaid Managed Care)',
    phone: '877-358-8797',
    type: 'ACO',
    requires_network_verification: true
  },
  '2000001': {
    name: 'Molina Healthcare',
    displayName: 'Molina Healthcare of Utah (Medicaid Managed Care)',
    phone: '800-424-5891',
    type: 'MCO',
    requires_network_verification: true
  },
  '2000000': {
    name: 'SelectHealth',
    displayName: 'SelectHealth Community Care (Medicaid Managed Care)',
    phone: '800-538-5038',
    type: 'MCO',
    requires_network_verification: true
  }
};

/**
 * Detected managed care organization with payer details
 */
export interface DetectedMCO extends ManagedCareOrgDetails {
  payerId: string;
  detectedName?: string;
}

/**
 * Managed care information result
 */
export interface ManagedCareInfo {
  isManagedCare: boolean;
  organizations: DetectedMCO[];
  primaryMCO: DetectedMCO;
  planType: string | null;
  requiresNetworkCheck: boolean;
}

/**
 * Plan information result
 */
export interface PlanInfo {
  planType: string;
  program: string;
  isManagedCare: boolean;
  managedCareOrg?: string;
  mcoPhone?: string;
  requiresNetworkCheck: boolean;
  warning?: string;
}

/**
 * Managed care warning for display
 */
export interface ManagedCareWarning {
  type: 'warning';
  title: string;
  message: string;
  mcoName: string;
  mcoPhone?: string;
  action: 'VERIFY_NETWORK';
}

/**
 * Detect managed care organization from X12 271 response
 * @param x12_271 - Raw X12 271 response
 * @returns Managed care info or null if FFS
 */
export function detectManagedCare(x12_271: string): ManagedCareInfo | null {
  if (!x12_271) return null;

  // Look for Loop 2120 segments which contain other payer information
  // Format: LS*2120~NM1*PR*2*[PAYER NAME]*****PI*[PAYER ID]~
  const loop2120Pattern = /LS\*2120~NM1\*PR\*2\*([^\*]+)\*+PI\*([^~]+)~/g;
  let match;
  const managedCareOrgs: DetectedMCO[] = [];

  while ((match = loop2120Pattern.exec(x12_271)) !== null) {
    const payerName = match[1].trim();
    const payerId = match[2].trim();

    // Check if this is a known MCO
    if (UTAH_MANAGED_CARE_ORGS[payerId]) {
      managedCareOrgs.push({
        ...UTAH_MANAGED_CARE_ORGS[payerId],
        payerId: payerId,
        detectedName: payerName
      });
    } else if (payerName.includes('HEALTH CHOICE')) {
      managedCareOrgs.push({
        name: 'Health Choice Utah',
        displayName: payerName,
        payerId: payerId,
        phone: '877-358-8797',
        type: 'ACO',
        requires_network_verification: true
      });
    } else if (payerName.includes('MOLINA')) {
      managedCareOrgs.push({
        name: 'Molina Healthcare',
        displayName: payerName,
        payerId: payerId,
        phone: '800-424-5891',
        type: 'MCO',
        requires_network_verification: true
      });
    } else if (payerName.includes('SELECTHEALTH') || payerName.includes('SELECT HEALTH')) {
      managedCareOrgs.push({
        name: 'SelectHealth',
        displayName: payerName,
        payerId: payerId,
        phone: '800-538-5038',
        type: 'MCO',
        requires_network_verification: true
      });
    }
  }

  // Also check for plan type indicators in EB segments
  // HM* = Health Maintenance (typically indicates MCO)
  // MC* = Managed Care
  const hasManagedCarePlan = x12_271.includes('*HM*') || x12_271.includes('MC INTEGRATED');

  // Extract plan type from EB segments
  const planTypeMatch = x12_271.match(/EB\*[^\*]*\*[^\*]*\*[^\*]*\*HM\*([^~]+)~/);
  const planType = planTypeMatch ? planTypeMatch[1] : null;

  if (managedCareOrgs.length > 0) {
    return {
      isManagedCare: true,
      organizations: managedCareOrgs,
      primaryMCO: managedCareOrgs[0], // First one is usually primary
      planType: planType,
      requiresNetworkCheck: true
    };
  } else if (hasManagedCarePlan) {
    // Found managed care indicators but couldn't identify specific MCO
    return {
      isManagedCare: true,
      organizations: [],
      primaryMCO: {
        name: 'Unknown Managed Care Organization',
        displayName: planType || 'Managed Care Plan',
        payerId: 'UNKNOWN',
        phone: '',
        type: 'MCO',
        requires_network_verification: true
      },
      planType: planType,
      requiresNetworkCheck: true
    };
  }

  return null; // Fee-for-Service
}

/**
 * Extract plan information from X12 271
 * @param x12_271 - Raw X12 271 response
 * @returns Plan details
 */
export function extractPlanInfo(x12_271: string): PlanInfo {
  if (!x12_271) return { planType: 'Unknown', program: 'Unknown', isManagedCare: false, requiresNetworkCheck: false };

  const managedCareInfo = detectManagedCare(x12_271);

  if (managedCareInfo && managedCareInfo.isManagedCare) {
    return {
      planType: 'Integrated Medicaid Managed Care',
      program: managedCareInfo.primaryMCO.displayName || managedCareInfo.planType || 'Unknown MCO',
      isManagedCare: true,
      managedCareOrg: managedCareInfo.primaryMCO.name,
      mcoPhone: managedCareInfo.primaryMCO.phone,
      requiresNetworkCheck: true,
      warning: `Patient is enrolled in ${managedCareInfo.primaryMCO.name}. Verify network status before scheduling.`
    };
  }

  // Check for FFS indicators
  if (x12_271.includes('TRADITIONAL ADULT') || x12_271.includes('FEE FOR SERVICE')) {
    return {
      planType: 'Utah Medicaid Fee-for-Service',
      program: 'Utah Medicaid - Mental Health',
      isManagedCare: false,
      requiresNetworkCheck: false
    };
  }

  // Default
  return {
    planType: 'Utah Medicaid',
    program: 'Utah Medicaid - Mental Health',
    isManagedCare: false,
    requiresNetworkCheck: false
  };
}

/**
 * Format managed care information for display
 * @param managedCareInfo - Result from detectManagedCare()
 * @returns Formatted message or null if FFS
 */
export function formatManagedCareWarning(managedCareInfo: ManagedCareInfo | null): ManagedCareWarning | null {
  if (!managedCareInfo || !managedCareInfo.isManagedCare) {
    return null;
  }

  const mco = managedCareInfo.primaryMCO;

  return {
    type: 'warning',
    title: 'IMPORTANT: Managed Care Plan Detected',
    message: `This patient is enrolled in ${mco.name}. Please verify network status before scheduling.`,
    mcoName: mco.name,
    mcoPhone: mco.phone,
    action: 'VERIFY_NETWORK'
  };
}
