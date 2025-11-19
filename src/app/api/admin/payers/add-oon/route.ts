import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

// Initialize Supabase client with service role key for admin operations
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

interface AddOONPayerRequest {
  name: string
  state: string
  payer_type: string
}

export async function POST(request: Request) {
  try {
    const body: AddOONPayerRequest = await request.json()

    // Validate required fields
    if (!body.name || !body.state || !body.payer_type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, state, and payer_type are required' },
        { status: 400 }
      )
    }

    // Trim and validate name
    const payerName = body.name.trim()
    if (payerName.length === 0) {
      return NextResponse.json(
        { error: 'Payer name cannot be empty' },
        { status: 400 }
      )
    }

    // Validate state
    const validStates = ['UT', 'ID', 'Other']
    if (!validStates.includes(body.state)) {
      return NextResponse.json(
        { error: `Invalid state. Must be one of: ${validStates.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate payer type
    const validTypes = ['medicaid', 'commercial', 'medicare', 'other']
    if (!validTypes.includes(body.payer_type)) {
      return NextResponse.json(
        { error: `Invalid payer type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if payer already exists
    const { data: existingPayer, error: checkError } = await supabase
      .from('payers')
      .select('id, name')
      .ilike('name', payerName)
      .maybeSingle()

    if (checkError) {
      console.error('Error checking for existing payer:', checkError)
      return NextResponse.json(
        { error: 'Failed to check for existing payer' },
        { status: 500 }
      )
    }

    if (existingPayer) {
      return NextResponse.json(
        { error: `A payer named "${existingPayer.name}" already exists` },
        { status: 409 }
      )
    }

    // Prepare payer data with out-of-network defaults
    const payerData = {
      name: payerName,
      payer_type: body.payer_type,
      state: body.state,
      status_code: null, // NULL status_code maps to 'not-accepted' in booking flow
      requires_attending: false,
      requires_individual_contract: false,
      effective_date: null,
      projected_effective_date: null,
      notes: `Out-of-network payer added via admin dashboard on ${new Date().toISOString().split('T')[0]}`
    }

    // Insert the payer
    const { data: newPayer, error: insertError } = await supabase
      .from('payers')
      .insert(payerData)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting payer:', insertError)

      // Handle specific error cases
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'A payer with this name already exists' },
          { status: 409 }
        )
      }

      if (insertError.code === '23503') {
        // Foreign key constraint violation - try again without status_code
        console.warn('Foreign key constraint on status_code, retrying without it')

        const { data: retryPayer, error: retryError } = await supabase
          .from('payers')
          .insert({
            ...payerData,
            status_code: undefined // Remove status_code entirely
          })
          .select()
          .single()

        if (retryError) {
          console.error('Retry insert failed:', retryError)
          return NextResponse.json(
            { error: 'Failed to create payer' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          payer: retryPayer,
          message: `Successfully added ${payerName} as out-of-network payer`
        })
      }

      return NextResponse.json(
        { error: 'Failed to create payer' },
        { status: 500 }
      )
    }

    console.log(`✅ Added out-of-network payer: ${payerName} (${body.payer_type}, ${body.state})`)

    return NextResponse.json({
      success: true,
      payer: newPayer,
      message: `Successfully added ${payerName} as out-of-network payer`
    })

  } catch (error: any) {
    console.error('Unexpected error in add-oon API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
