// Add performance indexes on key database tables
// Optimizes queries for canonical bookability views and related tables

import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

interface IndexDefinition {
    name: string
    table: string
    columns: string[]
    type: 'BTREE' | 'HASH' | 'GIN' | 'GIST'
    unique: boolean
    condition?: string
    description: string
    estimated_benefit: 'HIGH' | 'MEDIUM' | 'LOW'
    query_patterns: string[]
}

interface IndexResult {
    index: string
    status: 'CREATED' | 'EXISTS' | 'ERROR' | 'SKIPPED'
    message: string
    error?: string
}

export async function POST(request: NextRequest) {
    try {
        const { execute = false, analyze_only = false } = await request.json()

        console.log('📊 Performance index operation:', { execute, analyze_only })

        // Define performance indexes based on query patterns
        const performanceIndexes: IndexDefinition[] = [
            {
                name: 'idx_providers_bookable_active',
                table: 'providers',
                columns: ['is_bookable', 'is_active'],
                type: 'BTREE',
                unique: false,
                condition: 'WHERE is_bookable = true AND is_active = true',
                description: 'Optimize queries for bookable active providers',
                estimated_benefit: 'HIGH',
                query_patterns: [
                    'SELECT * FROM providers WHERE is_bookable = true AND is_active = true',
                    'Provider filtering in booking APIs'
                ]
            },
            {
                name: 'idx_providers_list_on_page',
                table: 'providers',
                columns: ['list_on_provider_page', 'is_active'],
                type: 'BTREE',
                unique: false,
                condition: 'WHERE list_on_provider_page = true',
                description: 'Optimize practitioners directory queries',
                estimated_benefit: 'HIGH',
                query_patterns: [
                    'SELECT * FROM providers WHERE list_on_provider_page = true',
                    'Practitioners directory loading'
                ]
            },
            {
                name: 'idx_providers_languages',
                table: 'providers',
                columns: ['languages_spoken'],
                type: 'GIN',
                unique: false,
                description: 'Optimize language-based provider filtering',
                estimated_benefit: 'MEDIUM',
                query_patterns: [
                    'Language filtering in booking flow',
                    'Provider search by language capability'
                ]
            },
            {
                name: 'idx_provider_payer_networks_lookup',
                table: 'provider_payer_networks',
                columns: ['payer_id', 'provider_id', 'status'],
                type: 'BTREE',
                unique: false,
                condition: 'WHERE status = \'in_network\'',
                description: 'Optimize provider-payer relationship queries',
                estimated_benefit: 'HIGH',
                query_patterns: [
                    'SELECT provider_id FROM provider_payer_networks WHERE payer_id = ? AND status = \'in_network\'',
                    'Insurance acceptance queries'
                ]
            },
            {
                name: 'idx_provider_availability_day_provider',
                table: 'provider_availability',
                columns: ['day_of_week', 'provider_id', 'is_recurring'],
                type: 'BTREE',
                unique: false,
                condition: 'WHERE is_recurring = true',
                description: 'Optimize availability queries by day and provider',
                estimated_benefit: 'HIGH',
                query_patterns: [
                    'SELECT * FROM provider_availability WHERE day_of_week = ? AND provider_id IN (...)',
                    'Calendar availability generation'
                ]
            },
            {
                name: 'idx_provider_availability_cache_date_provider',
                table: 'provider_availability_cache',
                columns: ['date', 'provider_id'],
                type: 'BTREE',
                unique: false,
                description: 'Optimize cache queries by date and provider',
                estimated_benefit: 'HIGH',
                query_patterns: [
                    'SELECT * FROM provider_availability_cache WHERE date >= ? AND provider_id IN (...)',
                    'Availability cache lookups'
                ]
            },
            {
                name: 'idx_provider_availability_cache_service',
                table: 'provider_availability_cache',
                columns: ['service_instance_id', 'date'],
                type: 'BTREE',
                unique: false,
                description: 'Optimize service-specific availability queries',
                estimated_benefit: 'MEDIUM',
                query_patterns: [
                    'SELECT * FROM provider_availability_cache WHERE service_instance_id = ? AND date BETWEEN ? AND ?',
                    'Service discovery API queries'
                ]
            },
            {
                name: 'idx_availability_exceptions_date',
                table: 'availability_exceptions',
                columns: ['provider_id', 'exception_date'],
                type: 'BTREE',
                unique: false,
                description: 'Optimize exception queries for availability filtering',
                estimated_benefit: 'MEDIUM',
                query_patterns: [
                    'SELECT * FROM availability_exceptions WHERE provider_id IN (...) AND exception_date = ?',
                    'Exception filtering in availability generation'
                ]
            },
            {
                name: 'idx_appointments_provider_date',
                table: 'appointments',
                columns: ['provider_id', 'start_time'],
                type: 'BTREE',
                unique: false,
                description: 'Optimize appointment queries for conflict checking',
                estimated_benefit: 'HIGH',
                query_patterns: [
                    'SELECT * FROM appointments WHERE provider_id = ? AND start_time::date = ?',
                    'Double-booking prevention queries'
                ]
            },
            {
                name: 'idx_appointments_emr_id',
                table: 'appointments',
                columns: ['emr_appointment_id'],
                type: 'BTREE',
                unique: true,
                description: 'Optimize EMR appointment lookups',
                estimated_benefit: 'MEDIUM',
                query_patterns: [
                    'SELECT * FROM appointments WHERE emr_appointment_id = ?',
                    'EMR integration queries'
                ]
            },
            {
                name: 'idx_payers_status_state',
                table: 'payers',
                columns: ['status_code', 'state'],
                type: 'BTREE',
                unique: false,
                condition: 'WHERE status_code NOT IN (\'not_started\', \'denied\', \'on_pause\', \'blocked\', \'withdrawn\')',
                description: 'Optimize payer filtering for ways-to-pay directory',
                estimated_benefit: 'MEDIUM',
                query_patterns: [
                    'SELECT * FROM payers WHERE state = ? AND status_code NOT IN (...)',
                    'Ways to pay directory queries'
                ]
            },
            {
                name: 'idx_organizations_type_status',
                table: 'organizations',
                columns: ['type', 'status'],
                type: 'BTREE',
                unique: false,
                description: 'Optimize admin organization filtering',
                estimated_benefit: 'LOW',
                query_patterns: [
                    'SELECT * FROM organizations WHERE type = ? AND status = ?',
                    'Admin dashboard organization queries'
                ]
            }
        ]

        const results: IndexResult[] = []

        console.log(`📋 Index plan: ${performanceIndexes.length} indexes`)

        if (analyze_only) {
            // Return analysis without creating indexes
            return NextResponse.json({
                success: true,
                operation: 'INDEX_ANALYSIS',
                total_indexes: performanceIndexes.length,
                high_benefit: performanceIndexes.filter(i => i.estimated_benefit === 'HIGH').length,
                medium_benefit: performanceIndexes.filter(i => i.estimated_benefit === 'MEDIUM').length,
                low_benefit: performanceIndexes.filter(i => i.estimated_benefit === 'LOW').length,
                indexes: performanceIndexes.map(idx => ({
                    name: idx.name,
                    table: idx.table,
                    columns: idx.columns,
                    benefit: idx.estimated_benefit,
                    description: idx.description,
                    query_patterns: idx.query_patterns
                })),
                recommendations: [
                    'Start with HIGH benefit indexes first',
                    'Monitor query performance before and after index creation',
                    'Consider table sizes - indexes on small tables may not help',
                    'Watch for index maintenance overhead on write-heavy tables'
                ]
            })
        }

        for (const index of performanceIndexes) {
            console.log(`🔧 Processing index: ${index.name} on ${index.table}`)

            if (!execute) {
                // Dry run mode
                results.push({
                    index: index.name,
                    status: 'SKIPPED',
                    message: `DRY RUN: Would create ${index.type} index on ${index.table}(${index.columns.join(', ')})`
                })
                continue
            }

            try {
                // Build CREATE INDEX statement
                let sql = `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table}`
                
                if (index.type === 'GIN') {
                    sql += ` USING GIN (${index.columns.join(', ')})`
                } else {
                    sql += ` (${index.columns.join(', ')})`
                }
                
                if (index.condition) {
                    sql += ` ${index.condition}`
                }
                
                sql += ';'

                console.log(`📝 Executing: ${sql}`)

                // Execute index creation
                const { error } = await supabaseAdmin.rpc('exec_sql', { sql_statement: sql })

                if (error) {
                    // Try to check if index already exists
                    const checkSql = `
                        SELECT 1 FROM pg_indexes 
                        WHERE indexname = '${index.name}' 
                        AND tablename = '${index.table}'
                    `
                    
                    const { data: existing } = await supabaseAdmin.rpc('exec_sql', { sql_statement: checkSql })
                    
                    if (existing && existing.length > 0) {
                        results.push({
                            index: index.name,
                            status: 'EXISTS',
                            message: `Index already exists on ${index.table}`
                        })
                        continue
                    }

                    // Log as error if we can't create and it doesn't exist
                    results.push({
                        index: index.name,
                        status: 'ERROR',
                        message: `Failed to create index on ${index.table}`,
                        error: error.message
                    })
                    continue
                }

                results.push({
                    index: index.name,
                    status: 'CREATED',
                    message: `Successfully created ${index.type} index on ${index.table}(${index.columns.join(', ')})`
                })

                console.log(`✅ Created index: ${index.name}`)

            } catch (error: any) {
                results.push({
                    index: index.name,
                    status: 'ERROR',
                    message: `Exception creating index on ${index.table}`,
                    error: error.message
                })

                console.error(`❌ Error creating ${index.name}:`, error.message)
            }
        }

        // Generate summary
        const summary = {
            total_indexes: performanceIndexes.length,
            created: results.filter(r => r.status === 'CREATED').length,
            existing: results.filter(r => r.status === 'EXISTS').length,
            skipped: results.filter(r => r.status === 'SKIPPED').length,
            errors: results.filter(r => r.status === 'ERROR').length,
            high_benefit_created: results.filter(r => 
                performanceIndexes.find(i => i.name === r.index)?.estimated_benefit === 'HIGH' && 
                r.status === 'CREATED'
            ).length
        }

        const overall_status = summary.errors === 0 ? 'SUCCESS' : 'PARTIAL_SUCCESS'

        return NextResponse.json({
            success: true,
            operation: execute ? 'INDEXES_CREATED' : 'INDEX_PLAN',
            overall_status,
            summary,
            results,
            performance_impact: {
                high_benefit_indexes: summary.created + summary.existing,
                query_patterns_optimized: performanceIndexes.reduce((acc, idx) => acc + idx.query_patterns.length, 0),
                tables_optimized: [...new Set(performanceIndexes.map(i => i.table))].length
            },
            next_steps: execute ? [
                'Monitor query performance improvements',
                'Use EXPLAIN ANALYZE to verify index usage',
                'Consider additional indexes based on slow query logs',
                'Review index usage statistics periodically'
            ] : [
                'Review the index plan above',
                'Execute with { "execute": true } when ready',
                'Monitor table sizes and write patterns first',
                'Start with HIGH benefit indexes for maximum impact'
            ]
        })

    } catch (error: any) {
        console.error('❌ Performance index error:', error)
        return NextResponse.json(
            { 
                success: false, 
                error: 'Performance index operation failed', 
                details: error.message 
            },
            { status: 500 }
        )
    }
}

export async function GET(request: NextRequest) {
    // Return index analysis
    const request_obj = new NextRequest(request.url, { method: 'POST', body: JSON.stringify({ analyze_only: true }) })
    return this.POST(request_obj)
}