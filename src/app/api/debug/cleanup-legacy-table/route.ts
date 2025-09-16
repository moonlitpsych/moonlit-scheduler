// Cleanup Legacy partner_contacts Table
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting legacy table cleanup...')

    const results: any[] = []

    // 1. Final verification that contacts table is working
    const { data: contactsCheck, error: contactsError, count: contactsCount } = await supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact', head: true })

    if (contactsError || !contactsCount || contactsCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Contacts table not ready - aborting cleanup',
        details: contactsError
      }, { status: 400 })
    }

    results.push({
      step: 'contacts_verification',
      status: 'pass',
      message: `Verified contacts table has ${contactsCount} records`
    })

    // 2. Check legacy table exists and get count
    const { data: legacyCheck, error: legacyError, count: legacyCount } = await supabaseAdmin
      .from('partner_contacts')
      .select('*', { count: 'exact', head: true })

    if (legacyError && legacyError.code === '42P01') {
      results.push({
        step: 'legacy_check',
        status: 'complete',
        message: 'partner_contacts table already does not exist - cleanup complete'
      })

      return NextResponse.json({
        success: true,
        message: 'Cleanup already complete',
        results
      })
    }

    if (legacyError) {
      return NextResponse.json({
        success: false,
        error: 'Error checking legacy table',
        details: legacyError
      }, { status: 500 })
    }

    results.push({
      step: 'legacy_check',
      status: 'pass',
      message: `Found partner_contacts table with ${legacyCount} records`
    })

    // 3. Safety check - ensure record counts match
    if (contactsCount !== legacyCount) {
      return NextResponse.json({
        success: false,
        error: `Record count mismatch: contacts has ${contactsCount}, partner_contacts has ${legacyCount}`,
        details: { contactsCount, legacyCount }
      }, { status: 400 })
    }

    results.push({
      step: 'count_verification',
      status: 'pass',
      message: `Record counts match: ${contactsCount} records in both tables`
    })

    // 4. Drop the legacy table
    console.log('🗑️ Dropping partner_contacts table...')

    // Use raw SQL to drop the table
    const { error: dropError } = await supabaseAdmin
      .rpc('drop_table_if_exists', {
        table_name: 'partner_contacts'
      })

    if (dropError) {
      // Fallback - try direct SQL if RPC doesn't exist
      try {
        const { error: directDropError } = await supabaseAdmin
          .from('partner_contacts')
          .delete()
          .gte('id', '00000000-0000-0000-0000-000000000000') // Delete all rows first

        if (!directDropError) {
          results.push({
            step: 'table_cleanup',
            status: 'partial',
            message: 'Cleared partner_contacts table data (table structure may remain)'
          })
        } else {
          throw directDropError
        }
      } catch (fallbackError: any) {
        return NextResponse.json({
          success: false,
          error: 'Failed to drop legacy table',
          details: { dropError, fallbackError: fallbackError.message }
        }, { status: 500 })
      }
    } else {
      results.push({
        step: 'table_cleanup',
        status: 'complete',
        message: 'Successfully dropped partner_contacts table'
      })
    }

    // 5. Verify cleanup
    const { error: verifyError } = await supabaseAdmin
      .from('partner_contacts')
      .select('*', { count: 'exact', head: true })

    if (verifyError && verifyError.code === '42P01') {
      results.push({
        step: 'cleanup_verification',
        status: 'complete',
        message: 'Verified partner_contacts table no longer exists'
      })
    } else if (verifyError) {
      results.push({
        step: 'cleanup_verification',
        status: 'warning',
        message: 'Table may still exist but is inaccessible',
        details: verifyError
      })
    } else {
      results.push({
        step: 'cleanup_verification',
        status: 'warning',
        message: 'Table structure may still exist'
      })
    }

    console.log('✅ Legacy table cleanup complete')

    return NextResponse.json({
      success: true,
      message: 'Legacy table cleanup completed',
      timestamp: new Date().toISOString(),
      results
    })

  } catch (error: any) {
    console.error('❌ Legacy cleanup error:', error)

    return NextResponse.json({
      success: false,
      error: 'Legacy cleanup failed',
      details: error.message
    }, { status: 500 })
  }
}

// GET method for status check
export async function GET(request: NextRequest) {
  try {
    const { error: contactsError, count: contactsCount } = await supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact', head: true })

    const { error: legacyError, count: legacyCount } = await supabaseAdmin
      .from('partner_contacts')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      current_state: {
        contacts_table: contactsError ? 'error' : 'exists',
        contacts_count: contactsCount || 0,
        legacy_table: legacyError?.code === '42P01' ? 'does_not_exist' : 'exists',
        legacy_count: legacyCount || 0
      },
      ready_for_cleanup: !contactsError && contactsCount > 0 && legacyError?.code !== '42P01'
    })
  } catch (error: any) {
    return NextResponse.json({
      error: 'Status check failed',
      details: error.message
    }, { status: 500 })
  }
}