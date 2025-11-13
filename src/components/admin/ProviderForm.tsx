/**
 * Provider Form Component
 *
 * Comprehensive form for creating and editing providers
 * Used in modal for both create and edit modes
 */

'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, AlertCircle } from 'lucide-react'

interface ProviderFormProps {
  mode: 'create' | 'edit'
  provider?: any
  onSuccess: () => void
  onCancel: () => void
}

export default function ProviderForm({ mode, provider, onSuccess, onCancel }: ProviderFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<any[]>([])
  const [loadingMetadata, setLoadingMetadata] = useState(true)

  // Options fetched from database
  const [titleOptions, setTitleOptions] = useState<string[]>([])
  const [roleOptions, setRoleOptions] = useState<string[]>([])
  const [providerTypeOptions, setProviderTypeOptions] = useState<string[]>([])
  const [languageOptions, setLanguageOptions] = useState<string[]>([])

  // Form state
  const [formData, setFormData] = useState({
    // Basic Info
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    title: '',

    // Professional
    role: '',
    provider_type: '',
    npi: '',

    // Status
    is_active: true,
    is_bookable: false,
    list_on_provider_page: false,
    accepts_new_patients: true,
    telehealth_enabled: true,

    // Profile
    about: '',
    profile_image_url: '',
    languages_spoken: [] as string[],

    // Education
    med_school_org: '',
    med_school_grad_year: '',
    residency_org: '',

    // Integration IDs
    athena_provider_id: '',
  })

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  // Fetch metadata from database on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const response = await fetch('/api/admin/providers/metadata')
        const result = await response.json()

        if (result.success) {
          setTitleOptions(result.data.titles || [])
          setRoleOptions(result.data.roles || [])
          setProviderTypeOptions(result.data.providerTypes || [])
          setLanguageOptions(result.data.languages || [])
        }
      } catch (err) {
        console.error('Failed to fetch metadata:', err)
      } finally {
        setLoadingMetadata(false)
      }
    }

    fetchMetadata()
  }, [])

  // Initialize form with provider data in edit mode
  useEffect(() => {
    if (mode === 'edit' && provider) {
      setFormData({
        first_name: provider.first_name || '',
        last_name: provider.last_name || '',
        email: provider.email || '',
        phone_number: provider.phone_number || '',
        title: provider.title || '',
        role: provider.role || '',
        provider_type: provider.provider_type || '',
        npi: provider.npi || '',
        is_active: provider.is_active !== false,
        is_bookable: provider.is_bookable || false,
        list_on_provider_page: provider.list_on_provider_page || false,
        accepts_new_patients: provider.accepts_new_patients !== false,
        telehealth_enabled: provider.telehealth_enabled !== false,
        about: provider.about || '',
        profile_image_url: provider.profile_image_url || '',
        languages_spoken: provider.languages_spoken || ['en'],
        med_school_org: provider.med_school_org || '',
        med_school_grad_year: provider.med_school_grad_year ? String(provider.med_school_grad_year) : '',
        residency_org: provider.residency_org || '',
        athena_provider_id: provider.athena_provider_id || ''
      })
      // Set initial preview if provider has an image
      if (provider.profile_image_url) {
        setImagePreview(provider.profile_image_url)
      }
    }
  }, [mode, provider])

  const handleLanguageToggle = (lang: string) => {
    setFormData(prev => ({
      ...prev,
      languages_spoken: prev.languages_spoken.includes(lang)
        ? prev.languages_spoken.filter(l => l !== lang)
        : [...prev.languages_spoken, lang]
    }))
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setImageFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setFormData(prev => ({ ...prev, profile_image_url: '' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setValidationErrors([])

    try {
      // Upload image first if a new file was selected
      let imageUrl = formData.profile_image_url
      if (imageFile) {
        setUploadingImage(true)
        const uploadFormData = new FormData()
        uploadFormData.append('file', imageFile)
        uploadFormData.append('providerId', provider?.id || 'new')
        uploadFormData.append('providerName', `${formData.first_name}-${formData.last_name}`)

        const uploadResponse = await fetch('/api/admin/providers/upload-image', {
          method: 'POST',
          body: uploadFormData
        })

        const uploadResult = await uploadResponse.json()
        setUploadingImage(false)

        if (!uploadResult.success) {
          setError(uploadResult.error || 'Failed to upload image')
          setLoading(false)
          return
        }

        imageUrl = uploadResult.data.url
      }

      // Prepare payload
      const payload = {
        ...formData,
        profile_image_url: imageUrl,
        med_school_grad_year: formData.med_school_grad_year ? parseInt(formData.med_school_grad_year) : null,
        languages_spoken: formData.languages_spoken.length > 0 ? formData.languages_spoken : ['en']
      }

      const url = mode === 'create'
        ? '/api/admin/providers'
        : `/api/admin/providers/${provider.id}`

      const method = mode === 'create' ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!result.success) {
        if (result.validationErrors) {
          setValidationErrors(result.validationErrors)
          setError('Please fix the validation errors below')
        } else {
          setError(result.error || 'Failed to save provider')
        }
        setLoading(false)
        return
      }

      // Success
      onSuccess()

    } catch (err: any) {
      console.error('Submit error:', err)
      setError(err.message || 'An unexpected error occurred')
      setLoading(false)
    }
  }

  const getFieldError = (field: string) => {
    return validationErrors.find(e => e.field === field)?.message
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-moonlit-navy text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold font-['Newsreader']">
            {mode === 'create' ? 'Add New Provider' : 'Edit Provider'}
          </h2>
          <button
            onClick={onCancel}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">{error}</p>
              {validationErrors.length > 0 && (
                <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err.field}: {err.message}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[calc(90vh-180px)]">
          <div className="px-6 py-6 space-y-8">
            {/* Basic Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 border-b pb-2">
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown ${
                      getFieldError('first_name') ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {getFieldError('first_name') && (
                    <p className="text-xs text-red-600 mt-1">{getFieldError('first_name')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown ${
                      getFieldError('last_name') ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {getFieldError('last_name') && (
                    <p className="text-xs text-red-600 mt-1">{getFieldError('last_name')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown ${
                      getFieldError('email') ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {getFieldError('email') && (
                    <p className="text-xs text-red-600 mt-1">{getFieldError('email')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown ${
                      getFieldError('phone_number') ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="(555) 555-5555"
                  />
                  {getFieldError('phone_number') && (
                    <p className="text-xs text-red-600 mt-1">{getFieldError('phone_number')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <select
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                  >
                    <option value="">Select title...</option>
                    {titleOptions.map(title => (
                      <option key={title} value={title}>{title}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Profile Image Section */}
            <div>
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 border-b pb-2">
                Profile Image
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Headshot
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Recommended: Background-removed professional headshot, PNG or JPG, max 5MB
                  </p>

                  <div className="flex items-start gap-6">
                    {/* Image Preview */}
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Provider headshot preview"
                          className="w-32 h-40 object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-32 h-40 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                        <span className="text-gray-400 text-xs text-center px-2">
                          No image<br/>selected
                        </span>
                      </div>
                    )}

                    {/* Upload Button */}
                    <div className="flex-1">
                      <input
                        type="file"
                        id="image-upload"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="image-upload"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer"
                      >
                        {uploadingImage ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          'Choose Image'
                        )}
                      </label>
                      {formData.profile_image_url && (
                        <p className="text-xs text-green-600 mt-2">
                          ✓ Image saved: {formData.profile_image_url}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 border-b pb-2">
                Professional Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                  >
                    <option value="">Select role...</option>
                    {roleOptions.map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Provider Type
                  </label>
                  <select
                    value={formData.provider_type}
                    onChange={(e) => setFormData({ ...formData, provider_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                  >
                    <option value="">Select type...</option>
                    {providerTypeOptions.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    NPI
                  </label>
                  <input
                    type="text"
                    value={formData.npi}
                    onChange={(e) => setFormData({ ...formData, npi: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown ${
                      getFieldError('npi') ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="10-digit NPI"
                    maxLength={10}
                  />
                  {getFieldError('npi') && (
                    <p className="text-xs text-red-600 mt-1">{getFieldError('npi')}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Athena Provider ID
                  </label>
                  <input
                    type="text"
                    value={formData.athena_provider_id}
                    onChange={(e) => setFormData({ ...formData, athena_provider_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                    placeholder="EHR provider ID"
                  />
                </div>
              </div>
            </div>

            {/* Status Settings Section */}
            <div>
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 border-b pb-2">
                Status Settings
              </h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-moonlit-brown border-gray-300 rounded focus:ring-moonlit-brown"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <p className="text-xs text-gray-500">Provider is active in the system</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.is_bookable}
                    onChange={(e) => setFormData({ ...formData, is_bookable: e.target.checked })}
                    className="w-4 h-4 text-moonlit-brown border-gray-300 rounded focus:ring-moonlit-brown"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Bookable</span>
                    <p className="text-xs text-gray-500">Patients can book appointments with this provider</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.list_on_provider_page}
                    onChange={(e) => setFormData({ ...formData, list_on_provider_page: e.target.checked })}
                    className="w-4 h-4 text-moonlit-brown border-gray-300 rounded focus:ring-moonlit-brown"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">List on Provider Page</span>
                    <p className="text-xs text-gray-500">Show provider on public practitioners directory</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.accepts_new_patients}
                    onChange={(e) => setFormData({ ...formData, accepts_new_patients: e.target.checked })}
                    className="w-4 h-4 text-moonlit-brown border-gray-300 rounded focus:ring-moonlit-brown"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Accepts New Patients</span>
                    <p className="text-xs text-gray-500">Provider is accepting new patient appointments</p>
                  </div>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={formData.telehealth_enabled}
                    onChange={(e) => setFormData({ ...formData, telehealth_enabled: e.target.checked })}
                    className="w-4 h-4 text-moonlit-brown border-gray-300 rounded focus:ring-moonlit-brown"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-700">Telehealth Enabled</span>
                    <p className="text-xs text-gray-500">Provider offers telehealth appointments</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Languages Section */}
            <div>
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 border-b pb-2">
                Languages Spoken
              </h3>
              {loadingMetadata ? (
                <p className="text-sm text-gray-500">Loading languages...</p>
              ) : languageOptions.length === 0 ? (
                <p className="text-sm text-gray-500">No languages found in database. Add languages by updating existing providers.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {languageOptions.map(lang => (
                    <label key={lang} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.languages_spoken.includes(lang)}
                        onChange={() => handleLanguageToggle(lang)}
                        className="w-4 h-4 text-moonlit-brown border-gray-300 rounded focus:ring-moonlit-brown"
                      />
                      <span className="text-sm text-gray-700">{lang}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Education Section */}
            <div>
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 border-b pb-2">
                Education
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medical School
                  </label>
                  <input
                    type="text"
                    value={formData.med_school_org}
                    onChange={(e) => setFormData({ ...formData, med_school_org: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                    placeholder="e.g., Harvard Medical School"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Graduation Year
                  </label>
                  <input
                    type="number"
                    value={formData.med_school_grad_year}
                    onChange={(e) => setFormData({ ...formData, med_school_grad_year: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown ${
                      getFieldError('med_school_grad_year') ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="YYYY"
                    min="1900"
                    max={new Date().getFullYear() + 10}
                  />
                  {getFieldError('med_school_grad_year') && (
                    <p className="text-xs text-red-600 mt-1">{getFieldError('med_school_grad_year')}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Residency Program
                  </label>
                  <input
                    type="text"
                    value={formData.residency_org}
                    onChange={(e) => setFormData({ ...formData, residency_org: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                    placeholder="e.g., Johns Hopkins Hospital"
                  />
                </div>
              </div>
            </div>

            {/* About Section */}
            <div>
              <h3 className="text-lg font-semibold text-moonlit-navy mb-4 border-b pb-2">
                About / Bio
              </h3>
              <textarea
                value={formData.about}
                onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-moonlit-brown focus:border-moonlit-brown"
                rows={4}
                placeholder="Brief bio about the provider..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-moonlit-brown hover:bg-moonlit-brown/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown disabled:opacity-50"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {mode === 'create' ? 'Create Provider' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
