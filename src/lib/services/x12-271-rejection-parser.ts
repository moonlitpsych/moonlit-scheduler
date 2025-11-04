/**
 * X12 271 Rejection Parser
 *
 * Parses X12 271 eligibility responses to extract rejection reasons,
 * subscriber relationships, and error messages.
 *
 * @module x12-271-rejection-parser
 */

export interface RejectionAnalysis {
  isRejected: boolean;
  userFriendlyMessage: string | null;
  subscriberRelationship: 'subscriber' | 'dependent' | 'unknown';
  technicalDetails: {
    aaaSegments: string[]; // Rejection/error segments
    insSegments: string[]; // Subscriber relationship indicators
    msgSegments: string[]; // Human-readable messages from payer
  };
}

/**
 * Parse AAA (Error/Rejection) segments from X12 271
 *
 * AAA segment structure:
 * AAA*{Valid/Invalid}**{Reject Reason Code}*{Follow-up Action Code}
 *
 * Common reject reason codes:
 * - 71: Patient not found
 * - 72: Invalid/missing patient information
 * - 79: Invalid subscriber/insured ID
 */
function parseAAASegments(x12_271: string): string[] {
  const aaaSegments: string[] = [];
  const segments = x12_271.split('~');

  for (const segment of segments) {
    if (segment.trim().startsWith('AAA*')) {
      aaaSegments.push(segment.trim());
    }
  }

  return aaaSegments;
}

/**
 * Parse INS (Insured Benefit) segments to determine subscriber relationship
 *
 * INS segment structure:
 * INS*{Y/N}*{Relationship Code}*...
 *
 * Relationship codes:
 * - 01: Subscriber/Policyholder
 * - 18: Self (also subscriber)
 * - 19: Child
 * - 20: Employee
 * - 21: Unknown
 * - 39: Organ Donor
 * - 40: Cadaver Donor
 * - 53: Life Partner
 * - G8: Other Relationship
 */
function parseINSSegments(x12_271: string): string[] {
  const insSegments: string[] = [];
  const segments = x12_271.split('~');

  for (const segment of segments) {
    if (segment.trim().startsWith('INS*')) {
      insSegments.push(segment.trim());
    }
  }

  return insSegments;
}

/**
 * Parse MSG (Message Text) segments
 *
 * MSG segments contain human-readable messages from the payer
 */
function parseMSGSegments(x12_271: string): string[] {
  const msgSegments: string[] = [];
  const segments = x12_271.split('~');

  for (const segment of segments) {
    if (segment.trim().startsWith('MSG*')) {
      msgSegments.push(segment.trim());
    }
  }

  return msgSegments;
}

/**
 * Determine subscriber relationship from INS segments
 */
function determineSubscriberRelationship(insSegments: string[]): 'subscriber' | 'dependent' | 'unknown' {
  if (insSegments.length === 0) {
    return 'unknown';
  }

  // Check the first INS segment (most relevant for eligibility)
  const firstINS = insSegments[0];
  const parts = firstINS.split('*');

  if (parts.length < 3) {
    return 'unknown';
  }

  const relationshipCode = parts[2];

  // Codes indicating subscriber
  if (relationshipCode === '01' || relationshipCode === '18' || relationshipCode === '20') {
    return 'subscriber';
  }

  // Codes indicating dependent
  if (relationshipCode === '19' || relationshipCode === '53' || relationshipCode === 'G8') {
    return 'dependent';
  }

  return 'unknown';
}

/**
 * Generate user-friendly message based on rejection analysis
 */
function generateUserFriendlyMessage(
  aaaSegments: string[],
  insSegments: string[],
  msgSegments: string[],
  subscriberRelationship: 'subscriber' | 'dependent' | 'unknown'
): string | null {
  // If we have MSG segments from the payer, check for configuration errors first
  if (msgSegments.length > 0) {
    const firstMsg = msgSegments[0].replace('MSG*', '').trim();

    // Configuration errors (admin should fix these)
    if (firstMsg.includes('INVALID OFFICE ALLY PAYER ID')) {
      return '⚠️ Configuration Error: The Office Ally payer ID for this insurance is not valid. This is a system configuration issue - please contact Moonlit support to update the payer configuration.';
    }

    // Return other payer messages as-is
    if (firstMsg) {
      return firstMsg;
    }
  }

  // Check for common AAA rejection codes
  if (aaaSegments.length > 0) {
    const firstAAA = aaaSegments[0];

    // AAA*N**71*C means "Invalid" with reject reason code 71
    if (firstAAA.includes('**71*')) {
      if (subscriberRelationship === 'dependent') {
        return 'This patient appears to be listed as a dependent on someone else\'s insurance. Try adding the primary subscriber\'s information (member ID, name, date of birth).';
      }
      return 'Patient not found in payer system. Please verify the member ID and date of birth are correct.';
    }

    // AAA*N**72* means invalid/missing patient information
    if (firstAAA.includes('**72*')) {
      return 'Invalid or missing patient information. Please verify all required fields are correct.';
    }

    // AAA*N**79* means invalid subscriber/insured ID
    if (firstAAA.includes('**79*')) {
      return 'Invalid member ID number. Please verify the member ID matches what\'s on the insurance card.';
    }

    // Generic rejection
    if (firstAAA.startsWith('AAA*N')) {
      return 'Eligibility verification was rejected by the payer. Please verify all patient and insurance information is correct.';
    }
  }

  // If subscriber relationship is dependent but no specific rejection
  if (subscriberRelationship === 'dependent') {
    return 'This patient may be listed as a dependent. Consider providing the primary subscriber\'s information for more accurate results.';
  }

  return null;
}

/**
 * Parse X12 271 response to extract rejection details
 *
 * @param x12_271 - Raw X12 271 response string
 * @returns Comprehensive rejection analysis
 */
export function parseRejection(x12_271: string): RejectionAnalysis {
  const aaaSegments = parseAAASegments(x12_271);
  const insSegments = parseINSSegments(x12_271);
  const msgSegments = parseMSGSegments(x12_271);

  const subscriberRelationship = determineSubscriberRelationship(insSegments);

  // Determine if this is a rejection
  // AAA*N indicates "Not Valid" or rejected
  const isRejected = aaaSegments.some(segment => segment.startsWith('AAA*N'));

  const userFriendlyMessage = isRejected
    ? generateUserFriendlyMessage(aaaSegments, insSegments, msgSegments, subscriberRelationship)
    : null;

  return {
    isRejected,
    userFriendlyMessage,
    subscriberRelationship,
    technicalDetails: {
      aaaSegments,
      insSegments,
      msgSegments
    }
  };
}
