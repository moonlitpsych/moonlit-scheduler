// Referral Network Specialty Tags API
// GET /api/admin/referral-network/specialty-tags - List all specialty tags

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { isAdminEmail } from '@/lib/admin-auth'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import type { ReferralSpecialtyTag, SpecialtyTagsResponse } from '@/types/referral-network'

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

// GET - List all active specialty tags
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await verifyReferralAccess()
    if (!authorized) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 403 }
      )
    }

    const { data: specialtyTags, error } = await supabaseAdmin
      .from('referral_specialty_tags')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching specialty tags:', error)
      return NextResponse.json(
        { success: false, error: 'Failed to fetch specialty tags' },
        { status: 500 }
      )
    }

    const tags = specialtyTags as ReferralSpecialtyTag[]

    // Group by category
    const byCategory = {
      clinical: tags.filter(t => t.tag_category === 'clinical'),
      population: tags.filter(t => t.tag_category === 'population'),
      administrative: tags.filter(t => t.tag_category === 'administrative')
    }

    const response: SpecialtyTagsResponse = {
      specialty_tags: tags,
      by_category: byCategory
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Specialty tags API error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
