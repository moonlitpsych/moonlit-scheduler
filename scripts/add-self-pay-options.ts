// Script to add self-pay options to the payers table
import { supabase } from '../src/lib/supabase'

async function addSelfPayOptions() {
  console.log('🚀 Adding self-pay options to payers table...')

  const selfPayOptions = [
    {
      name: 'Cash pay',
      payer_type: 'self_pay',
      state: 'Utah',
      credentialing_status: 'active',
      effective_date: new Date().toISOString().split('T')[0], // Today
    },
    {
      name: 'Credit card pay',
      payer_type: 'self_pay', 
      state: 'Utah',
      credentialing_status: 'active',
      effective_date: new Date().toISOString().split('T')[0], // Today
    },
    {
      name: 'ACH pay',
      payer_type: 'self_pay',
      state: 'Utah',
      credentialing_status: 'active',
      effective_date: new Date().toISOString().split('T')[0], // Today
    },
    {
      name: 'Cash pay',
      payer_type: 'self_pay',
      state: 'Idaho',
      credentialing_status: 'active',
      effective_date: new Date().toISOString().split('T')[0], // Today
    },
    {
      name: 'Credit card pay',
      payer_type: 'self_pay',
      state: 'Idaho',
      credentialing_status: 'active',
      effective_date: new Date().toISOString().split('T')[0], // Today
    },
    {
      name: 'ACH pay',
      payer_type: 'self_pay',
      state: 'Idaho',
      credentialing_status: 'active',
      effective_date: new Date().toISOString().split('T')[0], // Today
    },
  ]

  try {
    // First check if any self-pay options already exist
    const { data: existing, error: checkError } = await supabase
      .from('payers')
      .select('id, name, state')
      .eq('payer_type', 'self_pay')

    if (checkError) {
      console.error('❌ Error checking existing self-pay options:', checkError)
      return
    }

    if (existing && existing.length > 0) {
      console.log('⚠️ Self-pay options already exist:', existing)
      console.log('Skipping insertion to avoid duplicates')
      return
    }

    // Insert self-pay options
    const { data, error } = await supabase
      .from('payers')
      .insert(selfPayOptions)
      .select()

    if (error) {
      console.error('❌ Error inserting self-pay options:', error)
      return
    }

    console.log('✅ Successfully added self-pay options:', data)
    console.log(`Added ${data?.length || 0} self-pay options`)

  } catch (error) {
    console.error('❌ Unexpected error:', error)
  }
}

// Run the script
addSelfPayOptions()