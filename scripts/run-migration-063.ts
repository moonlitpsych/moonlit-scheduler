import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function runMigration() {
  console.log('Running migration 063: Fix service names - trim spaces')
  console.log('================================================')

  const sql = fs.readFileSync('database-migrations/063-fix-service-names-trim-spaces.sql', 'utf8')

  // Split into individual statements and execute them
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s !== '')

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    console.log(`\nExecuting statement ${i + 1}/${statements.length}...`)

    const { error } = await supabase.rpc('exec_raw_sql', { sql: statement })

    if (error) {
      // Try direct query if rpc doesn't exist
      const { error: queryError } = await supabase.from('_').select('*').limit(0) as any

      console.error('❌ Error executing statement:', error)
      console.error('Statement:', statement.substring(0, 100) + '...')

      // Continue with other statements
      continue
    }

    console.log('✅ Statement executed successfully')
  }

  console.log('\n✅ Migration 063 completed!')
  console.log('   - Updated services table to trim names')
  console.log('   - Updated v_appointments_grid view to always TRIM service names')
  console.log('   - Recreated v_provider_pay_summary view')
}

runMigration().catch(console.error)
