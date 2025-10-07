/**
 * Debug endpoint to check appointment_type constraint
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Query pg_constraint to find the CHECK constraint definition
        const { data: constraintData, error: constraintError } = await supabaseAdmin
            .rpc('exec_sql', {
                query: `
                    SELECT
                        conname AS constraint_name,
                        pg_get_constraintdef(oid) AS constraint_definition
                    FROM pg_constraint
                    WHERE conname = 'appointments_appointment_type_check'
                `
            })

        if (constraintError) {
            // Try alternative method using information_schema
            const { data: columnData, error: columnError } = await supabaseAdmin
                .rpc('exec_sql', {
                    query: `
                        SELECT
                            column_name,
                            data_type,
                            udt_name,
                            character_maximum_length
                        FROM information_schema.columns
                        WHERE table_name = 'appointments'
                        AND column_name = 'appointment_type'
                    `
                })

            return NextResponse.json({
                success: true,
                method: 'information_schema',
                column_info: columnData,
                note: 'Could not access pg_constraint directly. Column info returned instead.',
                error: constraintError?.message
            })
        }

        return NextResponse.json({
            success: true,
            constraint: constraintData,
            note: 'Found constraint definition from pg_constraint'
        })

    } catch (error: any) {
        console.error('❌ Error checking constraint:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
