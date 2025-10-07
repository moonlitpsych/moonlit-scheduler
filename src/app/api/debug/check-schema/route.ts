import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Debug endpoint to discover actual database schema
 * Queries information_schema to verify what columns exist
 */
export async function GET(request: NextRequest) {
    try {
        const tablesToCheck = ['appointments', 'providers', 'service_instances', 'payers', 'patients']
        const schemaInfo: Record<string, string[]> = {}

        for (const tableName of tablesToCheck) {
            // Query information_schema for column names
            const { data: columns, error } = await supabaseAdmin
                .from('information_schema.columns')
                .select('column_name')
                .eq('table_schema', 'public')
                .eq('table_name', tableName)
                .order('ordinal_position')

            if (error) {
                console.error(`❌ Error querying schema for ${tableName}:`, error)
                schemaInfo[tableName] = [`ERROR: ${error.message}`]
            } else if (columns) {
                schemaInfo[tableName] = columns.map((col: any) => col.column_name)
            } else {
                schemaInfo[tableName] = []
            }
        }

        // Also try a sample SELECT * to verify
        const sampleQueries: Record<string, any> = {}
        for (const tableName of tablesToCheck) {
            try {
                const { data, error } = await supabaseAdmin
                    .from(tableName)
                    .select('*')
                    .limit(1)

                if (error) {
                    sampleQueries[tableName] = { error: error.message }
                } else if (data && data.length > 0) {
                    sampleQueries[tableName] = {
                        columns: Object.keys(data[0]),
                        sample: data[0]
                    }
                } else {
                    sampleQueries[tableName] = { columns: [], sample: null }
                }
            } catch (err: any) {
                sampleQueries[tableName] = { error: err.message }
            }
        }

        console.log('📋 Database Schema Discovery:')
        for (const [table, columns] of Object.entries(schemaInfo)) {
            console.log(`\n${table}:`)
            console.log(columns.join(', '))
        }

        return NextResponse.json({
            success: true,
            schemaInfo,
            sampleQueries,
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('💥 Schema check failed:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
