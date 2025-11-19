import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing Supabase credentials' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Query 1: Check payer_plans table for acceptance_status column
    const { data: payerPlansSchema, error: payerPlansError } = await supabase
      .from('payer_plans')
      .select('*')
      .limit(1)

    // Query 2: Check if provider_plan_overrides table exists
    const { data: providerOverrides, error: overridesError } = await supabase
      .from('provider_plan_overrides')
      .select('*')
      .limit(1)

    // Query 3: Try to call the get_payer_plans_for_ui function
    const { data: functionTest, error: functionError } = await supabase
      .rpc('get_payer_plans_for_ui', {
        in_payer_id: 'd37d3938-b48d-4bdf-b500-bf5413157ef4' // SelectHealth
      })

    return NextResponse.json({
      payer_plans: {
        sample_row: payerPlansSchema,
        error: payerPlansError?.message
      },
      provider_plan_overrides: {
        exists: !overridesError,
        sample_row: providerOverrides,
        error: overridesError?.message
      },
      function_test: {
        exists: !functionError,
        result: functionTest,
        error: functionError?.message
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
