import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🔄 Starting Rufus record merge process...')

    // Get both Rufus records
    const { data: rufusRecords, error: fetchError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .or('first_name.ilike.%rufus%,last_name.ilike.%sweeney%')
      .order('created_date')

    if (fetchError) {
      throw new Error(`Failed to fetch Rufus records: ${fetchError.message}`)
    }

    console.log(`Found ${rufusRecords.length} Rufus records`)

    // Identify which records we're working with
    const testRecord = rufusRecords.find(r => r.email === 'rufus@rufussweeney.com') // Admin role, test data
    const mainRecord = rufusRecords.find(r => r.email === 'rufussweeney@gmail.com') // Provider data, production

    if (!testRecord || !mainRecord) {
      throw new Error('Could not find both Rufus records')
    }

    console.log('📋 Test record (to be removed):', {
      id: testRecord.id,
      email: testRecord.email,
      role: testRecord.role,
      auth_user_id: testRecord.auth_user_id
    })

    console.log('📋 Main record (to be kept and enhanced):', {
      id: mainRecord.id,
      email: mainRecord.email,
      role: mainRecord.role,
      auth_user_id: mainRecord.auth_user_id
    })

    // Step 1: Check what's referencing the test record
    console.log('🔍 Checking references to test record...')
    
    // Check common tables that might reference providers
    const referencingTables = [
      'appointments',
      'provider_availability',
      'provider_availability_cache',
      'provider_payer_networks',
      'provider_services',
      'provider_licenses'
    ]

    const references = {}
    for (const table of referencingTables) {
      try {
        const { data, error } = await supabaseAdmin
          .from(table)
          .select('id')
          .eq('provider_id', testRecord.id)
        
        if (!error && data) {
          references[table] = data.length
          if (data.length > 0) {
            console.log(`📎 Found ${data.length} references in ${table}`)
          }
        }
      } catch (err) {
        console.log(`⚠️ Could not check ${table}:`, err.message)
      }
    }

    // Step 2: Merge the records by updating the main record with admin privileges
    console.log('🔄 Updating main record with admin role...')
    
    const { error: updateError } = await supabaseAdmin
      .from('providers')
      .update({
        role: 'admin' // Give admin privileges to main record
      })
      .eq('id', mainRecord.id)

    if (updateError) {
      throw new Error(`Failed to update main record: ${updateError.message}`)
    }

    // Step 3: Handle the auth user from test record
    console.log('🔑 Handling auth user cleanup...')
    
    // Delete the test record's auth user if it exists
    if (testRecord.auth_user_id) {
      const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(testRecord.auth_user_id)
      if (authDeleteError) {
        console.warn(`⚠️ Could not delete test auth user: ${authDeleteError.message}`)
      } else {
        console.log('✅ Deleted test auth user')
      }
    }

    // Step 4: Try to delete the test record (if no references exist)
    const totalReferences = Object.values(references).reduce((sum, count) => sum + count, 0)
    
    if (totalReferences === 0) {
      console.log('🗑️ Attempting to delete test record...')
      const { error: deleteError } = await supabaseAdmin
        .from('providers')
        .delete()
        .eq('id', testRecord.id)

      if (deleteError) {
        console.warn(`⚠️ Could not delete test record: ${deleteError.message}`)
        console.log('📝 Test record will remain but auth user was cleaned up')
      } else {
        console.log('✅ Successfully deleted test record')
      }
    } else {
      console.log(`📎 Cannot delete test record - has ${totalReferences} references`)
      console.log('📝 Instead, will deactivate it')
      
      // Deactivate the test record instead of deleting
      await supabaseAdmin
        .from('providers')
        .update({
          is_active: false,
          list_on_provider_page: false,
          role: null, // Remove admin role since main record now has it
          auth_user_id: null // Clear auth link since we deleted the user
        })
        .eq('id', testRecord.id)
    }

    // Step 5: Verify final state
    const { data: finalRufus } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, role, auth_user_id, is_active')
      .or('first_name.ilike.%rufus%,last_name.ilike.%sweeney%')
      .order('created_date')

    console.log('🎉 Merge complete!')

    return NextResponse.json({
      success: true,
      message: 'Rufus records merged successfully',
      result: {
        beforeMerge: {
          testRecord: {
            id: testRecord.id,
            email: testRecord.email,
            role: testRecord.role
          },
          mainRecord: {
            id: mainRecord.id,
            email: mainRecord.email,
            role: mainRecord.role
          }
        },
        references: references,
        totalReferences: totalReferences,
        afterMerge: finalRufus
      }
    })

  } catch (error) {
    console.error('❌ Merge failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Rufus record merge failed',
      details: error.message
    }, { status: 500 })
  }
}