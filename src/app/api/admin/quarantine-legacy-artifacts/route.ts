// Database cleanup SQL to quarantine legacy artifacts
// Safely quarantines old views and tables after migration to canonical views

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface CleanupStep {
    name: string
    description: string
    sql: string
    type: 'VIEW' | 'TABLE' | 'FUNCTION' | 'INDEX'
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
    reversible: boolean
}

interface CleanupResult {
    step: string
    status: 'SUCCESS' | 'SKIPPED' | 'ERROR'
    message: string
    error?: string
}

export async function POST(request: NextRequest) {
    try {
        const { execute = false, steps = 'all' } = await request.json()

        console.log('🧹 Database cleanup operation:', { execute, steps })

        // Define cleanup steps
        const cleanupSteps: CleanupStep[] = [
            {
                name: 'rename_bookable_provider_payers_v2',
                description: 'Rename legacy view to _deprecated suffix',
                sql: `ALTER VIEW IF EXISTS bookable_provider_payers_v2 RENAME TO bookable_provider_payers_v2_deprecated;`,
                type: 'VIEW',
                risk_level: 'LOW',
                reversible: true
            },
            {
                name: 'rename_provider_payer_networks_legacy',
                description: 'Rename legacy provider_payer_networks table to _legacy suffix (if unused)',
                sql: `ALTER TABLE IF EXISTS provider_payer_networks RENAME TO provider_payer_networks_legacy;`,
                type: 'TABLE',
                risk_level: 'HIGH',
                reversible: true
            },
            {
                name: 'create_migration_log',
                description: 'Create migration log table for audit trail',
                sql: `
                CREATE TABLE IF NOT EXISTS migration_logs (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    migration_name TEXT NOT NULL,
                    executed_at TIMESTAMPTZ DEFAULT now(),
                    executed_by TEXT DEFAULT 'system',
                    description TEXT,
                    sql_executed TEXT,
                    status TEXT DEFAULT 'completed',
                    rollback_sql TEXT
                );
                `,
                type: 'TABLE',
                risk_level: 'LOW',
                reversible: true
            },
            {
                name: 'log_view_migration',
                description: 'Log the view migration in audit trail',
                sql: `
                INSERT INTO migration_logs (migration_name, description, sql_executed, rollback_sql) 
                VALUES (
                    'canonical_view_migration_2025_09_10',
                    'Migrated from bookable_provider_payers_v2 to v_bookable_provider_payer canonical view',
                    'Updated all API endpoints to use v_bookable_provider_payer',
                    'Revert API endpoints to use bookable_provider_payers_v2_deprecated'
                );
                `,
                type: 'TABLE',
                risk_level: 'LOW',
                reversible: true
            },
            {
                name: 'create_deprecation_warnings',
                description: 'Create function to warn about deprecated view usage',
                sql: `
                CREATE OR REPLACE FUNCTION warn_deprecated_view_usage()
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE WARNING 'DEPRECATED: bookable_provider_payers_v2_deprecated is deprecated. Use v_bookable_provider_payer instead.';
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql;
                `,
                type: 'FUNCTION',
                risk_level: 'LOW',
                reversible: true
            },
            {
                name: 'quarantine_unused_tables',
                description: 'Move unused provider_schedules table to quarantine schema',
                sql: `
                CREATE SCHEMA IF NOT EXISTS quarantine;
                ALTER TABLE IF EXISTS provider_schedules SET SCHEMA quarantine;
                COMMENT ON TABLE quarantine.provider_schedules IS 'Quarantined 2025-09-10: Unused table with 0 records';
                `,
                type: 'TABLE',
                risk_level: 'LOW',
                reversible: true
            },
            {
                name: 'add_canonical_view_comments',
                description: 'Add documentation comments to canonical views',
                sql: `
                COMMENT ON VIEW v_bookable_provider_payer IS 
                'CANONICAL VIEW: Primary source for provider-payer relationships. Replaces bookable_provider_payers_v2 as of 2025-09-10';
                
                COMMENT ON VIEW v_bookable_provider_payer_named IS 
                'CANONICAL VIEW: Provider-payer relationships with provider details. Includes first_name, last_name, etc.';
                `,
                type: 'VIEW',
                risk_level: 'LOW',
                reversible: true
            }
        ]

        const results: CleanupResult[] = []

        // Filter steps if specific ones requested
        const stepsToExecute = steps === 'all' ? cleanupSteps : 
            cleanupSteps.filter(step => steps.includes(step.name))

        console.log(`📋 Cleanup plan: ${stepsToExecute.length} steps`)

        for (const step of stepsToExecute) {
            console.log(`🔧 Processing: ${step.name} (${step.risk_level} risk)`)

            if (!execute) {
                // Dry run mode
                results.push({
                    step: step.name,
                    status: 'SKIPPED',
                    message: `DRY RUN: Would execute ${step.description}`
                })
                continue
            }

            try {
                // Execute the SQL
                const { error } = await supabaseAdmin.rpc('exec_sql', { sql_statement: step.sql })
                
                if (error) {
                    // Try direct execution if exec_sql function doesn't exist
                    const directResult = await supabaseAdmin.from('pg_stat_activity').select('pid').limit(0)
                    if (directResult.error) {
                        throw error
                    }
                    
                    // If we can't execute complex SQL, log as skipped
                    results.push({
                        step: step.name,
                        status: 'SKIPPED',
                        message: `Cannot execute complex SQL: ${step.description}. Run manually in database.`,
                        error: error.message
                    })
                    continue
                }

                results.push({
                    step: step.name,
                    status: 'SUCCESS',
                    message: step.description
                })

                console.log(`✅ Completed: ${step.name}`)

            } catch (error: any) {
                results.push({
                    step: step.name,
                    status: 'ERROR',
                    message: `Failed: ${step.description}`,
                    error: error.message
                })

                console.error(`❌ Error in ${step.name}:`, error.message)

                // Stop on high-risk failures
                if (step.risk_level === 'HIGH') {
                    console.log('🛑 Stopping cleanup due to high-risk failure')
                    break
                }
            }
        }

        // Generate summary
        const summary = {
            total_steps: stepsToExecute.length,
            successful: results.filter(r => r.status === 'SUCCESS').length,
            skipped: results.filter(r => r.status === 'SKIPPED').length,
            errors: results.filter(r => r.status === 'ERROR').length,
            high_risk_executed: results.filter(r => 
                stepsToExecute.find(s => s.name === r.step)?.risk_level === 'HIGH' && r.status === 'SUCCESS'
            ).length
        }

        const overall_status = summary.errors === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS'

        return NextResponse.json({
            success: true,
            operation: execute ? 'DATABASE_CLEANUP_EXECUTED' : 'DATABASE_CLEANUP_PLAN',
            overall_status,
            summary,
            results,
            manual_sql_required: results.filter(r => r.status === 'SKIPPED' && r.message.includes('Run manually')),
            rollback_info: {
                description: 'Most operations are reversible',
                high_risk_operations: stepsToExecute.filter(s => s.risk_level === 'HIGH').map(s => ({
                    step: s.name,
                    rollback_note: s.reversible ? 'Can be reversed with ALTER statements' : 'NOT EASILY REVERSIBLE'
                }))
            },
            next_steps: execute ? [
                'Monitor application for any issues with canonical views',
                'Run performance tests on new view queries',
                'Consider dropping deprecated views after 30-day grace period',
                'Update database documentation to reflect canonical views'
            ] : [
                'Review the cleanup plan above',
                'Execute with { "execute": true } when ready',
                'Backup database before executing HIGH risk operations',
                'Test canonical views in staging environment first'
            ]
        })

    } catch (error: any) {
        console.error('❌ Database cleanup error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Database cleanup failed', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    // Return cleanup plan without executing
    return NextResponse.json({
        success: true,
        message: 'Use POST with { "execute": false } to see cleanup plan, { "execute": true } to execute',
        available_operations: [
            'rename_bookable_provider_payers_v2',
            'rename_provider_payer_networks_legacy', 
            'create_migration_log',
            'log_view_migration',
            'create_deprecation_warnings',
            'quarantine_unused_tables',
            'add_canonical_view_comments'
        ],
        usage: {
            dry_run: 'POST { "execute": false }',
            execute_all: 'POST { "execute": true }',
            execute_specific: 'POST { "execute": true, "steps": ["step_name1", "step_name2"] }'
        }
    })
}