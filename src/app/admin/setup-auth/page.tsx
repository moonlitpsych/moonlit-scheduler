'use client'

import { useState } from 'react'

// Force dynamic rendering to prevent build issues
export const dynamic = 'force-dynamic'

export default function SetupAuthPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const runSetup = async () => {
    setIsRunning(true)
    setError(null)
    setResults(null)

    try {
      const response = await fetch('/api/admin/setup-provider-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Setup failed')
      }

      setResults(data.results)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Provider Authentication Setup</h1>
      
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Important</h2>
        <p className="text-yellow-700">
          This will create auth users for providers who don&apos;t have them and link existing providers 
          to their auth accounts. It will also set Rufus Sweeney as an admin.
        </p>
      </div>

      <button
        onClick={runSetup}
        disabled={isRunning}
        className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-3 rounded-lg font-semibold"
      >
        {isRunning ? '⏳ Setting up...' : '🚀 Run Provider Auth Setup'}
      </button>

      {error && (
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-red-800">❌ Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {results && (
        <div className="mt-6 space-y-4">
          <h2 className="text-2xl font-bold text-green-800">✅ Setup Complete!</h2>
          
          {results.created.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-800 mb-2">🆕 New Auth Users Created</h3>
              {results.created.map((user, index) => (
                <div key={index} className="text-sm text-green-700 mb-1">
                  <strong>{user.name}</strong> ({user.email}) → {user.auth_user_id}
                  <br />
                  <em className="text-green-600">Temp Password: {user.temp_password}</em>
                </div>
              ))}
            </div>
          )}

          {results.linked.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">🔗 Providers Linked</h3>
              {results.linked.map((user, index) => (
                <div key={index} className="text-sm text-blue-700">
                  <strong>{user.name}</strong> ({user.email}) → {user.auth_user_id}
                </div>
              ))}
            </div>
          )}

          {results.alreadyLinked.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">✅ Already Linked</h3>
              {results.alreadyLinked.map((user, index) => (
                <div key={index} className="text-sm text-gray-700">
                  <strong>{user.name}</strong> ({user.email}) → {user.auth_user_id}
                </div>
              ))}
            </div>
          )}

          {results.rufusAdminSet && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-purple-800">👑 Admin Role Set</h3>
              <p className="text-purple-700">Rufus Sweeney has been granted admin privileges</p>
            </div>
          )}

          {results.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-800 mb-2">❌ Errors</h3>
              {results.errors.map((error, index) => (
                <div key={index} className="text-sm text-red-700">
                  <strong>{error.name}</strong>: {error.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}