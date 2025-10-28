import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * One-time backfill endpoint to set temp_password flag for existing auth users
 * This sets temp_password: true for all provider auth accounts that don't have it
 */
export async function POST() {
  try {
    console.log('🔄 Starting password flag backfill...')

    // Get all providers with auth_user_id
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, auth_user_id')
      .not('auth_user_id', 'is', null)

    if (providersError) {
      throw new Error(`Failed to fetch providers: ${providersError.message}`)
    }

    console.log(`📋 Found ${providers.length} providers with auth accounts`)

    const results = {
      updated: [],
      skipped: [],
      errors: []
    }

    // Get all auth users
    const { data: authData } = await supabaseAdmin.auth.admin.listUsers()
    const authUsers = authData?.users || []

    // Process each provider
    for (const provider of providers) {
      try {
        const authUser = authUsers.find(u => u.id === provider.auth_user_id)

        if (!authUser) {
          console.log(`⚠️ No auth user found for ${provider.email}`)
          results.errors.push({
            name: `${provider.first_name} ${provider.last_name}`,
            email: provider.email,
            error: 'Auth user not found'
          })
          continue
        }

        // Check if already has temp_password flag
        if (authUser.user_metadata?.temp_password !== undefined) {
          console.log(`✓ ${provider.email} already has temp_password flag`)
          results.skipped.push({
            name: `${provider.first_name} ${provider.last_name}`,
            email: provider.email,
            current_flag: authUser.user_metadata.temp_password
          })
          continue
        }

        // Update user metadata to add temp_password flag
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          authUser.id,
          {
            user_metadata: {
              ...authUser.user_metadata,
              temp_password: true, // Assume all existing users have temp password
              password_set_at: authUser.created_at // Use account creation date
            }
          }
        )

        if (updateError) {
          throw new Error(`Failed to update: ${updateError.message}`)
        }

        console.log(`✅ Updated ${provider.email}`)
        results.updated.push({
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email,
          auth_user_id: authUser.id
        })

      } catch (error: any) {
        console.error(`❌ Error processing ${provider.email}:`, error.message)
        results.errors.push({
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email,
          error: error.message
        })
      }
    }

    console.log('🎉 Backfill complete!')
    console.log(`Updated: ${results.updated.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      message: 'Password flag backfill completed',
      results: results
    })

  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Password flag backfill failed',
      details: error.message
    }, { status: 500 })
  }
}
