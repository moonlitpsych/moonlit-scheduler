import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export interface Provider {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  auth_user_id: string
}

class AuthService {
  private supabase = createClientComponentClient()

  // Sign in a provider
  async signIn(email: string, password: string) {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // Get the provider profile
      if (data.user) {
        const provider = await this.getProviderByAuthId(data.user.id)
        return { user: data.user, provider, error: null }
      }

      return { user: null, provider: null, error: 'No user found' }
    } catch (error: any) {
      console.error('Sign in error:', error)
      return { user: null, provider: null, error: error.message }
    }
  }

  // Sign up a new provider
  async signUp(email: string, password: string, firstName: string, lastName: string) {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName,
            last_name: lastName,
          }
        }
      })

      if (error) throw error

      return { user: data.user, error: null }
    } catch (error: any) {
      console.error('Sign up error:', error)
      return { user: null