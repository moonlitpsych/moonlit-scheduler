import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🔄 Setting up supervision relationships...')

    // First, let's try to create a supervision_relationships table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS supervision_relationships (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        rendering_provider_id UUID NOT NULL REFERENCES providers(id),
        billing_provider_id UUID NOT NULL REFERENCES providers(id),
        payer_id UUID NOT NULL REFERENCES payers(id),
        effective_date DATE DEFAULT CURRENT_DATE,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(rendering_provider_id, billing_provider_id, payer_id)
      );
    `

    const { error: createError } = await supabaseAdmin.rpc('exec_sql', { 
      query: createTableQuery 
    })

    if (createError) {
      console.log('⚠️ Table creation failed or already exists:', createError.message)
    } else {
      console.log('✅ Supervision relationships table created')
    }

    // Get provider IDs we need
    const { data: providers } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name')
      .in('last_name', ['Kaehler', 'Reynolds', 'Privratsky'])

    const tatiana = providers?.find(p => p.last_name === 'Kaehler')
    const reynolds = providers?.find(p => p.last_name === 'Reynolds') 
    const privratsky = providers?.find(p => p.last_name === 'Privratsky')

    if (!tatiana || !reynolds || !privratsky) {
      return NextResponse.json({
        success: false,
        error: 'Could not find required providers',
        found: { tatiana: !!tatiana, reynolds: !!reynolds, privratsky: !!privratsky }
      }, { status: 400 })
    }

    // Get Optum Medicaid payer ID
    const { data: optumPayer } = await supabaseAdmin
      .from('payers')
      .select('id, name')
      .ilike('name', '%optum%medicaid%')
      .limit(1)
      .single()

    if (!optumPayer) {
      return NextResponse.json({
        success: false,
        error: 'Could not find Optum Medicaid payer'
      }, { status: 400 })
    }

    // Insert supervision relationships
    const supervisionRelationships = [
      {
        rendering_provider_id: tatiana.id,
        billing_provider_id: privratsky.id,
        payer_id: optumPayer.id
      },
      {
        rendering_provider_id: reynolds.id,
        billing_provider_id: privratsky.id,
        payer_id: optumPayer.id
      }
    ]

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('supervision_relationships')
      .insert(supervisionRelationships)
      .select()

    if (insertError) {
      console.error('❌ Failed to insert supervision relationships:', insertError)
      return NextResponse.json({
        success: false,
        error: 'Failed to create supervision relationships',
        details: insertError.message
      }, { status: 500 })
    }

    console.log('✅ Created supervision relationships:', inserted)

    return NextResponse.json({
      success: true,
      message: 'Supervision relationships created successfully',
      relationships: inserted,
      providers: { tatiana, reynolds, privratsky },
      payer: optumPayer
    })

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Setup failed',
      details: error.message
    }, { status: 500 })
  }
}