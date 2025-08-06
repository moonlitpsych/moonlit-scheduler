import { Database } from '@/types/database'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies })

  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/auth/login')
  }

  // Try to get provider info (but don't fail if it doesn't exist yet)
  let provider = null
  try {
    const { data: providerData } = await supabase
      .from('providers')
      .select(`
        *,
        roles (name)
      `)
      .eq('auth_user_id', user.id)
      .single()
    
    provider = providerData
  } catch (error) {
    console.log('Provider not found - this is okay for now')
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-[#091747] mb-4">
        Welcome to Your Dashboard!
      </h2>
      
      <div className="space-y-4">
        {/* Success Messages */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          <p className="text-green-700">✅ Dashboard route is working!</p>
          <p className="text-green-700">✅ Authentication is working!</p>
          <p className="text-green-700">✅ Database connection is working!</p>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          <h3 className="text-lg font-medium text-[#091747] mb-3">Your Account Info</h3>
          <div className="space-y-2">
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Signed up:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Provider Info */}
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6">
          <h3 className="text-lg font-medium text-[#091747] mb-3">Provider Profile</h3>
          {provider ? (
            <div className="space-y-2 text-green-700">
              <p>✅ <strong>Name:</strong> {provider.first_name} {provider.last_name}</p>
              <p>✅ <strong>Role:</strong> {provider.roles?.name || 'No role assigned'}</p>
              <p>✅ <strong>Status:</strong> {provider.is_active ? 'Active' : 'Inactive'}</p>
              <p>✅ <strong>Profile Complete:</strong> {provider.profile_completed ? 'Yes' : 'No'}</p>
            </div>
          ) : (
            <div className="text-orange-600">
              <p>⚠️ Provider profile not found. This is normal if you just created your account.</p>
              <p className="text-sm mt-2">
                Your admin record should be created and linked to this user ID: {user.id}
              </p>
            </div>
          )}
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-medium text-[#091747] mb-3">🎯 Next Steps</h3>
          <ul className="space-y-1 text-blue-800">
            <li>• Test login/logout functionality</li>
            <li>• Add navigation sidebar</li>
            <li>• Create profile management</li>
            <li>• Add admin provider management</li>
          </ul>
        </div>
      </div>
    </div>
  )
}