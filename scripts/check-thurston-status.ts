#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

async function check() {
  const { data } = await supabase
    .from('patients')
    .select('id, first_name, last_name, email, status, engagement_status')
    .ilike('last_name', 'thurston')
    
  console.log('Thurston patients in database:')
  data?.forEach(p => {
    console.log(`  ${p.first_name} ${p.last_name}`)
    console.log(`    Email: ${p.email}`)
    console.log(`    Status: ${p.status}`)
    console.log(`    Engagement: ${p.engagement_status}`)
    console.log(`    ID: ${p.id}`)
    console.log('')
  })
}

check()
