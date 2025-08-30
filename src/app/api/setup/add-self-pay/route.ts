import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🚀 Adding self-pay options to payers table...')

    const selfPayOptions = [
      {
        name: 'Cash pay',
        payer_type: 'self_pay',
        state: 'Utah',
        credentialing_status: 'approved',
        effective_date: new Date().toISOString().split('T')[0], // Today
      },
      {
        name: 'Credit card pay',
        payer_type: 'self_pay', 
        state: 'Utah',
        credentialing_status: 'approved',
        effective_date: new Date().toISOString().split('T')[0], // Today
      },
      {
        name: 'ACH pay',
        payer_type: 'self_pay',
        state: 'Utah',
        credentialing_status: 'approved',
        effective_date: new Date().toISOString().split('T')[0], // Today
      },
      {
        name: 'Cash pay',
        payer_type: 'self_pay',
        state: 'Idaho',
        credentialing_status: 'approved',
        effective_date: new Date().toISOString().split('T')[0], // Today
      },
      {
        name: 'Credit card pay',
        payer_type: 'self_pay',
        state: 'Idaho',
        credentialing_status: 'approved',
        effective_date: new Date().toISOString().split('T')[0], // Today
      },
      {
        name: 'ACH pay',
        payer_type: 'self_pay',
        state: 'Idaho',
        credentialing_status: 'approved',
        effective_date: new Date().toISOString().split('T')[0], // Today
      },
    ]

    // First check if any self-pay options already exist
    const { data: existing, error: checkError } = await supabaseAdmin
      .from('payers')
      .select('id, name, state')
      .eq('payer_type', 'self_pay')

    if (checkError) {
      console.error('❌ Error checking existing self-pay options:', checkError)
      return NextResponse.json({ error: 'Failed to check existing options' }, { status: 500 })
    }

    if (existing && existing.length > 0) {
      console.log('⚠️ Self-pay options already exist:', existing)
      return NextResponse.json({ 
        message: 'Self-pay options already exist', 
        existing: existing 
      }, { status: 200 })
    }

    // Insert self-pay options
    const { data, error } = await supabaseAdmin
      .from('payers')
      .insert(selfPayOptions)
      .select()

    if (error) {
      console.error('❌ Error inserting self-pay options:', error)
      return NextResponse.json({ error: 'Failed to insert options' }, { status: 500 })
    }

    console.log('✅ Successfully added self-pay options:', data)
    return NextResponse.json({ 
      message: `Successfully added ${data?.length || 0} self-pay options`,
      added: data 
    })

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}