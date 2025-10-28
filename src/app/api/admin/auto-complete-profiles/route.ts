import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { checkProfileCompletion, getCompletionMessage } from '@/lib/utils/profileCompletion'

/**
 * Auto-completion endpoint
 * Checks all active providers and sets profile_completed based on required fields
 */
export async function POST() {
  try {
    console.log('🔄 Starting automatic profile completion check...')

    // Get all active providers with ALL fields (including about, intakeq_practitioner_id)
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('*')
      .eq('is_active', true)

    if (providersError) {
      throw new Error(`Failed to fetch providers: ${providersError.message}`)
    }

    console.log(`📋 Checking ${providers.length} active providers`)

    const results = {
      completed: [] as any[],
      incomplete: [] as any[],
      unchanged: [] as any[],
      errors: [] as any[]
    }

    // Check each provider
    for (const provider of providers) {
      try {
        const completionCheck = checkProfileCompletion(provider)
        const currentStatus = provider.profile_completed || false

        // Determine if we need to update
        const shouldBeComplete = completionCheck.isComplete
        const needsUpdate = currentStatus !== shouldBeComplete

        if (!needsUpdate) {
          console.log(`✓ ${provider.email} - already correct (${shouldBeComplete ? 'complete' : 'incomplete'})`)
          results.unchanged.push({
            name: `${provider.first_name} ${provider.last_name}`,
            email: provider.email,
            status: shouldBeComplete ? 'complete' : 'incomplete',
            percentage: completionCheck.completionPercentage
          })
          continue
        }

        // Update profile_completed status
        const { error: updateError } = await supabaseAdmin
          .from('providers')
          .update({
            profile_completed: shouldBeComplete,
            modified_date: new Date().toISOString()
          })
          .eq('id', provider.id)

        if (updateError) {
          throw new Error(`Failed to update: ${updateError.message}`)
        }

        const message = getCompletionMessage(completionCheck)
        console.log(`✅ Updated ${provider.email}: ${message}`)

        if (shouldBeComplete) {
          results.completed.push({
            name: `${provider.first_name} ${provider.last_name}`,
            email: provider.email,
            message: 'Marked as complete',
            percentage: 100
          })
        } else {
          results.incomplete.push({
            name: `${provider.first_name} ${provider.last_name}`,
            email: provider.email,
            message,
            percentage: completionCheck.completionPercentage,
            missingFields: completionCheck.missingFields
          })
        }

      } catch (error: any) {
        console.error(`❌ Error processing ${provider.email}:`, error.message)
        results.errors.push({
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email,
          error: error.message
        })
      }
    }

    console.log('🎉 Auto-completion check complete!')
    console.log(`Completed: ${results.completed.length}, Incomplete: ${results.incomplete.length}, Unchanged: ${results.unchanged.length}, Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      message: 'Profile completion check completed',
      results: results
    })

  } catch (error: any) {
    console.error('❌ Auto-completion failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Profile completion check failed',
      details: error.message
    }, { status: 500 })
  }
}
