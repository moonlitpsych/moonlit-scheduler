// Comprehensive database schema validation endpoint
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface ValidationResult {
  check: string
  status: 'pass' | 'fail' | 'warning'
  message: string
  details?: any
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting comprehensive schema validation...')

    const results: ValidationResult[] = []

    // 1. Check if contacts table exists with proper structure
    try {
      const { data: contactsTable, error: contactsError } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name, table_schema')
        .eq('table_name', 'contacts')
        .eq('table_schema', 'public')
        .maybeSingle()

      if (contactsError || !contactsTable) {
        results.push({
          check: 'contacts_table_exists',
          status: 'fail',
          message: 'contacts table does not exist',
          details: contactsError
        })
      } else {
        results.push({
          check: 'contacts_table_exists',
          status: 'pass',
          message: 'contacts table exists in public schema'
        })
      }
    } catch (err: any) {
      results.push({
        check: 'contacts_table_exists',
        status: 'fail',
        message: 'Error checking contacts table existence',
        details: err.message
      })
    }

    // 2. Check contacts table columns
    try {
      const { data: columns, error: columnsError } = await supabaseAdmin
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', 'contacts')
        .eq('table_schema', 'public')

      if (columnsError) {
        results.push({
          check: 'contacts_columns',
          status: 'fail',
          message: 'Error checking contacts table columns',
          details: columnsError
        })
      } else {
        const requiredColumns = [
          { name: 'id', type: 'uuid' },
          { name: 'organization_id', type: 'uuid', nullable: true },
          { name: 'first_name', type: 'character varying', nullable: true },
          { name: 'last_name', type: 'character varying', nullable: true },
          { name: 'email', type: 'character varying', nullable: true },
          { name: 'phone', type: 'character varying', nullable: true },
          { name: 'is_placeholder', type: 'boolean' },
          { name: 'created_at', type: 'timestamp with time zone' },
          { name: 'updated_at', type: 'timestamp with time zone' }
        ]

        const missingColumns = requiredColumns.filter(required =>
          !columns?.some(col => col.column_name === required.name)
        )

        if (missingColumns.length > 0) {
          results.push({
            check: 'contacts_columns',
            status: 'fail',
            message: `Missing required columns: ${missingColumns.map(c => c.name).join(', ')}`,
            details: { missingColumns, foundColumns: columns }
          })
        } else {
          results.push({
            check: 'contacts_columns',
            status: 'pass',
            message: 'All required columns exist in contacts table',
            details: columns
          })
        }
      }
    } catch (err: any) {
      results.push({
        check: 'contacts_columns',
        status: 'fail',
        message: 'Error validating contacts table columns',
        details: err.message
      })
    }

    // 3. Check for chk_contacts_identity_or_placeholder constraint
    try {
      const { data: constraints, error: constraintsError } = await supabaseAdmin
        .from('information_schema.check_constraints')
        .select('constraint_name, check_clause')
        .eq('constraint_schema', 'public')
        .like('constraint_name', '%contacts%')

      if (constraintsError) {
        results.push({
          check: 'contacts_constraints',
          status: 'fail',
          message: 'Error checking contacts constraints',
          details: constraintsError
        })
      } else {
        const identityConstraint = constraints?.find(c =>
          c.constraint_name.includes('chk_contacts_identity_or_placeholder') ||
          c.check_clause?.includes('is_placeholder')
        )

        if (identityConstraint) {
          results.push({
            check: 'contacts_constraints',
            status: 'pass',
            message: 'Identity/placeholder constraint found',
            details: identityConstraint
          })
        } else {
          results.push({
            check: 'contacts_constraints',
            status: 'warning',
            message: 'chk_contacts_identity_or_placeholder constraint not found',
            details: constraints
          })
        }
      }
    } catch (err: any) {
      results.push({
        check: 'contacts_constraints',
        status: 'fail',
        message: 'Error checking contacts constraints',
        details: err.message
      })
    }

    // 4. Check foreign key to organizations
    try {
      const { data: foreignKeys, error: fkError } = await supabaseAdmin
        .from('information_schema.key_column_usage')
        .select('*')
        .eq('table_name', 'contacts')
        .eq('table_schema', 'public')
        .eq('column_name', 'organization_id')

      if (fkError) {
        results.push({
          check: 'contacts_foreign_keys',
          status: 'fail',
          message: 'Error checking foreign keys',
          details: fkError
        })
      } else if (foreignKeys && foreignKeys.length > 0) {
        results.push({
          check: 'contacts_foreign_keys',
          status: 'pass',
          message: 'Foreign key to organizations exists',
          details: foreignKeys
        })
      } else {
        results.push({
          check: 'contacts_foreign_keys',
          status: 'warning',
          message: 'No foreign key found for organization_id',
          details: foreignKeys
        })
      }
    } catch (err: any) {
      results.push({
        check: 'contacts_foreign_keys',
        status: 'fail',
        message: 'Error checking foreign keys',
        details: err.message
      })
    }

    // 5. Check for old partner_contacts table
    try {
      const { data: oldTable, error: oldTableError } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name, table_type')
        .eq('table_name', 'partner_contacts')
        .eq('table_schema', 'public')
        .maybeSingle()

      if (oldTableError) {
        results.push({
          check: 'legacy_partner_contacts',
          status: 'warning',
          message: 'Error checking for legacy partner_contacts table',
          details: oldTableError
        })
      } else if (oldTable) {
        // Count rows if table exists
        try {
          const { count } = await supabaseAdmin
            .from('partner_contacts')
            .select('*', { count: 'exact', head: true })

          results.push({
            check: 'legacy_partner_contacts',
            status: 'warning',
            message: `Legacy partner_contacts table still exists with ${count || 0} rows`,
            details: { table: oldTable, rowCount: count }
          })
        } catch {
          results.push({
            check: 'legacy_partner_contacts',
            status: 'warning',
            message: 'Legacy partner_contacts table exists but cannot query',
            details: oldTable
          })
        }
      } else {
        results.push({
          check: 'legacy_partner_contacts',
          status: 'pass',
          message: 'Legacy partner_contacts table does not exist'
        })
      }
    } catch (err: any) {
      results.push({
        check: 'legacy_partner_contacts',
        status: 'warning',
        message: 'Error checking legacy table',
        details: err.message
      })
    }

    // 6. Check crm_notes table and relationships
    try {
      const { data: crmNotesTable, error: crmError } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'crm_notes')
        .eq('table_schema', 'public')
        .maybeSingle()

      if (crmError || !crmNotesTable) {
        results.push({
          check: 'crm_notes_table',
          status: 'warning',
          message: 'crm_notes table does not exist',
          details: crmError
        })
      } else {
        results.push({
          check: 'crm_notes_table',
          status: 'pass',
          message: 'crm_notes table exists'
        })

        // Check crm_notes columns
        const { data: crmColumns, error: crmColumnsError } = await supabaseAdmin
          .from('information_schema.columns')
          .select('column_name, data_type')
          .eq('table_name', 'crm_notes')
          .eq('table_schema', 'public')

        if (!crmColumnsError && crmColumns) {
          const requiredCrmColumns = ['id', 'contact_id', 'organization_id', 'content', 'created_at', 'updated_at', 'created_by']
          const missingCrmColumns = requiredCrmColumns.filter(required =>
            !crmColumns.some(col => col.column_name === required)
          )

          if (missingCrmColumns.length > 0) {
            results.push({
              check: 'crm_notes_columns',
              status: 'warning',
              message: `Missing crm_notes columns: ${missingCrmColumns.join(', ')}`,
              details: { missing: missingCrmColumns, found: crmColumns }
            })
          } else {
            results.push({
              check: 'crm_notes_columns',
              status: 'pass',
              message: 'All required crm_notes columns exist'
            })
          }
        }
      }
    } catch (err: any) {
      results.push({
        check: 'crm_notes_table',
        status: 'warning',
        message: 'Error checking crm_notes table',
        details: err.message
      })
    }

    // 7. Check for orphaned crm_notes
    try {
      const { data: orphanedNotes, error: orphanError } = await supabaseAdmin
        .rpc('count_orphaned_notes', {})
        .maybeSingle()

      if (orphanError) {
        // Try alternative method if RPC doesn't exist
        try {
          const { data: rawOrphaned, error: rawError } = await supabaseAdmin
            .from('crm_notes')
            .select('id, contact_id')
            .not('contact_id', 'is', null)
            .limit(100)

          if (!rawError && rawOrphaned) {
            const contactIds = [...new Set(rawOrphaned.map(n => n.contact_id).filter(Boolean))]

            if (contactIds.length > 0) {
              const { data: existingContacts, error: contactsError } = await supabaseAdmin
                .from('contacts')
                .select('id')
                .in('id', contactIds)

              const existingIds = new Set(existingContacts?.map(c => c.id) || [])
              const orphanedCount = rawOrphaned.filter(n => n.contact_id && !existingIds.has(n.contact_id)).length

              if (orphanedCount > 0) {
                results.push({
                  check: 'orphaned_notes',
                  status: 'warning',
                  message: `Found ${orphanedCount} orphaned CRM notes`,
                  details: { orphanedCount, totalChecked: rawOrphaned.length }
                })
              } else {
                results.push({
                  check: 'orphaned_notes',
                  status: 'pass',
                  message: 'No orphaned CRM notes found'
                })
              }
            } else {
              results.push({
                check: 'orphaned_notes',
                status: 'pass',
                message: 'No CRM notes with contact_id found'
              })
            }
          } else {
            results.push({
              check: 'orphaned_notes',
              status: 'warning',
              message: 'Cannot check for orphaned notes - table may not exist',
              details: rawError
            })
          }
        } catch (altError: any) {
          results.push({
            check: 'orphaned_notes',
            status: 'warning',
            message: 'Error checking for orphaned notes',
            details: altError.message
          })
        }
      } else {
        results.push({
          check: 'orphaned_notes',
          status: 'pass',
          message: `Checked orphaned notes via RPC`,
          details: orphanedNotes
        })
      }
    } catch (err: any) {
      results.push({
        check: 'orphaned_notes',
        status: 'warning',
        message: 'Error checking orphaned notes',
        details: err.message
      })
    }

    // 8. Check organizations table exists
    try {
      const { data: orgsTable, error: orgsError } = await supabaseAdmin
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_name', 'organizations')
        .eq('table_schema', 'public')
        .maybeSingle()

      if (orgsError || !orgsTable) {
        results.push({
          check: 'organizations_table',
          status: 'fail',
          message: 'organizations table does not exist',
          details: orgsError
        })
      } else {
        results.push({
          check: 'organizations_table',
          status: 'pass',
          message: 'organizations table exists'
        })
      }
    } catch (err: any) {
      results.push({
        check: 'organizations_table',
        status: 'fail',
        message: 'Error checking organizations table',
        details: err.message
      })
    }

    // 9. Test actual data access
    try {
      const { data: sampleContacts, error: sampleError } = await supabaseAdmin
        .from('contacts')
        .select('id, first_name, last_name, is_placeholder, organization_id')
        .limit(5)

      if (sampleError) {
        results.push({
          check: 'contacts_data_access',
          status: 'fail',
          message: 'Cannot query contacts table',
          details: sampleError
        })
      } else {
        const { count: totalContacts } = await supabaseAdmin
          .from('contacts')
          .select('*', { count: 'exact', head: true })

        results.push({
          check: 'contacts_data_access',
          status: 'pass',
          message: `Successfully queried contacts table with ${totalContacts || 0} records`,
          details: {
            totalContacts,
            sampleData: sampleContacts?.slice(0, 3).map(c => ({
              id: c.id,
              name: `${c.first_name || ''} ${c.last_name || ''}`.trim(),
              is_placeholder: c.is_placeholder,
              has_organization: !!c.organization_id
            }))
          }
        })
      }
    } catch (err: any) {
      results.push({
        check: 'contacts_data_access',
        status: 'fail',
        message: 'Error accessing contacts data',
        details: err.message
      })
    }

    // Calculate overall status
    const passCount = results.filter(r => r.status === 'pass').length
    const failCount = results.filter(r => r.status === 'fail').length
    const warningCount = results.filter(r => r.status === 'warning').length

    let overallStatus: 'healthy' | 'issues_found' | 'critical_issues' = 'healthy'
    if (failCount > 0) {
      overallStatus = 'critical_issues'
    } else if (warningCount > 0) {
      overallStatus = 'issues_found'
    }

    console.log(`✅ Schema validation complete: ${passCount} passed, ${failCount} failed, ${warningCount} warnings`)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      summary: {
        total_checks: results.length,
        passed: passCount,
        failed: failCount,
        warnings: warningCount
      },
      results
    })

  } catch (error: any) {
    console.error('❌ Schema validation error:', error)

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      overall_status: 'critical_issues',
      error: 'Schema validation failed',
      details: error.message
    }, { status: 500 })
  }
}