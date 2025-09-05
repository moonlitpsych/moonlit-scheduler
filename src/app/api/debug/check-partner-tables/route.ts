// Debug API to check partner-related tables
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking partner-related tables...')

    // Check available tables
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .like('table_name', '%partner%')

    console.log('📋 Partner-related tables:', tables)

    // Check partner_contacts table structure and data
    const { data: partnerContacts, error: contactsError } = await supabaseAdmin
      .from('partner_contacts')
      .select('*')
      .limit(5)

    console.log('👥 partner_contacts sample data:', partnerContacts)
    console.log('❌ partner_contacts error:', contactsError)

    // Check organizations table structure and data  
    const { data: organizations, error: orgsError } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .limit(5)

    console.log('🏢 organizations sample data:', organizations)
    console.log('❌ organizations error:', orgsError)

    // Get counts
    const { count: partnerContactsCount } = await supabaseAdmin
      .from('partner_contacts')
      .select('*', { count: 'exact', head: true })

    const { count: organizationsCount } = await supabaseAdmin
      .from('organizations')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      tables: tables,
      partner_contacts: {
        count: partnerContactsCount,
        sample: partnerContacts,
        error: contactsError
      },
      organizations: {
        count: organizationsCount,
        sample: organizations,
        error: orgsError
      }
    })

  } catch (error: any) {
    console.error('❌ Debug partner tables error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to debug partner tables',
        details: error.message
      },
      { status: 500 }
    )
  }
}