// Admin Eligibility History API
// GET /api/admin/eligibility/history - Get recent eligibility check history

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAdminEmail } from '@/lib/admin-auth';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

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
 * Eligibility check history record
 */
interface EligibilityCheckHistory {
  id: string;
  admin_user_email: string;
  patient_first_name: string;
  patient_last_name: string;
  patient_dob: string;
  payer_display_name: string | null;
  office_ally_payer_id: string | null;
  is_eligible: boolean | null;
  coverage_status: string | null;
  copay_amounts: any;
  deductible_info: any;
  response_time_ms: number | null;
  created_at: string;
}

// GET - Get eligibility check history
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyAdminAccess();
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get optional query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const patientName = searchParams.get('patient');
    const adminEmail = searchParams.get('admin');

    console.log(`🔍 Fetching eligibility check history (limit: ${limit}, offset: ${offset})`);

    // Build query
    let query = supabaseAdmin
      .from('eligibility_checks')
      .select(`
        id,
        admin_user_email,
        patient_first_name,
        patient_last_name,
        patient_dob,
        payer_display_name,
        office_ally_payer_id,
        is_eligible,
        coverage_status,
        copay_amounts,
        deductible_info,
        response_time_ms,
        created_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters if provided
    if (patientName) {
      const nameLower = patientName.toLowerCase();
      query = query.or(
        `patient_first_name.ilike.%${nameLower}%,patient_last_name.ilike.%${nameLower}%`
      );
    }

    if (adminEmail) {
      query = query.eq('admin_user_email', adminEmail);
    }

    const { data: checks, error, count } = await query;

    if (error) {
      console.error('❌ Error fetching eligibility history:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch history' },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${checks?.length || 0} eligibility check records`);

    // Get total count for pagination
    const { count: totalCount } = await supabaseAdmin
      .from('eligibility_checks')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      data: {
        checks: checks || [],
        pagination: {
          limit,
          offset,
          totalCount: totalCount || 0,
          hasMore: (offset + limit) < (totalCount || 0)
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Eligibility history API error:', error);

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
