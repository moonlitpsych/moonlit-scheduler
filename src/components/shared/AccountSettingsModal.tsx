/**
 * Account Settings Modal Component
 * Universal component for changing passwords across all dashboards
 * (Admin, Provider, Partner)
 */

'use client'

import { useState } from 'react'
import { X, Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

interface AccountSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  userEmail?: string
}

export function AccountSettingsModal({
  isOpen,
  onClose,
  userEmail
}: AccountSettingsModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const supabase = createClientComponentClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields')
      return
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    // Check password strength
    const hasUpperCase = /[A-Z]/.test(newPassword)
    const hasLowerCase = /[a-z]/.test(newPassword)
    const hasNumbers = /\d/.test(newPassword)
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword)

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      setError('Password must contain uppercase, lowercase, number, and special character')
      return
    }

    setLoading(true)

    try {
      // Update password using Supabase auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)

      // Reset form
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Close modal after 2 seconds
      setTimeout(() => {
        onClose()
        setSuccess(false)
      }, 2000)

    } catch (err: any) {
      console.error('Password change error:', err)
      setError(err.message || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccess(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-moonlit-brown/10 rounded-lg">
              <Lock className="w-5 h-5 text-moonlit-brown" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-moonlit-navy font-['Newsreader']">
                Account Settings
              </h2>
              {userEmail && (
                <p className="text-sm text-gray-600 mt-1">{userEmail}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Password changed successfully!
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Closing modal...
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
                  placeholder="Enter new password"
                  required
                  disabled={loading || success}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-transparent"
                  placeholder="Confirm new password"
                  required
                  disabled={loading || success}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">
                Password Requirements:
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li className={newPassword.length >= 8 ? 'text-green-600' : ''}>
                  • At least 8 characters
                </li>
                <li className={/[A-Z]/.test(newPassword) ? 'text-green-600' : ''}>
                  • One uppercase letter
                </li>
                <li className={/[a-z]/.test(newPassword) ? 'text-green-600' : ''}>
                  • One lowercase letter
                </li>
                <li className={/\d/.test(newPassword) ? 'text-green-600' : ''}>
                  • One number
                </li>
                <li className={/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? 'text-green-600' : ''}>
                  • One special character
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 font-medium"
              disabled={loading || success}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-moonlit-brown text-white rounded-lg hover:bg-moonlit-brown/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              disabled={loading || success}
            >
              {loading ? 'Changing Password...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
