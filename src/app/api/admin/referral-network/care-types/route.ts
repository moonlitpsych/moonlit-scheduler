// Referral Network Care Types API
// GET /api/admin/referral-network/care-types - List all care types

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { ReferralCareType, CareTypesResponse } from '@/types/referral-network'

async function verifyReferralAccess() {
  try {
    const supabase = createServerComponentClient({ cookies })
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) return { authorized: false, user: null }
    if (await isAdminEmail(user.email || '')) return { authorized: true, user }

    const { data: provider } = await supabaseAdmin
      .from('providers')
      .select('id')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    return { authorized: !!provider, user: provider ? user : null }
  } catch (error) {
    console.error('Referral access verification error:', error)
    return { authorized: false, user: null }
  }
}

// GET - List all active care types
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyReferralAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 403 }
      )
    }

    const { data: careTypes, error } = await supabaseAdmin
      .from('referral_care_types')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching care types:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch care types' },
        { status: 500 }
      )
    }

    const response: CareTypesResponse = {
      care_types: careTypes as ReferralCareType[]
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Care types API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
