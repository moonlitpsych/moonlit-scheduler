#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function testFinanceSearch() {
  console.log('🔍 Testing finance view search for "Thurston"...\n')

  // Test 1: Direct query with case-insensitive LIKE
  const { data: likeResults, error: likeError } = await supabase
    .from('v_appointments_grid')
    .select('appointment_id, last_name, patient_email, appt_date, service')
    .ilike('last_name', '%thurston%')
    .order('appt_date', { ascending: false })

  console.log('📊 Test 1: ILIKE search on last_name')
  if (likeError) {
    console.error('❌ Error:', likeError.message)
  } else if (!likeResults || likeResults.length === 0) {
    console.log('❌ No results found with ILIKE %thurston%')
  } else {
    console.log(`✅ Found ${likeResults.length} result(s):`)
    likeResults.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.last_name} (${row.patient_email})`)
      console.log(`      Date: ${row.appt_date}, Service: ${row.service}`)
    })
  }

  // Test 2: Exact match with lowercase
  console.log('\n📊 Test 2: Exact match with "thurston"')
  const { data: exactLower, error: exactLowerError } = await supabase
    .from('v_appointments_grid')
    .select('appointment_id, last_name, patient_email')
    .eq('last_name', 'thurston')

  if (exactLowerError) {
    console.error('❌ Error:', exactLowerError.message)
  } else {
    console.log(`   Found ${exactLower?.length || 0} result(s)`)
  }

  // Test 3: Exact match with capitalized
  console.log('\n📊 Test 3: Exact match with "Thurston"')
  const { data: exactCap, error: exactCapError } = await supabase
    .from('v_appointments_grid')
    .select('appointment_id, last_name, patient_email')
    .eq('last_name', 'Thurston')

  if (exactCapError) {
    console.error('❌ Error:', exactCapError.message)
  } else {
    console.log(`   Found ${exactCap?.length || 0} result(s)`)
  }

  // Test 4: Get all appointments and search in results
  console.log('\n📊 Test 4: Fetching ALL appointments and filtering locally')
  const { data: allAppts, error: allError } = await supabase
    .from('v_appointments_grid')
    .select('appointment_id, last_name, patient_email')
    .limit(1000)

  if (allError) {
    console.error('❌ Error:', allError.message)
  } else if (allAppts) {
    const thurstonAppts = allAppts.filter(a =>
      a.last_name?.toLowerCase().includes('thurston')
    )
    console.log(`   Total appointments in view: ${allAppts.length}`)
    console.log(`   Thurston appointments found locally: ${thurstonAppts.length}`)
    if (thurstonAppts.length > 0) {
      thurstonAppts.forEach(apt => {
        console.log(`      - ${apt.last_name} (${apt.patient_email})`)
      })
    }
  }
}

testFinanceSearch()
