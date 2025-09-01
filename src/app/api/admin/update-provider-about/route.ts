import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { provider_id, about_text } = await request.json()

    if (!provider_id || !about_text) {
      return NextResponse.json(
        { error: 'provider_id and about_text are required' },
        { status: 400 }
      )
    }

    // Update the provider with about text
    const { error } = await supabaseAdmin
      .from('providers')
      .update({ about: about_text })
      .eq('id', provider_id)

    if (error) {
      throw new Error(`Failed to update provider: ${error.message}`)
    }

    return NextResponse.json({ success: true, message: 'Provider about text updated' })

  } catch (error) {
    console.error('❌ Error updating provider about text:', error.message)
    return NextResponse.json(
      { error: 'Failed to update provider', details: error.message },
      { status: 500 }
    )
  }
}