import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Merge duplicate patient records
 * POST /api/admin/patients/merge
 *
 * Body: { email: "patient@example.com" }
 *
 * Keeps the oldest record, moves all data from duplicates to it, deletes duplicates
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email required'
      }, { status: 400 })
    }

    console.log(`🔄 Starting merge for email: ${email}`)

    // Find all patient records with this email
    const { data: patients, error: fetchError } = await supabaseAdmin
      .from('patients')
      .select('*')
      .ilike('email', email)
      .order('created_at')

    if (fetchError) {
      throw new Error(`Failed to fetch patients: ${fetchError.message}`)
    }

    if (!patients || patients.length < 2) {
      return NextResponse.json({
        success: false,
        error: `Found ${patients?.length || 0} records - need at least 2 to merge`
      }, { status: 400 })
    }

    const mainRecord = patients[0] // Keep oldest
    const duplicates = patients.slice(1) // Remove the rest

    console.log(`📋 Main record to keep: ${mainRecord.first_name} ${mainRecord.last_name} (${mainRecord.id})`)
    console.log(`🗑️ Duplicates to remove: ${duplicates.length}`)

    // Tables that reference patients
    const referencingTables = [
      'appointments',
      'patient_engagement_status',
      'patient_engagement_status_history',
      'patient_organization_affiliations',
      'partner_user_patient_assignments'
    ]

    const movedReferences: Record<string, number> = {}

    // Move all references from duplicates to main record
    for (const duplicate of duplicates) {
      console.log(`\n🔄 Processing duplicate: ${duplicate.id}`)

      for (const table of referencingTables) {
        try {
          // Update references to point to main record
          const { data, error } = await supabaseAdmin
            .from(table)
            .update({ patient_id: mainRecord.id })
            .eq('patient_id', duplicate.id)
            .select('id')

          if (!error && data) {
            const count = data.length
            if (count > 0) {
              movedReferences[table] = (movedReferences[table] || 0) + count
              console.log(`  ✅ Moved ${count} records in ${table}`)
            }
          }
        } catch (err: any) {
          console.warn(`  ⚠️ Could not update ${table}:`, err.message)
        }
      }

      // Update main record with any missing data from duplicate
      const updates: any = {}
      if (!mainRecord.date_of_birth && duplicate.date_of_birth) {
        updates.date_of_birth = duplicate.date_of_birth
      }
      if (!mainRecord.phone && duplicate.phone) {
        updates.phone = duplicate.phone
      }

      if (Object.keys(updates).length > 0) {
        console.log(`  📝 Updating main record with missing data:`, updates)
        await supabaseAdmin
          .from('patients')
          .update(updates)
          .eq('id', mainRecord.id)
      }

      // Delete the duplicate
      console.log(`  🗑️ Deleting duplicate: ${duplicate.id}`)
      const { error: deleteError } = await supabaseAdmin
        .from('patients')
        .delete()
        .eq('id', duplicate.id)

      if (deleteError) {
        console.warn(`  ⚠️ Could not delete duplicate: ${deleteError.message}`)
      } else {
        console.log(`  ✅ Deleted duplicate`)
      }
    }

    // Get final state
    const { data: finalPatient } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, date_of_birth, phone, created_at')
      .eq('id', mainRecord.id)
      .single()

    console.log('\n🎉 Merge complete!')

    return NextResponse.json({
      success: true,
      message: `Merged ${duplicates.length} duplicate records into main record`,
      result: {
        kept_record: {
          id: mainRecord.id,
          name: `${mainRecord.first_name} ${mainRecord.last_name}`,
          email: mainRecord.email,
          created_at: mainRecord.created_at
        },
        removed_count: duplicates.length,
        moved_references: movedReferences,
        total_moved: Object.values(movedReferences).reduce((sum, count) => sum + count, 0),
        final_patient: finalPatient
      }
    })

  } catch (error: any) {
    console.error('❌ Merge failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Patient merge failed',
      details: error.message
    }, { status: 500 })
  }
}
