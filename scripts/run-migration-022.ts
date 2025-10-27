import { supabaseAdmin } from '../src/lib/supabase'
import * as fs from 'fs'
import * as path from 'path'

async function runMigration() {
  try {
    console.log('📦 Running migration 022: Fix booking trigger to use RPC function...\n')

    const migrationPath = path.join(__dirname, '../database-migrations/022-fix-booking-trigger-use-rpc.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    console.log('SQL to execute:')
    console.log(sql)
    console.log('\n---\n')

    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_string: sql })

    if (error) {
      console.error('❌ Migration failed:', error)
      process.exit(1)
    }

    console.log('✅ Migration completed successfully!')
    console.log('Result:', data)

  } catch (error: any) {
    console.error('❌ Error running migration:', error.message)
    process.exit(1)
  }
}

runMigration()
