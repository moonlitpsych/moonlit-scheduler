// Simple endpoint to check Dr. Sweeney's provider record
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    // Check Dr. Sweeney by email
    const { data: providerByEmail, error: emailError } = await supabase
      .from('providers')
      .select('*')
      .eq('email', 'rufussweeney@gmail.com')

    // Check Dr. Sweeney by UUID
    const { data: providerByUUID, error: uuidError } = await supabase
      .from('providers')
      .select('*')
      .eq('id', '08fbcd34-cd5f-425c-85bd-1aeeffbe9694')

    // Get all active providers for reference
    const { data: allActiveProviders, error: allError } = await supabase
      .from('providers')
      .select('id, first_name, last_name, email, auth_user_id, is_active')
      .eq('is_active', true)
      .order('first_name')

    return NextResponse.json({
      providerByEmail: {
        data: providerByEmail,
        error: emailError?.message
      },
      providerByUUID: {
        data: providerByUUID,  
        error: uuidError?.message
      },
      allActiveProviders: {
        data: allActiveProviders,
        error: allError?.message
      }
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}