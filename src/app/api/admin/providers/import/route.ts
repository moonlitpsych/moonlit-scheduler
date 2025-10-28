// CSV Import endpoint for bulk provider creation
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateProviderData, sanitizeProviderData } from '@/lib/services/providerValidation'
import { Database } from '@/types/database'

type ProviderInsert = Database['public']['Tables']['providers']['Insert']

interface CSVRow {
  first_name: string
  last_name: string
  email: string
  title?: string
  role?: string
  provider_type?: string
  npi?: string
  phone_number?: string
  fax_number?: string
  address?: string
  date_of_birth?: string
  location_of_birth?: string
  about?: string
  languages_spoken?: string // comma-separated
  is_active?: string // 'true' or 'false'
  is_bookable?: string
  list_on_provider_page?: string
  accepts_new_patients?: string
  telehealth_enabled?: string
  intakeq_practitioner_id?: string
  athena_provider_id?: string
  med_school_org?: string
  med_school_grad_year?: string
  residency_org?: string
  profile_image_url?: string
  utah_id?: string
  caqh_provider_id?: string
}

interface ImportResult {
  rowNumber: number
  success: boolean
  email: string
  provider?: any
  authCreated?: boolean // Whether auth account was created
  authError?: string // Error message if auth creation failed
  authStatus?: 'created' | 'already_exists' | 'failed' | 'skipped' // Auth creation status
  errors?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { csvData, dryRun = false } = body

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No CSV data provided or invalid format'
        },
        { status: 400 }
      )
    }

    console.log(`📥 Importing ${csvData.length} providers (dry run: ${dryRun})`)

    const results: ImportResult[] = []
    const validProviders: ProviderInsert[] = []

    // Process each row
    for (let i = 0; i < csvData.length; i++) {
      const row: CSVRow = csvData[i]
      const rowNumber = i + 2 // +2 because row 1 is header, and array is 0-indexed

      try {
        // Parse boolean fields
        const parseBoolean = (value: string | undefined, defaultValue: boolean = true): boolean => {
          if (value === undefined || value === null || value === '') return defaultValue
          return value.toLowerCase() === 'true' || value === '1' || value === 'yes'
        }

        // Parse languages - keep original capitalization to match database values
        const parsedLanguages = row.languages_spoken
          ? row.languages_spoken.split(',').map(lang => lang.trim())
          : ['English']

        // Build provider data
        const providerData: Partial<ProviderInsert> = {
          first_name: row.first_name?.trim(),
          last_name: row.last_name?.trim(),
          email: row.email?.trim().toLowerCase(),
          title: row.title?.trim(),
          role: row.role?.trim(),
          provider_type: row.provider_type?.trim(),
          npi: row.npi?.trim(),
          phone_number: row.phone_number?.trim(),
          fax_number: row.fax_number?.trim(),
          address: row.address?.trim(),
          date_of_birth: row.date_of_birth?.trim(),
          location_of_birth: row.location_of_birth?.trim(),
          about: row.about?.trim(),
          languages_spoken: parsedLanguages,
          is_active: parseBoolean(row.is_active, true),
          is_bookable: parseBoolean(row.is_bookable, false),
          list_on_provider_page: parseBoolean(row.list_on_provider_page, false),
          accepts_new_patients: parseBoolean(row.accepts_new_patients, true),
          telehealth_enabled: parseBoolean(row.telehealth_enabled, true),
          athena_provider_id: row.athena_provider_id?.trim(),
          med_school_org: row.med_school_org?.trim(),
          residency_org: row.residency_org?.trim(),
          profile_image_url: row.profile_image_url?.trim(),
          utah_id: row.utah_id?.trim(),
          caqh_provider_id: row.caqh_provider_id?.trim(),
          profile_completed: false,
          created_date: new Date().toISOString()
        }

        // Parse med school grad year
        if (row.med_school_grad_year) {
          const year = parseInt(row.med_school_grad_year)
          if (!isNaN(year)) {
            providerData.med_school_grad_year = year
          }
        }

        // Validate provider data
        const validation = await validateProviderData(providerData, false)

        if (!validation.valid) {
          results.push({
            rowNumber,
            success: false,
            email: row.email || 'N/A',
            errors: validation.errors.map(e => `${e.field}: ${e.message}`)
          })
          continue
        }

        // Sanitize
        const sanitized = sanitizeProviderData(providerData) as ProviderInsert

        if (!dryRun) {
          validProviders.push(sanitized)
        }

        results.push({
          rowNumber,
          success: true,
          email: sanitized.email || 'N/A',
          provider: dryRun ? sanitized : undefined
        })

      } catch (error: any) {
        results.push({
          rowNumber,
          success: false,
          email: row.email || 'N/A',
          errors: [error.message]
        })
      }
    }

    // If not dry run, perform bulk insert
    let insertedProviders: any[] = []
    if (!dryRun && validProviders.length > 0) {
      console.log(`💾 Inserting ${validProviders.length} valid providers...`)

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('providers')
        .insert(validProviders)
        .select()

      if (insertError) {
        console.error('❌ Bulk insert error:', insertError)
        return NextResponse.json(
          {
            success: false,
            error: 'Bulk insert failed',
            details: insertError.message,
            validationResults: results
          },
          { status: 500 }
        )
      }

      insertedProviders = inserted || []

      // Update results with inserted provider IDs
      let insertIndex = 0
      for (let i = 0; i < results.length; i++) {
        if (results[i].success && insertIndex < insertedProviders.length) {
          results[i].provider = insertedProviders[insertIndex]
          insertIndex++
        }
      }

      // Create auth accounts for newly inserted providers
      console.log(`🔐 Creating auth accounts for ${insertedProviders.length} providers...`)

      for (const provider of insertedProviders) {
        if (!provider.email) {
          console.log(`⚠️ Skipping auth creation for provider ${provider.id} (no email)`)
          continue
        }

        try {
          // Check if auth user already exists with this email
          const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
          const existingAuth = existingUsers?.users?.find(u => u.email === provider.email)

          if (existingAuth) {
            console.log(`ℹ️ Auth account already exists for ${provider.email}`)

            // Link existing auth to provider if not already linked
            if (!provider.auth_user_id) {
              await supabaseAdmin
                .from('providers')
                .update({ auth_user_id: existingAuth.id })
                .eq('id', provider.id)

              console.log(`🔗 Linked existing auth to provider ${provider.email}`)
            }

            // Update result
            const resultIndex = results.findIndex(r => r.email === provider.email)
            if (resultIndex >= 0) {
              results[resultIndex].authStatus = 'already_exists'
              results[resultIndex].authCreated = false
            }
          } else {
            // Create new auth account
            const { data: newAuth, error: authError } = await supabaseAdmin.auth.admin.createUser({
              email: provider.email,
              password: 'TempPassword123!',
              email_confirm: true,
              user_metadata: {
                first_name: provider.first_name,
                last_name: provider.last_name,
                role: 'provider',
                temp_password: true, // Track if using temporary password
                password_set_at: new Date().toISOString()
              }
            })

            if (authError) {
              console.error(`❌ Failed to create auth for ${provider.email}:`, authError.message)

              // Update result
              const resultIndex = results.findIndex(r => r.email === provider.email)
              if (resultIndex >= 0) {
                results[resultIndex].authStatus = 'failed'
                results[resultIndex].authCreated = false
                results[resultIndex].authError = authError.message
              }
            } else if (newAuth?.user) {
              console.log(`✅ Created auth account for ${provider.email}`)

              // Link auth to provider
              await supabaseAdmin
                .from('providers')
                .update({ auth_user_id: newAuth.user.id })
                .eq('id', provider.id)

              // Update result
              const resultIndex = results.findIndex(r => r.email === provider.email)
              if (resultIndex >= 0) {
                results[resultIndex].authStatus = 'created'
                results[resultIndex].authCreated = true
              }
            }
          }
        } catch (error: any) {
          console.error(`❌ Error creating auth for ${provider.email}:`, error.message)

          // Update result
          const resultIndex = results.findIndex(r => r.email === provider.email)
          if (resultIndex >= 0) {
            results[resultIndex].authStatus = 'failed'
            results[resultIndex].authCreated = false
            results[resultIndex].authError = error.message
          }
        }
      }
    }

    const successCount = results.filter(r => r.success).length
    const errorCount = results.filter(r => !r.success).length

    console.log(`✅ Import complete: ${successCount} success, ${errorCount} errors`)

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        total: csvData.length,
        success: successCount,
        errors: errorCount,
        inserted: dryRun ? 0 : insertedProviders.length
      },
      results
    })

  } catch (error: any) {
    console.error('❌ Error in import:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Import failed',
        details: error.message
      },
      { status: 500 }
    )
  }
}
