// Admin Eligibility Patient Search API
// GET /api/admin/eligibility/patients/search?q=<query> - Search for patients by name or email

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
 * Patient search result
 */
interface PatientSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string | null;
  phone: string | null;
  gender: string | null;
  // Insurance information if available
  primary_insurance_payer?: string | null;
  insurance_member_id?: string | null;
}

// GET - Search for patients
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyAdminAccess();
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get search query from URL params
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    const searchTerm = query.trim().toLowerCase();
    console.log(`🔍 Searching for patients matching: "${searchTerm}"`);

    // Search patients by name or email
    // Using ilike for case-insensitive search
    const { data: patients, error } = await supabaseAdmin
      .from('patients')
      .select(`
        id,
        first_name,
        last_name,
        email,
        date_of_birth,
        phone,
        gender
      `)
      .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .limit(20); // Limit results to prevent overwhelming the UI

    if (error) {
      console.error('❌ Error searching patients:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to search patients' },
        { status: 500 }
      );
    }

    console.log(`✅ Found ${patients?.length || 0} matching patients`);

    // Format patient data for frontend
    const formattedPatients: PatientSearchResult[] = (patients || []).map(patient => ({
      id: patient.id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      email: patient.email,
      date_of_birth: patient.date_of_birth,
      phone: patient.phone,
      gender: patient.gender
    }));

    return NextResponse.json({
      success: true,
      data: {
        patients: formattedPatients,
        totalCount: formattedPatients.length,
        query: searchTerm
      }
    });

  } catch (error: any) {
    console.error('❌ Patient search API error:', error);

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
