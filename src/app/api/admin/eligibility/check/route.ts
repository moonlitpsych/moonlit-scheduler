// Admin Eligibility Check API
// POST /api/admin/eligibility/check - Perform real-time eligibility check via Office Ally

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin-auth';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { eligibilityService } from '@/lib/services/database-driven-eligibility';

async function verifyAdminAccess() {
  try {
    const supabase = createServerComponentClient({ cookies });
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user || !isAdminEmail(user.email || '')) {
      return { authorized: false, user: null };
    }

    return { authorized: true, user };
  } catch (error) {
    console.error('Admin verification error:', error);
    return { authorized: false, user: null };
  }
}

/**
 * Request body interface for eligibility check
 */
interface EligibilityCheckRequest {
  // Required fields
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD format
  officeAllyPayerId: string; // e.g., 'UTMCD', '60054', '00910'

  // Optional fields (depending on payer requirements)
  gender?: 'M' | 'F' | 'U' | 'X';
  memberNumber?: string;
  medicaidId?: string;
  groupNumber?: string;
  ssn?: string;

  // Optional provider override
  providerNpi?: string;
}

// POST - Perform eligibility check
export async function POST(request: NextRequest) {
  try {
    const { authorized, user } = await verifyAdminAccess();
    if (!authorized || !user) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log(`🔍 Admin eligibility check requested by ${user.email}`);

    // Parse request body
    const body: EligibilityCheckRequest = await request.json();
    const {
      firstName,
      lastName,
      dateOfBirth,
      officeAllyPayerId,
      gender,
      memberNumber,
      medicaidId,
      groupNumber,
      ssn,
      providerNpi
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !dateOfBirth || !officeAllyPayerId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: firstName, lastName, dateOfBirth, officeAllyPayerId'
        },
        { status: 400 }
      );
    }

    // Build patient data object
    const patientData = {
      firstName,
      lastName,
      dateOfBirth,
      gender,
      memberNumber,
      medicaidId,
      groupNumber,
      ssn
    };

    console.log(`📋 Checking eligibility for ${firstName} ${lastName} (DOB: ${dateOfBirth}) with payer ${officeAllyPayerId}`);

    // Perform eligibility check
    const startTime = Date.now();
    const eligibilityResult = await eligibilityService.checkEligibility(
      officeAllyPayerId,
      patientData,
      providerNpi
    );
    const responseTimeMs = Date.now() - startTime;

    console.log(`✅ Eligibility check completed in ${responseTimeMs}ms`);

    // Log eligibility check to database
    try {
      await eligibilityService.logEligibilityCheck(
        user.email,
        patientData,
        officeAllyPayerId,
        eligibilityResult.raw270,
        eligibilityResult.raw271,
        eligibilityResult,
        responseTimeMs
      );
      console.log('📝 Eligibility check logged to database');
    } catch (logError) {
      console.error('⚠️  Failed to log eligibility check (non-fatal):', logError);
      // Don't fail the request if logging fails
    }

    // Return successful response
    return NextResponse.json({
      success: true,
      data: {
        eligibility: eligibilityResult,
        responseTimeMs,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('❌ Eligibility check API error:', error);

    // Handle specific error types
    if (error.message?.includes('Payer not configured')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payer not configured',
          details: error.message
        },
        { status: 404 }
      );
    }

    if (error.message?.includes('Office Ally API error')) {
      return NextResponse.json(
        {
          success: false,
          error: 'External API error',
          details: error.message
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}
