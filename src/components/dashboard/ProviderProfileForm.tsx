'use client'

import { Database } from '@/types/database'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/contexts/ToastContext'
import { Camera, Save, User, Phone, Mail, MapPin, Languages, GraduationCap, Settings, FileText } from 'lucide-react'
import { useEffect, useState } from 'react'

type Provider = Database['public']['Tables']['providers']['Row']

export default function ProviderProfileForm() {
  const [provider, setProvider] = useState<Provider | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    address: '',
    title: '',
    languages_spoken: [] as string[],
    what_i_look_for_in_a_patient: '',
    med_school_org: '',
    med_school_grad_year: null as number | null,
    residency_org: '',
    accepts_new_patients: true,
    telehealth_enabled: true,
    npi: '',
    profile_image_url: ''
  })
  
  const supabase = createClientComponentClient<Database>()
  const toast = useToast()

  useEffect(() => {
    loadProviderData()
  }, [])

  const loadProviderData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: providerData, error } = await supabase
        .from('providers')
        .select('*')
        .eq('auth_user_id', user.id)
        .eq('is_active', true)
        .single()

      if (error || !providerData) {
        console.error('Provider not found:', error)
        toast.error('Error', 'Provider profile not found')
        return
      }

      setProvider(providerData)
      setFormData({
        first_name: providerData.first_name || '',
        last_name: providerData.last_name || '',
        email: providerData.email || '',
        phone_number: providerData.phone_number || '',
        address: providerData.address || '',
        title: providerData.title || '',
        languages_spoken: providerData.languages_spoken || [],
        what_i_look_for_in_a_patient: providerData.what_i_look_for_in_a_patient || '',
        med_school_org: providerData.med_school_org || '',
        med_school_grad_year: providerData.med_school_grad_year,
        residency_org: providerData.residency_org || '',
        accepts_new_patients: providerData.accepts_new_patients ?? true,
        telehealth_enabled: providerData.telehealth_enabled ?? true,
        npi: providerData.npi || '',
        profile_image_url: providerData.profile_image_url || ''
      })
    } catch (error) {
      console.error('Error loading provider data:', error)
      toast.error('Load Error', 'Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleLanguageChange = (language: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      languages_spoken: checked 
        ? [...prev.languages_spoken, language]
        : prev.languages_spoken.filter(lang => lang !== language)
    }))
  }

  const handleSave = async () => {
    if (!provider) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('providers')
        .update({
          first_name: formData.first_name,
          last_name: formData.last_name,
          email: formData.email,
          phone_number: formData.phone_number,
          address: formData.address,
          title: formData.title,
          languages_spoken: formData.languages_spoken,
          what_i_look_for_in_a_patient: formData.what_i_look_for_in_a_patient,
          med_school_org: formData.med_school_org,
          med_school_grad_year: formData.med_school_grad_year,
          residency_org: formData.residency_org,
          accepts_new_patients: formData.accepts_new_patients,
          telehealth_enabled: formData.telehealth_enabled,
          npi: formData.npi,
          profile_image_url: formData.profile_image_url,
          modified_date: new Date().toISOString()
        })
        .eq('id', provider.id)

      if (error) {
        console.error('Error updating profile:', error)
        toast.error('Save Error', 'Failed to update profile')
        return
      }

      toast.success('Profile Updated', 'Your profile has been saved successfully')
      await loadProviderData() // Reload to get latest data
    } catch (error) {
      console.error('Error saving profile:', error)
      toast.error('Save Error', 'An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  const commonLanguages = [
    'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 
    'Russian', 'Chinese (Mandarin)', 'Chinese (Cantonese)', 'Japanese', 
    'Korean', 'Arabic', 'Hindi', 'Tagalog', 'Vietnamese'
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#BF9C73]"></div>
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-600">Provider profile not found. Please contact support.</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center space-x-6">
          <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-[#BF9C73] to-[#F6B398] rounded-full flex items-center justify-center">
              {formData.profile_image_url ? (
                <img 
                  src={formData.profile_image_url} 
                  alt="Profile" 
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold text-2xl">
                  {`${formData.first_name?.[0] || ''}${formData.last_name?.[0] || ''}`}
                </span>
              )}
            </div>
            <button className="absolute bottom-0 right-0 p-2 bg-[#BF9C73] text-white rounded-full hover:bg-[#A8865F] transition-colors">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#091747] font-['Newsreader']">
              {formData.first_name} {formData.last_name}
            </h2>
            <p className="text-[#BF9C73] font-medium">{formData.title || 'Healthcare Provider'}</p>
            <p className="text-sm text-stone-600 mt-1">Provider ID: {provider.id.slice(0, 8)}...</p>
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center mb-6">
          <User className="h-5 w-5 text-[#BF9C73] mr-2" />
          <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Basic Information</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">First Name</label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => handleInputChange('first_name', e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="Enter your first name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">Last Name</label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => handleInputChange('last_name', e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="Enter your last name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">Professional Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="e.g., MD, Psychiatrist"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">NPI Number</label>
            <input
              type="text"
              value={formData.npi}
              onChange={(e) => handleInputChange('npi', e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="Enter your NPI number"
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center mb-6">
          <Phone className="h-5 w-5 text-[#BF9C73] mr-2" />
          <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Contact Information</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="Enter your email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">Phone Number</label>
            <input
              type="tel"
              value={formData.phone_number}
              onChange={(e) => handleInputChange('phone_number', e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="Enter your phone number"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#091747] mb-2">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="Enter your address"
            />
          </div>
        </div>
      </div>

      {/* Languages */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center mb-6">
          <Languages className="h-5 w-5 text-[#BF9C73] mr-2" />
          <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Languages Spoken</h3>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {commonLanguages.map((language) => (
            <label key={language} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.languages_spoken.includes(language)}
                onChange={(e) => handleLanguageChange(language, e.target.checked)}
                className="w-4 h-4 text-[#BF9C73] border-stone-300 rounded focus:ring-[#BF9C73]"
              />
              <span className="text-sm text-[#091747]">{language}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Education */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center mb-6">
          <GraduationCap className="h-5 w-5 text-[#BF9C73] mr-2" />
          <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Education & Training</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">Medical School</label>
            <input
              type="text"
              value={formData.med_school_org}
              onChange={(e) => handleInputChange('med_school_org', e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="Enter your medical school"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#091747] mb-2">Graduation Year</label>
            <input
              type="number"
              value={formData.med_school_grad_year || ''}
              onChange={(e) => handleInputChange('med_school_grad_year', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="e.g., 2015"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[#091747] mb-2">Residency Organization</label>
            <input
              type="text"
              value={formData.residency_org}
              onChange={(e) => handleInputChange('residency_org', e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
              placeholder="Enter your residency program"
            />
          </div>
        </div>
      </div>

      {/* Practice Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center mb-6">
          <Settings className="h-5 w-5 text-[#BF9C73] mr-2" />
          <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Practice Settings</h3>
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.accepts_new_patients}
              onChange={(e) => handleInputChange('accepts_new_patients', e.target.checked)}
              className="w-4 h-4 text-[#BF9C73] border-stone-300 rounded focus:ring-[#BF9C73]"
            />
            <label className="ml-3 text-sm font-medium text-[#091747]">
              Currently accepting new patients
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.telehealth_enabled}
              onChange={(e) => handleInputChange('telehealth_enabled', e.target.checked)}
              className="w-4 h-4 text-[#BF9C73] border-stone-300 rounded focus:ring-[#BF9C73]"
            />
            <label className="ml-3 text-sm font-medium text-[#091747]">
              Offer telehealth appointments
            </label>
          </div>
        </div>
      </div>

      {/* Patient Information */}
      <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
        <div className="flex items-center mb-6">
          <FileText className="h-5 w-5 text-[#BF9C73] mr-2" />
          <h3 className="text-lg font-semibold text-[#091747] font-['Newsreader']">Patient Information</h3>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-[#091747] mb-2">
            What I look for in a patient
          </label>
          <textarea
            value={formData.what_i_look_for_in_a_patient}
            onChange={(e) => handleInputChange('what_i_look_for_in_a_patient', e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent transition-colors"
            placeholder="Describe the type of patients you work best with or prefer to see..."
          />
          <p className="text-xs text-stone-500 mt-2">This information helps patients understand if you're a good fit for their needs.</p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center px-6 py-3 bg-[#BF9C73] hover:bg-[#A8865F] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Profile
            </>
          )}
        </button>
      </div>
    </div>
  )
}