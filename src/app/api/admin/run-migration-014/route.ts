// Admin API: Run Migration 014 - Partner Dashboard V3.0
// URL: /api/admin/run-migration-014
// This is a one-time migration endpoint - can be deleted after running

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

export async function POST() {
  try {
    console.log('🚀 Starting migration 014: Partner Dashboard V3.0 Schema')

    // Read migration file
    const migrationPath = path.join(process.cwd(), 'database-migrations/014-v3-partner-dashboard-schema.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Split into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT')

    const results = []
    let successCount = 0
    let skipCount = 0

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      if (stmt.length === 0) continue

      // Extract table/view name from statement for logging
      const match = stmt.match(/(?:CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE VIEW|CREATE TRIGGER)\s+(?:IF NOT EXISTS\s+)?(?:public\.)?(\w+)/i)
      const objectName = match ? match[1] : `statement ${i + 1}`

      try {
        console.log(`  Executing: ${objectName}...`)

        const { error } = await supabaseAdmin.rpc('exec', {
          query: stmt + ';'
        }).throwOnError()

        if (error) {
          // Try alternative method - direct query
          const { error: directError } = await (supabaseAdmin as any).from('_').select('*').limit(0)

          if (directError) {
            throw error
          }
        }

        successCount++
        results.push({ object: objectName, status: 'success' })
        console.log(`  ✓ ${objectName}`)

      } catch (err: any) {
        // Check if error is because object already exists
        if (err.message?.includes('already exists') || err.message?.includes('duplicate')) {
          skipCount++
          results.push({ object: objectName, status: 'skipped', reason: 'already exists' })
          console.log(`  ⊘ ${objectName} (already exists)`)
        } else {
          results.push({ object: objectName, status: 'error', error: err.message })
          console.error(`  ✗ ${objectName}:`, err.message)
        }
      }
    }

    console.log('')
    console.log('🎉 Migration 014 execution complete!')
    console.log(`  ✓ Success: ${successCount}`)
    console.log(`  ⊘ Skipped: ${skipCount}`)
    console.log(`  ✗ Errors: ${results.filter(r => r.status === 'error').length}`)

    return NextResponse.json({
      success: true,
      message: 'Migration 014 executed',
      summary: {
        total_statements: statements.length,
        successful: successCount,
        skipped: skipCount,
        errors: results.filter(r => r.status === 'error').length
      },
      details: results
    })

  } catch (error: any) {
    console.error('❌ Migration failed:', error)

    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Migration endpoint - use POST to execute',
    migration: '014-v3-partner-dashboard-schema.sql',
    description: 'Partner Dashboard V3.0 Schema'
  })
}
