import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * One-time backfill endpoint to normalize phone numbers
 * Converts all phone_number and fax_number fields to digits-only format
 */
export async function POST() {
  try {
    console.log('🔄 Starting phone number normalization backfill...')

    // Get all providers with phone or fax numbers
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, phone_number, fax_number')
      .or('phone_number.not.is.null,fax_number.not.is.null')

    if (providersError) {
      throw new Error(`Failed to fetch providers: ${providersError.message}`)
    }

    console.log(`📋 Found ${providers.length} providers with phone/fax numbers`)

    const results = {
      updated: [] as any[],
      skipped: [] as any[],
      errors: [] as any[]
    }

    // Process each provider
    for (const provider of providers) {
      try {
        let needsUpdate = false
        const updates: any = {}

        // Normalize phone number if present
        if (provider.phone_number) {
          const normalized = normalizePhone(provider.phone_number)
          if (normalized !== provider.phone_number) {
            updates.phone_number = normalized
            needsUpdate = true
          }
        }

        // Normalize fax number if present
        if (provider.fax_number) {
          const normalized = normalizePhone(provider.fax_number)
          if (normalized !== provider.fax_number) {
            updates.fax_number = normalized
            needsUpdate = true
          }
        }

        if (!needsUpdate) {
          console.log(`✓ ${provider.email} - already normalized`)
          results.skipped.push({
            name: `${provider.first_name} ${provider.last_name}`,
            email: provider.email,
            phone: provider.phone_number,
            fax: provider.fax_number
          })
          continue
        }

        // Update the provider
        const { error: updateError } = await supabaseAdmin
          .from('providers')
          .update(updates)
          .eq('id', provider.id)

        if (updateError) {
          throw new Error(`Failed to update: ${updateError.message}`)
        }

        console.log(`✅ Normalized ${provider.email}`, updates)
        results.updated.push({
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email,
          before: {
            phone: provider.phone_number,
            fax: provider.fax_number
          },
          after: updates
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

    console.log('🎉 Phone normalization backfill complete!')
    console.log(`Updated: ${results.updated.length}, Skipped: ${results.skipped.length}, Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      message: 'Phone normalization backfill completed',
      results: results
    })

  } catch (error: any) {
    console.error('❌ Backfill failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Phone normalization backfill failed',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Normalize phone to digits only
 */
function normalizePhone(phone: string): string {
  if (!phone) return ''

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')

  // Handle 11-digit with US country code
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    return digitsOnly.substring(1)
  }

  return digitsOnly
}
