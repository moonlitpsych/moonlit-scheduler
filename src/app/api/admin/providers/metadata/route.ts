// API to fetch provider field metadata from database
// Returns actual values used for dropdown fields like title, provider_type, languages
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Fetching provider metadata from database...')

    // Get distinct titles that are actually used
    const { data: titleData } = await supabaseAdmin
      .from('providers')
      .select('title')
      .not('title', 'is', null)
      .order('title')

    const titles = Array.from(new Set(titleData?.map(p => p.title).filter(Boolean))) as string[]

    // Get distinct provider types
    const { data: providerTypeData } = await supabaseAdmin
      .from('providers')
      .select('provider_type')
      .not('provider_type', 'is', null)
      .order('provider_type')

    const providerTypes = Array.from(new Set(providerTypeData?.map(p => p.provider_type).filter(Boolean))) as string[]

    // Get distinct roles (text field, not role_id)
    const { data: roleData } = await supabaseAdmin
      .from('providers')
      .select('role')
      .not('role', 'is', null)
      .order('role')

    const roles = Array.from(new Set(roleData?.map(p => p.role).filter(Boolean))) as string[]

    // Get all unique languages from languages_spoken arrays
    const { data: languageData } = await supabaseAdmin
      .from('providers')
      .select('languages_spoken')
      .not('languages_spoken', 'is', null)

    const allLanguages = new Set<string>()
    languageData?.forEach(p => {
      if (Array.isArray(p.languages_spoken)) {
        p.languages_spoken.forEach(lang => {
          if (lang) allLanguages.add(lang)
        })
      }
    })
    const languages = Array.from(allLanguages).sort()

    console.log(`✅ Found metadata:`, {
      titles: titles.length,
      providerTypes: providerTypes.length,
      roles: roles.length,
      languages: languages.length
    })

    return NextResponse.json({
      success: true,
      data: {
        titles,
        providerTypes,
        roles,
        languages
      }
    })

  } catch (error: any) {
    console.error('❌ Error fetching provider metadata:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch provider metadata',
        details: error.message
      },
      { status: 500 }
    )
  }
}
