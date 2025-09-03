// Partner Authentication Utilities
// Helper functions for partner user authentication and authorization

import { supabaseAdmin } from './supabase'
import { NextRequest } from 'next/server'
import { PartnerUser } from '@/types/partner-types'

export class PartnerAuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message)
    this.name = 'PartnerAuthError'
  }
}

/**
 * Get partner user from request headers
 * In production, this would extract from JWT token
 * For development, we use x-partner-user-id header
 */
export async function getPartnerUserFromRequest(request: NextRequest): Promise<PartnerUser> {
  // TODO: In production, extract from JWT token
  const partnerUserId = request.headers.get('x-partner-user-id')
  
  if (!partnerUserId) {
    throw new PartnerAuthError('Partner user authentication required', 401)
  }

  const { data: partnerUser, error } = await supabaseAdmin
    .from('partner_users')
    .select(`
      *,
      organization:organizations(
        id,
        name,
        slug,
        type,
        status,
        allowed_domains
      )
    `)
    .eq('id', partnerUserId)
    .eq('status', 'active')
    .single()

  if (error || !partnerUser) {
    throw new PartnerAuthError('Partner user not found or inactive', 404)
  }

  if (partnerUser.organization?.status !== 'active') {
    throw new PartnerAuthError('Organization is not active', 403)
  }

  return partnerUser as PartnerUser
}

/**
 * Check if partner user has access to a specific patient
 */
export async function checkPatientAccess(
  partnerUser: PartnerUser, 
  patientId: string
): Promise<boolean> {
  try {
    const { data: affiliation } = await supabaseAdmin
      .from('patient_organization_affiliations')
      .select('id, roi_consent_status')
      .eq('patient_id', patientId)
      .eq('organization_id', partnerUser.organization_id)
      .eq('status', 'active')
      .single()

    // Check if affiliation exists and ROI consent is granted
    return !!(affiliation && affiliation.roi_consent_status === 'granted')
  } catch (error) {
    return false
  }
}

/**
 * Check if partner user has admin permissions
 */
export function isPartnerAdmin(partnerUser: PartnerUser): boolean {
  return partnerUser.role === 'partner_admin'
}

/**
 * Get organization ID from partner user
 */
export function getOrganizationId(partnerUser: PartnerUser): string {
  return partnerUser.organization_id
}

/**
 * Validate partner user permissions for specific actions
 */
export async function validatePermissions(
  partnerUser: PartnerUser,
  action: string,
  resourceId?: string
): Promise<boolean> {
  switch (action) {
    case 'invite_users':
    case 'manage_users':
    case 'view_organization_settings':
      return isPartnerAdmin(partnerUser)
    
    case 'view_patient':
    case 'request_appointment_change':
      if (!resourceId) return false
      return await checkPatientAccess(partnerUser, resourceId)
    
    case 'view_dashboard':
    case 'view_my_patients':
    case 'update_preferences':
      return true // All partner users can do these
    
    default:
      return false
  }
}

/**
 * Create audit log entry for partner user actions
 */
export async function logPartnerAction(
  partnerUser: PartnerUser,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, any>
) {
  try {
    await supabaseAdmin
      .from('scheduler_audit_logs')
      .insert({
        user_identifier: partnerUser.id,
        action,
        resource_type: resourceType,
        resource_id: resourceId || null,
        details: {
          ...details,
          organization_id: partnerUser.organization_id,
          organization_name: partnerUser.organization?.name,
          partner_user_role: partnerUser.role
        }
      })
  } catch (error) {
    console.error('Failed to log partner action:', error)
    // Don't throw - logging failures shouldn't break the main flow
  }
}

/**
 * Get current partner user organization context
 */
export async function getOrganizationContext(organizationId: string) {
  const { data: organization, error } = await supabaseAdmin
    .from('organizations')
    .select(`
      *,
      partners:partners(count),
      active_users:partner_users!partner_users_organization_id_fkey(count),
      active_patients:patient_organization_affiliations!patient_organization_affiliations_organization_id_fkey(count)
    `)
    .eq('id', organizationId)
    .eq('status', 'active')
    .single()

  if (error || !organization) {
    throw new PartnerAuthError('Organization not found or inactive', 404)
  }

  return organization
}

/**
 * Check if email domain is allowed for organization
 */
export function isEmailDomainAllowed(email: string, allowedDomains: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true // No domain restrictions
  }

  const emailDomain = email.split('@')[1]?.toLowerCase()
  if (!emailDomain) return false

  return allowedDomains.some(domain => 
    domain.toLowerCase() === emailDomain ||
    emailDomain.endsWith('.' + domain.toLowerCase())
  )
}

/**
 * Generate partner user invitation token
 */
export function generateInvitationToken(): string {
  return require('crypto').randomBytes(32).toString('hex')
}

/**
 * Helper to create standardized API responses with partner context
 */
export function createPartnerResponse<T>(
  success: boolean,
  data?: T,
  error?: string,
  partnerUser?: PartnerUser
) {
  const response: any = { success }
  
  if (data !== undefined) response.data = data
  if (error) response.error = error
  
  // Add organization context if available
  if (partnerUser?.organization) {
    response.organization_context = {
      id: partnerUser.organization.id,
      name: partnerUser.organization.name,
      slug: partnerUser.organization.slug
    }
  }
  
  return response
}

/**
 * RLS Policy Helper Functions
 * These would be used in SQL policies for row-level security
 */

// SQL function to get current partner user ID
export const GET_CURRENT_PARTNER_USER_SQL = `
CREATE OR REPLACE FUNCTION current_partner_user_id()
RETURNS UUID AS $$
BEGIN
  -- In production, extract from JWT
  -- For now, return from app context
  RETURN current_setting('app.current_partner_user_id', true)::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`

// SQL function to get current partner organization ID
export const GET_CURRENT_PARTNER_ORG_SQL = `
CREATE OR REPLACE FUNCTION current_partner_org_id()
RETURNS UUID AS $$
DECLARE
  partner_user_id UUID;
  org_id UUID;
BEGIN
  partner_user_id := current_partner_user_id();
  
  IF partner_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  SELECT organization_id INTO org_id
  FROM partner_users 
  WHERE id = partner_user_id AND status = 'active';
  
  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`

// SQL function to check patient access
export const CHECK_PATIENT_ACCESS_SQL = `
CREATE OR REPLACE FUNCTION partner_can_access_patient(patient_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_id UUID;
  has_access BOOLEAN := false;
BEGIN
  org_id := current_partner_org_id();
  
  IF org_id IS NULL THEN
    RETURN false;
  END IF;
  
  SELECT EXISTS(
    SELECT 1 FROM patient_organization_affiliations
    WHERE patient_id = $1
      AND organization_id = org_id
      AND status = 'active'
      AND roi_consent_status = 'granted'
  ) INTO has_access;
  
  RETURN has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`