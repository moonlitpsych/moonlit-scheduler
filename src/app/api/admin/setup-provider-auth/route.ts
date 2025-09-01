import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST() {
  try {
    console.log('🚀 Starting provider auth setup process...')

    // Get current providers that need auth users
    const { data: providers, error: providersError } = await supabaseAdmin
      .from('providers')
      .select('id, first_name, last_name, email, auth_user_id')
      .order('first_name')

    if (providersError) {
      throw new Error(`Failed to fetch providers: ${providersError.message}`)
    }

    const results = {
      created: [],
      linked: [],
      errors: [],
      alreadyLinked: []
    }

    // Process each provider
    for (const provider of providers) {
      try {
        console.log(`\n📋 Processing ${provider.first_name} ${provider.last_name} (${provider.email})`)

        // Skip if already has auth_user_id
        if (provider.auth_user_id) {
          console.log(`✅ Already linked to auth user: ${provider.auth_user_id}`)
          results.alreadyLinked.push({
            name: `${provider.first_name} ${provider.last_name}`,
            email: provider.email,
            auth_user_id: provider.auth_user_id
          })
          continue
        }

        // Check if auth user already exists with this email
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = existingUsers.users.find(user => user.email === provider.email)

        let authUserId = null

        if (existingUser) {
          console.log(`📧 Found existing auth user for ${provider.email}`)
          authUserId = existingUser.id
        } else {
          console.log(`🆕 Creating new auth user for ${provider.email}`)
          
          // Create new auth user
          const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email: provider.email,
            password: 'TempPassword123!', // They'll change this on first login
            email_confirm: true,
            user_metadata: {
              first_name: provider.first_name,
              last_name: provider.last_name,
              role: 'provider'
            }
          })

          if (createError) {
            throw new Error(`Failed to create auth user: ${createError.message}`)
          }

          authUserId = newUser.user.id
          results.created.push({
            name: `${provider.first_name} ${provider.last_name}`,
            email: provider.email,
            auth_user_id: authUserId,
            temp_password: 'TempPassword123!'
          })
        }

        // Update provider with auth_user_id
        const { error: updateError } = await supabaseAdmin
          .from('providers')
          .update({ auth_user_id: authUserId })
          .eq('id', provider.id)

        if (updateError) {
          throw new Error(`Failed to link provider: ${updateError.message}`)
        }

        console.log(`✅ Successfully linked ${provider.first_name} ${provider.last_name} to auth user ${authUserId}`)
        results.linked.push({
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email,
          auth_user_id: authUserId
        })

      } catch (error) {
        console.error(`❌ Error processing ${provider.first_name} ${provider.last_name}:`, error.message)
        results.errors.push({
          name: `${provider.first_name} ${provider.last_name}`,
          email: provider.email,
          error: error.message
        })
      }
    }

    // Special handling for Rufus Sweeney admin role
    try {
      console.log('\n👑 Setting up admin role for Rufus Sweeney...')
      
      // Find Rufus in providers
      const rufus = providers.find(p => 
        p.email === 'rufussweeney@gmail.com' || 
        p.first_name?.toLowerCase() === 'rufus'
      )

      if (rufus) {
        // Update Rufus to have admin role
        const { error: rufusError } = await supabaseAdmin
          .from('providers')
          .update({ role: 'admin' })
          .eq('id', rufus.id)

        if (rufusError) {
          console.error('❌ Failed to set Rufus as admin:', rufusError.message)
          results.errors.push({
            name: 'Rufus Admin Setup',
            error: rufusError.message
          })
        } else {
          console.log('✅ Rufus Sweeney set as admin')
          results.rufusAdminSet = true
        }
      }
    } catch (error) {
      console.error('❌ Error setting up Rufus admin role:', error.message)
      results.errors.push({
        name: 'Rufus Admin Setup',
        error: error.message
      })
    }

    console.log('\n🎉 Provider auth setup complete!')
    console.log(`📊 Results: Created ${results.created.length}, Linked ${results.linked.length}, Errors: ${results.errors.length}`)

    return NextResponse.json({
      success: true,
      message: 'Provider authentication setup completed',
      results: results
    })

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    return NextResponse.json({
      success: false,
      error: 'Provider auth setup failed',
      details: error.message
    }, { status: 500 })
  }
}