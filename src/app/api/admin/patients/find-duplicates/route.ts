import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Find duplicate patient records based on email
 * GET /api/admin/patients/find-duplicates
 */
export async function GET() {
  try {
    console.log('🔍 Searching for duplicate patients...')

    // Find all patients grouped by email where count > 1
    const { data: allPatients, error } = await supabaseAdmin
      .from('patients')
      .select('id, first_name, last_name, email, phone, date_of_birth, created_at, updated_at')
      .not('email', 'is', null)
      .order('email')

    if (error) {
      throw new Error(`Failed to fetch patients: ${error.message}`)
    }

    // Group by email
    const emailGroups: Record<string, any[]> = {}
    allPatients.forEach(patient => {
      const email = patient.email.toLowerCase()
      if (!emailGroups[email]) {
        emailGroups[email] = []
      }
      emailGroups[email].push(patient)
    })

    // Filter to only duplicates (2+ patients with same email)
    const duplicates = Object.entries(emailGroups)
      .filter(([_, patients]) => patients.length > 1)
      .map(([email, patients]) => ({
        email,
        count: patients.length,
        patients: patients.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }))

    console.log(`Found ${duplicates.length} emails with duplicates`)

    return NextResponse.json({
      success: true,
      duplicate_count: duplicates.length,
      total_duplicate_records: duplicates.reduce((sum, d) => sum + d.count, 0),
      duplicates: duplicates.map(d => ({
        email: d.email,
        count: d.count,
        patients: d.patients.map(p => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`,
          created_at: p.created_at,
          date_of_birth: p.date_of_birth
        }))
      }))
    })

  } catch (error: any) {
    console.error('❌ Error finding duplicates:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to find duplicate patients',
      details: error.message
    }, { status: 500 })
  }
}
