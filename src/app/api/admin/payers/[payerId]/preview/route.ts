import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ payerId: string }> }
) {
  try {
    const { payerId } = await params
    console.log('🔍 Preview request for payer:', payerId)
    console.log('🔍 Request URL:', request.url)
    console.log('🔍 Request headers:', Object.fromEntries(request.headers.entries()))

    const { searchParams } = new URL(request.url)

    // Get proposed changes from query params
    const proposed = {
      status_code: searchParams.get('status_code'),
      effective_date: searchParams.get('effective_date'),
      requires_attending: searchParams.get('requires_attending') === 'true',
      allows_supervised: searchParams.get('allows_supervised') === 'true',
      supervision_level: searchParams.get('supervision_level')
    }

    // Get current payer data
    console.log('🔍 Querying payers table for ID:', payerId)
    const { data: currentPayer, error: payerError } = await supabase
      .from('payers')
      .select('*')
      .eq('id', payerId)
      .single()

    console.log('🔍 Supabase query result:', { currentPayer, payerError })

    if (payerError || !currentPayer) {
      console.log('❌ Payer not found or error:', payerError)
      return NextResponse.json(
        { error: payerError?.message || 'Payer not found' },
        { status: payerError?.code === 'PGRST116' ? 404 : 500 }
      )
    }

    // Generate warnings
    const warnings: string[] = []

    // Check for future effective date
    if (proposed.effective_date) {
      const proposedDate = new Date(proposed.effective_date)
      const today = new Date()
      if (proposedDate > today) {
        warnings.push(`Future effective date: payer won't be bookable until ${proposedDate.toLocaleDateString()}`)
      }
    }

    // Check if payer requires individual contracts
    if (proposed.effective_date !== currentPayer.effective_date) {
      // This would need to check payer policy - for now add a generic warning
      warnings.push('Changing payer effective date may require updating individual provider contracts in Provider-Payer Networks')
    }

    // Check for supervision level compatibility
    if (proposed.supervision_level && !proposed.allows_supervised) {
      warnings.push('Supervision level is set but allows_supervised is false - this may create conflicts')
    }

    const response = {
      success: true,
      current: currentPayer,
      proposed: {
        ...currentPayer,
        ...Object.fromEntries(
          Object.entries(proposed).filter(([_, value]) => value !== null && value !== undefined)
        )
      },
      warnings
    }

    console.log('✅ Returning successful preview response:', response)
    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Payer preview error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}