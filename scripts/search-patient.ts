#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function searchPatient(searchTerm: string) {
  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, first_name, last_name, email, status')
    .ilike('last_name', `%${searchTerm}%`)
    .order('last_name', { ascending: true })

  if (error) {
    console.error('Error searching patients:', error)
    process.exit(1)
  }

  if (!patients || patients.length === 0) {
    console.log(`❌ No patients found with last name matching "${searchTerm}"`)
    process.exit(0)
  }

  console.log(`✅ Found ${patients.length} patient(s) matching "${searchTerm}":\n`)

  patients.forEach((p, idx) => {
    console.log(`${idx + 1}. ${p.first_name} ${p.last_name}`)
    console.log(`   ID: ${p.id}`)
    console.log(`   Email: ${p.email || 'N/A'}`)
    console.log(`   Status: ${p.status}`)
    console.log('')
  })
}

const searchTerm = process.argv[2] || 'thurston'
searchPatient(searchTerm)
