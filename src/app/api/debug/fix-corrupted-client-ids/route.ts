// Debug endpoint to find and fix corrupted IntakeQ client IDs
// Malformed formats: {"Id":"98"}, '{"Id":"98"}', etc.
// Expected format: "98" (plain numeric string)
// SECURITY: Admin-only endpoint - disabled in production

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeIntakeqClientId, isValidIntakeqClientId } from '@/lib/intakeq/utils'

// SECURITY: Disable in production to prevent PHI/PII exposure
function checkDebugAccess(): NextResponse | null {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({
            success: false,
            error: 'Debug endpoints are disabled in production'
        }, { status: 403 })
    }
    return null
}

export async function GET(request: NextRequest) {
    // Security check
    const accessDenied = checkDebugAccess()
    if (accessDenied) return accessDenied

    try {
        console.log('🔍 Scanning for corrupted IntakeQ client IDs...')

        // Get all patients with intakeq_client_id
        const { data: patients, error } = await supabaseAdmin
            .from('patients')
            .select('id, first_name, last_name, email, intakeq_client_id')
            .not('intakeq_client_id', 'is', null)

        if (error) {
            throw error
        }

        const corrupted: Array<{
            patient_id: string
            name: string
            email: string
            current_value: any
            current_type: string
            normalized_value: string
            is_valid: boolean
        }> = []

        const valid: Array<{
            patient_id: string
            name: string
            client_id: string
        }> = []

        for (const patient of patients || []) {
            const currentValue = patient.intakeq_client_id
            const normalizedValue = normalizeIntakeqClientId(currentValue)
            const isValid = isValidIntakeqClientId(normalizedValue)

            const patientInfo = {
                patient_id: patient.id,
                name: `${patient.first_name} ${patient.last_name}`,
                email: patient.email
            }

            // Check if normalization changed the value (means it was corrupted)
            const wasCorrupted = typeof currentValue !== 'string' || currentValue !== normalizedValue

            if (wasCorrupted || !isValid) {
                corrupted.push({
                    ...patientInfo,
                    current_value: currentValue,
                    current_type: typeof currentValue,
                    normalized_value: normalizedValue,
                    is_valid: isValid
                })
            } else {
                valid.push({
                    ...patientInfo,
                    client_id: normalizedValue
                })
            }
        }

        console.log(`✅ Scan complete: ${corrupted.length} corrupted, ${valid.length} valid`)

        return NextResponse.json({
            success: true,
            summary: {
                total_patients: patients?.length || 0,
                corrupted_count: corrupted.length,
                valid_count: valid.length
            },
            corrupted,
            valid
        })

    } catch (error: any) {
        console.error('❌ Error scanning for corrupted client IDs:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    // Security check
    const accessDenied = checkDebugAccess()
    if (accessDenied) return accessDenied

    try {
        const body = await request.json()
        const { dry_run = true } = body

        console.log(`🔧 ${dry_run ? 'DRY RUN:' : 'FIXING:'} Corrupted IntakeQ client IDs...`)

        // Get all patients with intakeq_client_id
        const { data: patients, error: fetchError } = await supabaseAdmin
            .from('patients')
            .select('id, first_name, last_name, intakeq_client_id')
            .not('intakeq_client_id', 'is', null)

        if (fetchError) {
            throw fetchError
        }

        const fixes: Array<{
            patient_id: string
            name: string
            before: any
            after: string
            fixed: boolean
            error?: string
        }> = []

        for (const patient of patients || []) {
            const currentValue = patient.intakeq_client_id
            const normalizedValue = normalizeIntakeqClientId(currentValue)
            const isValid = isValidIntakeqClientId(normalizedValue)

            // Only fix if normalization changed the value
            const needsFix = typeof currentValue !== 'string' || currentValue !== normalizedValue

            if (needsFix && isValid) {
                const fixRecord = {
                    patient_id: patient.id,
                    name: `${patient.first_name} ${patient.last_name}`,
                    before: currentValue,
                    after: normalizedValue,
                    fixed: false
                }

                if (!dry_run) {
                    // Actually update the database
                    const { error: updateError } = await supabaseAdmin
                        .from('patients')
                        .update({ intakeq_client_id: normalizedValue })
                        .eq('id', patient.id)

                    if (updateError) {
                        fixRecord.error = updateError.message
                        console.error(`❌ Failed to fix patient ${patient.id}:`, updateError)
                    } else {
                        fixRecord.fixed = true
                        console.log(`✅ Fixed patient ${patient.id}: ${JSON.stringify(currentValue)} → "${normalizedValue}"`)
                    }
                } else {
                    console.log(`🔍 Would fix patient ${patient.id}: ${JSON.stringify(currentValue)} → "${normalizedValue}"`)
                }

                fixes.push(fixRecord)
            }
        }

        return NextResponse.json({
            success: true,
            dry_run,
            summary: {
                total_patients_scanned: patients?.length || 0,
                fixes_needed: fixes.length,
                fixes_applied: dry_run ? 0 : fixes.filter(f => f.fixed).length,
                fixes_failed: dry_run ? 0 : fixes.filter(f => !f.fixed && f.error).length
            },
            fixes,
            message: dry_run
                ? 'Dry run complete. Send POST with {"dry_run": false} to apply fixes.'
                : 'Database update complete.'
        })

    } catch (error: any) {
        console.error('❌ Error fixing corrupted client IDs:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
