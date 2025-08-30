import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore })
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated', success: false },
        { status: 401 }
      )
    }

    // Get profile data from request
    const profileData = await request.json()
    
    console.log('Creating provider profile for user:', user.id)
    console.log('Profile data:', profileData)

    // Validate required fields
    const requiredFields = ['first_name', 'last_name', 'title', 'role', 'email']
    for (const field of requiredFields) {
      if (!profileData[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}`, success: false },
          { status: 400 }
        )
      }
    }

    // Check if provider profile already exists for this user
    const { data: existingProvider } = await supabase
      .from('providers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single()

    if (existingProvider) {
      return NextResponse.json(
        { error: 'Provider profile already exists for this user', success: false },
        { status: 409 }
      )
    }

    // Create provider profile
    const providerRecord = {
      auth_user_id: user.id,
      email: profileData.email,
      first_name: profileData.first_name,
      last_name: profileData.last_name,
      title: profileData.title,
      role: profileData.role,
      specialty: profileData.specialty || null,
      phone: profileData.phone || null,
      npi_number: profileData.npi_number || null,
      is_active: true,
      accepts_new_patients: true,
      telehealth_enabled: true,
      in_person_enabled: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    const { data: provider, error: createError } = await supabase
      .from('providers')
      .insert([providerRecord])
      .select()
      .single()

    if (createError) {
      console.error('Error creating provider:', createError)
      return NextResponse.json(
        { 
          error: `Failed to create provider profile: ${createError.message}`,
          details: createError,
          success: false 
        },
        { status: 500 }
      )
    }

    console.log('Provider profile created successfully:', provider.id)

    // Create default availability schedule (Monday-Friday 9-5 with lunch break)
    const defaultAvailability = []
    for (let day = 1; day <= 5; day++) { // Monday-Friday
      defaultAvailability.push(
        {
          provider_id: provider.id,
          day_of_week: day,
          start_time: '09:00:00',
          end_time: '12:00:00',
          is_recurring: true,
          effective_date: new Date().toISOString().split('T')[0]
        },
        {
          provider_id: provider.id,
          day_of_week: day,
          start_time: '13:00:00',
          end_time: '17:00:00',
          is_recurring: true,
          effective_date: new Date().toISOString().split('T')[0]
        }
      )
    }

    // Insert default availability (optional - don't fail if this errors)
    const { error: availabilityError } = await supabase
      .from('provider_availability')
      .insert(defaultAvailability)

    if (availabilityError) {
      console.warn('Failed to create default availability:', availabilityError)
      // Don't fail the entire request for this
    } else {
      console.log('Default availability schedule created')
    }

    return NextResponse.json({
      success: true,
      provider: {
        id: provider.id,
        first_name: provider.first_name,
        last_name: provider.last_name,
        email: provider.email,
        title: provider.title,
        role: provider.role
      },
      message: 'Provider profile created successfully'
    })

  } catch (error: any) {
    console.error('Provider profile creation error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message,
        success: false 
      },
      { status: 500 }
    )
  }
}