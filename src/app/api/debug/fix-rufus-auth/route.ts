// Fix Dr. Sweeney's auth_user_id linkage
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

export async function GET() {
  try {
    // Get the current auth user with email rufussweeney@gmail.com
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const rufusUser = users.users.find(user => user.email === 'rufussweeney@gmail.com')
    
    if (!rufusUser) {
      return NextResponse.json({ error: 'No auth user found for rufussweeney@gmail.com' }, { status: 404 })
    }

    // Show current state
    const { data: currentProvider } = await supabase
      .from('providers')
      .select('id, first_name, last_name, email, auth_user_id')
      .eq('email', 'rufussweeney@gmail.com')
      .single()

    return NextResponse.json({
      message: 'Found auth user and provider record',
      authUser: {
        id: rufusUser.id,
        email: rufusUser.email,
        lastSignIn: rufusUser.last_sign_in_at
      },
      currentProvider,
      needsUpdate: currentProvider?.auth_user_id !== rufusUser.id,
      suggestedAction: `Update provider auth_user_id from '${currentProvider?.auth_user_id}' to '${rufusUser.id}'`
    })

  } catch (error) {
    console.error('Error checking auth:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Get the current auth user with email rufussweeney@gmail.com
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    
    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 })
    }

    const rufusUser = users.users.find(user => user.email === 'rufussweeney@gmail.com')
    
    if (!rufusUser) {
      return NextResponse.json({ error: 'No auth user found for rufussweeney@gmail.com' }, { status: 404 })
    }

    // Update the provider record
    const { data, error } = await supabase
      .from('providers')
      .update({ 
        auth_user_id: rufusUser.id,
        updated_at: new Date().toISOString()
      })
      .eq('email', 'rufussweeney@gmail.com')
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Successfully updated Dr. Sweeney\'s auth_user_id!',
      updatedProvider: data[0],
      newAuthUserId: rufusUser.id
    })

  } catch (error) {
    console.error('Error updating auth:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}