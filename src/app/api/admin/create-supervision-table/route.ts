import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
    try {
        console.log('🔧 Creating supervision_relationships table...')
        
        // Create the supervision_relationships table
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS supervision_relationships (
                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                rendering_provider_id UUID NOT NULL REFERENCES providers(id),
                billing_provider_id UUID NOT NULL REFERENCES providers(id),
                payer_id UUID NOT NULL REFERENCES payers(id),
                effective_date DATE DEFAULT CURRENT_DATE,
                status TEXT DEFAULT 'active',
                relationship_type TEXT DEFAULT 'supervision',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `

        const { error: createError } = await supabaseAdmin.rpc('exec_sql', {
            sql: createTableSQL
        })

        if (createError) {
            console.error('❌ Error creating table:', createError)
            // Try alternative approach with direct SQL
            const { error: directSqlError } = await supabaseAdmin
                .from('_dummy')
                .select('1')
                .limit(0)
            
            // If even basic query fails, we need to use a different approach
            return NextResponse.json({ 
                error: 'Cannot create table via API. Please run this SQL manually in Supabase dashboard:',
                sql: createTableSQL.trim(),
                original_error: createError.message
            }, { status: 500 })
        }

        console.log('✅ supervision_relationships table created')

        // Verify table exists
        const { data: tableCheck, error: checkError } = await supabaseAdmin
            .from('supervision_relationships')
            .select('*')
            .limit(1)

        if (checkError) {
            return NextResponse.json({
                error: 'Table creation uncertain. Please verify manually.',
                check_error: checkError.message,
                sql_to_run_manually: createTableSQL.trim()
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            message: 'supervision_relationships table created successfully',
            table_exists: true
        })

    } catch (error: any) {
        console.error('💥 Error creating supervision table:', error)
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error.message,
            manual_sql: `
                CREATE TABLE IF NOT EXISTS supervision_relationships (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    rendering_provider_id UUID NOT NULL REFERENCES providers(id),
                    billing_provider_id UUID NOT NULL REFERENCES providers(id),
                    payer_id UUID NOT NULL REFERENCES payers(id),
                    effective_date DATE DEFAULT CURRENT_DATE,
                    status TEXT DEFAULT 'active',
                    relationship_type TEXT DEFAULT 'supervision',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
            `.trim()
        }, { status: 500 })
    }
}

export async function GET() {
    try {
        // Check if supervision_relationships table exists
        const { data, error } = await supabaseAdmin
            .from('supervision_relationships')
            .select('*')
            .limit(1)

        if (error) {
            return NextResponse.json({
                table_exists: false,
                error: error.message,
                message: 'supervision_relationships table does not exist'
            })
        }

        return NextResponse.json({
            table_exists: true,
            message: 'supervision_relationships table exists',
            sample_data: data
        })

    } catch (error: any) {
        return NextResponse.json({
            table_exists: false,
            error: error.message
        })
    }
}