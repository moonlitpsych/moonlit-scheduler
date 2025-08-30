// Debug endpoint to check user and provider linkage
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get current user from session
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: userData, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const user = userData.user

    // Look for provider by auth_user_id
    const { data: providerByAuth, error: providerByAuthError } = await supabase
      .from('providers')
      .select('*')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)

    // Look for provider by email
    const { data: providerByEmail, error: providerByEmailError } = await supabase
      .from('providers')
      .select('*')
      .eq('email', user.email)
      .eq('is_active', true)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
      },
      providerByAuth: {
        data: providerByAuth,
        error: providerByAuthError?.message
      },
      providerByEmail: {
        data: providerByEmail,
        error: providerByEmailError?.message
      }
    })

  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// Simple GET without auth for testing
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // Look for provider by email  
    const { data: providers, error } = await supabase
      .from('providers')
      .select('*')
      .eq('email', email)

    return NextResponse.json({
      email,
      providers,
      error: error?.message
    })

  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}