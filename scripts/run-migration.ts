#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars')
  process.exit(1)
}

const migrationFile = process.argv[2]

if (!migrationFile) {
  console.error('Usage: npx tsx scripts/run-migration.ts <migration-file>')
  console.error('Example: npx tsx scripts/run-migration.ts 032-rollback-mock-plan-data.sql')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  console.log(`📄 Reading migration: ${migrationFile}\n`)

  const filePath = join(process.cwd(), 'database-migrations', migrationFile)
  const sql = readFileSync(filePath, 'utf-8')

  console.log('🚀 Executing SQL...\n')

  // Split SQL into statements and execute them
  // Note: This is a simple approach that may not handle all edge cases
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql })

  if (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }

  console.log('✅ Migration completed successfully')
}

runMigration().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
