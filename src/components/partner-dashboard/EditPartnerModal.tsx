// Edit Partner Modal Component
'use client'

import { useState, useEffect } from 'react'
import { Partner } from '@/types/partner-types'

interface EditPartnerModalProps {
  partner: Partner
  onClose: () => void
  onPartnerUpdated: (partner: Partner) => void
}

export function EditPartnerModal({ partner, onClose, onPartnerUpdated }: EditPartnerModalProps) {
  const [formData, setFormData] = useState({
    name: partner.name,
    contact_email: partner.contact_email || '',
    contact_phone: partner.contact_phone || '',
    contact_person: partner.contact_person || '',
    title: partner.title || '',
    stage: partner.stage,
    status: partner.status,
    source: partner.source || '',
    specialties: partner.specialties || [],
    insurance_types: partner.insurance_types || [],
    monthly_referral_capacity: partner.monthly_referral_capacity || 0,
    notes: partner.notes || '',
    website: partner.website || '',
    linkedin_url: partner.linkedin_url || '',
    first_contact_date: partner.first_contact_date || '',
    last_contact_date: partner.last_contact_date || '',
    contract_signed_date: partner.contract_signed_date || '',
    go_live_date: partner.go_live_date || ''
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleArrayInputChange = (field: 'specialties' | 'insurance_types', value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(Boolean)
    setFormData(prev => ({
      ...prev,
      [field]: items
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!formData.name.trim()) {
        throw new Error('Partner name is required')
      }

      const response = await fetch(`/api/partners/${partner.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          monthly_referral_capacity: parseInt(formData.monthly_referral_capacity?.toString() || '0')
        })
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to update partner')
      }

      onPartnerUpdated(data.data)
    } catch (error: any) {
      console.error('Failed to update partner:', error)
      setError(error.message || 'Failed to update partner')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-moonlit-navy font-['Newsreader']">
              Edit Partner: {partner.name}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="text-red-800 font-medium font-['Newsreader']">{error}</div>
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-moonlit-navy font-['Newsreader']">Basic Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Partner Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                  placeholder="Partner or organization name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Source
                </label>
                <input
                  type="text"
                  name="source"
                  value={formData.source}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                  placeholder="Referral, website, conference, etc."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Stage
                </label>
                <select
                  name="stage"
                  value={formData.stage}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                >
                  <option value="lead">Lead</option>
                  <option value="qualified">Qualified</option>
                  <option value="contract_sent">Contract Sent</option>
                  <option value="live">Live</option>
                  <option value="dormant">Dormant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                >
                  <option value="prospect">Prospect</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-moonlit-navy font-['Newsreader']">Contact Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Contact Person
                </label>
                <input
                  type="text"
                  name="contact_person"
                  value={formData.contact_person}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                  placeholder="Primary contact name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Title
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                  placeholder="Job title or role"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Email
                </label>
                <input
                  type="email"
                  name="contact_email"
                  value={formData.contact_email}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                  placeholder="contact@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Phone
                </label>
                <input
                  type="tel"
                  name="contact_phone"
                  value={formData.contact_phone}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Professional Details */}
          <div className="space-y-4">
            <h4 className="font-medium text-moonlit-navy font-['Newsreader']">Professional Details</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                Specialties
              </label>
              <input
                type="text"
                value={formData.specialties?.join(', ') || ''}
                onChange={(e) => handleArrayInputChange('specialties', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                         focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                placeholder="Addiction treatment, mental health, etc. (comma-separated)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                Insurance Types
              </label>
              <input
                type="text"
                value={formData.insurance_types?.join(', ') || ''}
                onChange={(e) => handleArrayInputChange('insurance_types', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                         focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                placeholder="Medicaid, private, self-pay, etc. (comma-separated)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                Monthly Referral Capacity
              </label>
              <input
                type="number"
                name="monthly_referral_capacity"
                value={formData.monthly_referral_capacity}
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                         focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                placeholder="0"
              />
            </div>
          </div>

          {/* Important Dates */}
          <div className="space-y-4">
            <h4 className="font-medium text-moonlit-navy font-['Newsreader']">Important Dates</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  First Contact Date
                </label>
                <input
                  type="date"
                  name="first_contact_date"
                  value={formData.first_contact_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Last Contact Date
                </label>
                <input
                  type="date"
                  name="last_contact_date"
                  value={formData.last_contact_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Contract Signed Date
                </label>
                <input
                  type="date"
                  name="contract_signed_date"
                  value={formData.contract_signed_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Go Live Date
                </label>
                <input
                  type="date"
                  name="go_live_date"
                  value={formData.go_live_date}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-moonlit-navy font-['Newsreader']">Additional Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  Website
                </label>
                <input
                  type="url"
                  name="website"
                  value={formData.website}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  name="linkedin_url"
                  value={formData.linkedin_url}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                           focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-['Newsreader']">
                Notes
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg font-['Newsreader']
                         focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
                placeholder="Additional notes about this partner..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg
                       hover:bg-gray-50 font-medium font-['Newsreader'] transition-colors
                       disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="px-4 py-2 bg-moonlit-brown text-white font-medium font-['Newsreader'] rounded-lg
                       hover:bg-moonlit-brown-hover transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating...' : 'Update Partner'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}