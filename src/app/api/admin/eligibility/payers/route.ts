// Admin Eligibility Payers API
// GET /api/admin/eligibility/payers - Get payers configured for Office Ally eligibility checks

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
 * Payer configuration for eligibility checking
 */
interface PayerConfig {
  payer_id: string;
  payer_name: string;
  office_ally_payer_id: string;
  payer_display_name: string;
  category: string;
  required_fields: string[];
  recommended_fields: string[];
  optional_fields: string[];
  is_tested: boolean;
  test_notes: string | null;
}

// GET - List all payers configured for Office Ally eligibility checking
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyAdminAccess();
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('🔍 Admin fetching Office Ally configured payers');

    // Fetch payers from the denormalized view that joins payers with Office Ally configs
    const { data: payers, error } = await supabaseAdmin
      .from('v_office_ally_eligibility_configs')
      .select('*')
      .order('category', { ascending: true })
      .order('payer_display_name', { ascending: true });

    if (error) {
      console.error('❌ Error fetching Office Ally payers:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch payers' },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${payers?.length || 0} Office Ally configured payers`);

    // Group payers by category for easier frontend consumption
    const groupedPayers: Record<string, PayerConfig[]> = {};
    payers?.forEach((payer: any) => {
      const category = payer.category || 'Other';
      if (!groupedPayers[category]) {
        groupedPayers[category] = [];
      }
      groupedPayers[category].push({
        payer_id: payer.payer_id,
        payer_name: payer.payer_name,
        office_ally_payer_id: payer.office_ally_payer_id,
        payer_display_name: payer.payer_display_name,
        category: payer.category,
        required_fields: payer.required_fields || [],
        recommended_fields: payer.recommended_fields || [],
        optional_fields: payer.optional_fields || [],
        is_tested: payer.is_tested,
        test_notes: payer.test_notes
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        payers: payers || [],
        grouped: groupedPayers,
        totalCount: payers?.length || 0
      }
    });

  } catch (error: any) {
    console.error('❌ Admin eligibility payers API error:', error);

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
