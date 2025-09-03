// Debug API to check partner database tables
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking partner database tables...')
    
    const results: any = {}
    
    // Check partner_contacts table
    try {
      const { data: partnerContacts, error: contactsError } = await supabaseAdmin
        .from('partner_contacts')
        .select('*')
        .limit(10)
        
      if (contactsError) {
        results.partner_contacts = { 
          error: contactsError.message, 
          exists: false 
        }
      } else {
        results.partner_contacts = {
          exists: true,
          count: partnerContacts?.length || 0,
          sample_data: partnerContacts?.slice(0, 3) || [],
          columns: partnerContacts?.[0] ? Object.keys(partnerContacts[0]) : []
        }
      }
    } catch (err: any) {
      results.partner_contacts = { 
        error: err.message, 
        exists: false 
      }
    }
    
    // Check organizations table
    try {
      const { data: organizations, error: orgsError } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .limit(10)
        
      if (orgsError) {
        results.organizations = { 
          error: orgsError.message, 
          exists: false 
        }
      } else {
        results.organizations = {
          exists: true,
          count: organizations?.length || 0,
          sample_data: organizations?.slice(0, 3) || [],
          columns: organizations?.[0] ? Object.keys(organizations[0]) : []
        }
      }
    } catch (err: any) {
      results.organizations = { 
        error: err.message, 
        exists: false 
      }
    }
    
    // Check partner_user_organizations table
    try {
      const { data: partnerUserOrgs, error: userOrgsError } = await supabaseAdmin
        .from('partner_user_organizations')
        .select('*')
        .limit(10)
        
      if (userOrgsError) {
        results.partner_user_organizations = { 
          error: userOrgsError.message, 
          exists: false 
        }
      } else {
        results.partner_user_organizations = {
          exists: true,
          count: partnerUserOrgs?.length || 0,
          sample_data: partnerUserOrgs?.slice(0, 3) || [],
          columns: partnerUserOrgs?.[0] ? Object.keys(partnerUserOrgs[0]) : []
        }
      }
    } catch (err: any) {
      results.partner_user_organizations = { 
        error: err.message, 
        exists: false 
      }
    }
    
    // Also check for the partner_users table we were trying to use earlier
    try {
      const { data: partnerUsers, error: usersError } = await supabaseAdmin
        .from('partner_users')
        .select('*')
        .limit(10)
        
      if (usersError) {
        results.partner_users = { 
          error: usersError.message, 
          exists: false 
        }
      } else {
        results.partner_users = {
          exists: true,
          count: partnerUsers?.length || 0,
          sample_data: partnerUsers?.slice(0, 3) || [],
          columns: partnerUsers?.[0] ? Object.keys(partnerUsers[0]) : []
        }
      }
    } catch (err: any) {
      results.partner_users = { 
        error: err.message, 
        exists: false 
      }
    }
    
    console.log('✅ Partner tables analysis complete')
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tables: results
    })
    
  } catch (error: any) {
    console.error('❌ Error checking partner tables:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to check partner tables',
        details: error.message
      },
      { status: 500 }
    )
  }
}