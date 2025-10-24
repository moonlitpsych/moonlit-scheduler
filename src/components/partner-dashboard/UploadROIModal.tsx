// Upload ROI Modal Component
'use client'

import { useState } from 'react'
import { X, Upload, FileText, Calendar, AlertCircle, CheckCircle } from 'lucide-react'

interface Patient {
  id: string
  first_name: string
  last_name: string
  affiliation: {
    id: string
    consent_on_file: boolean
    consent_expires_on?: string
    roi_file_url?: string
  }
}

interface UploadROIModalProps {
  patient: Patient
  organizationId: string
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

type ROIMode = 'upload' | 'practiceq'

export function UploadROIModal({ patient, organizationId, isOpen, onClose, onSuccess }: UploadROIModalProps) {
  const [mode, setMode] = useState<ROIMode>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [expirationDate, setExpirationDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      if (selectedFile.type !== 'application/pdf') {
        setError('Please select a PDF file')
        return
      }
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB')
        return
      }
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // For upload mode, require file
    if (mode === 'upload' && !file) {
      setError('Please select a file to upload')
      return
    }

    try {
      setUploading(true)
      setError(null)

      if (mode === 'practiceq') {
        // Mark ROI as stored on PracticeQ
        const response = await fetch(`/api/partner-dashboard/patients/${patient.id}/roi/practiceq`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            affiliation_id: patient.affiliation.id,
            expiration_date: expirationDate || null
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to mark ROI as stored on PracticeQ')
        }
      } else {
        // Upload file mode
        const formData = new FormData()
        formData.append('file', file!)
        formData.append('patient_id', patient.id)
        formData.append('organization_id', organizationId)
        formData.append('affiliation_id', patient.affiliation.id)
        formData.append('expiration_date', expirationDate)

        const response = await fetch(`/api/partner-dashboard/patients/${patient.id}/roi`, {
          method: 'POST',
          body: formData
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to upload ROI')
        }
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
        handleClose()
      }, 1500)

    } catch (err: any) {
      console.error('Error handling ROI:', err)
      setError(err.message || 'Failed to process ROI document')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setMode('upload')
    setFile(null)
    setExpirationDate('')
    setError(null)
    setSuccess(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-moonlit-brown" />
            <h2 className="text-xl font-semibold text-moonlit-navy font-['Newsreader']">
              Upload ROI Document
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Patient Info */}
          <div className="mb-6 p-4 bg-moonlit-cream/30 rounded-lg">
            <p className="text-sm text-gray-600 font-['Newsreader']">
              Uploading ROI for:
            </p>
            <p className="text-lg font-semibold text-moonlit-navy font-['Newsreader']">
              {patient.first_name} {patient.last_name}
            </p>
          </div>

          {/* Current ROI Status */}
          {patient.affiliation.roi_file_url && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Existing ROI on file</p>
                  <p className="text-blue-700 mt-1">
                    {mode === 'upload'
                      ? 'Uploading a new document will replace the existing ROI.'
                      : 'Marking ROI as stored on PracticeQ will replace the existing ROI.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mode Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3 font-['Newsreader']">
              How is the ROI stored?
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('upload')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  mode === 'upload'
                    ? 'border-moonlit-brown bg-moonlit-cream/30'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Upload className={`w-5 h-5 mx-auto mb-2 ${mode === 'upload' ? 'text-moonlit-brown' : 'text-gray-400'}`} />
                <p className={`text-sm font-medium ${mode === 'upload' ? 'text-moonlit-navy' : 'text-gray-600'}`}>
                  Upload Document
                </p>
                <p className="text-xs text-gray-500 mt-1">Upload ROI PDF to our system</p>
              </button>
              <button
                type="button"
                onClick={() => setMode('practiceq')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  mode === 'practiceq'
                    ? 'border-moonlit-brown bg-moonlit-cream/30'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className={`w-5 h-5 mx-auto mb-2 ${mode === 'practiceq' ? 'text-moonlit-brown' : 'text-gray-400'}`} />
                <p className={`text-sm font-medium ${mode === 'practiceq' ? 'text-moonlit-navy' : 'text-gray-600'}`}>
                  Stored on PracticeQ
                </p>
                <p className="text-xs text-gray-500 mt-1">ROI is in PracticeQ system</p>
              </button>
            </div>
          </div>

          {/* File Upload (only show in upload mode) */}
          {mode === 'upload' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 font-['Newsreader']">
                ROI Document (PDF)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-moonlit-brown transition-colors">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  id="roi-file-input"
                  disabled={uploading}
                />
                <label
                  htmlFor="roi-file-input"
                  className="cursor-pointer flex flex-col items-center space-y-2"
                >
                  <Upload className="w-8 h-8 text-moonlit-brown" />
                  {file ? (
                    <div className="text-sm">
                      <p className="font-medium text-moonlit-navy">{file.name}</p>
                      <p className="text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600">
                      <p className="font-medium">Click to upload PDF</p>
                      <p className="text-gray-500">Maximum file size: 10MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* PracticeQ Confirmation (only show in practiceq mode) */}
          {mode === 'practiceq' && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  <p className="font-medium mb-1">ROI Stored on PracticeQ</p>
                  <p className="text-green-700">
                    This will mark the ROI as on file in our system without uploading a document.
                    The actual ROI document is stored in PracticeQ.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Expiration Date */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2 font-['Newsreader']">
              <Calendar className="w-4 h-4 inline mr-1" />
              ROI Expiration Date <span className="text-gray-500 font-normal">(Optional)</span>
            </label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              disabled={uploading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-moonlit-brown focus:border-moonlit-brown"
            />
            <p className="mt-1 text-xs text-gray-500 font-['Newsreader']">
              Leave blank if ROI does not expire. Typical ROI documents are valid for 1 year.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-800 font-medium">ROI uploaded successfully!</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={uploading}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium font-['Newsreader'] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || (mode === 'upload' && !file)}
              className="px-4 py-2 bg-moonlit-brown text-white rounded-lg hover:bg-moonlit-brown/90 font-medium font-['Newsreader'] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{mode === 'practiceq' ? 'Saving...' : 'Uploading...'}</span>
                </>
              ) : (
                <>
                  {mode === 'practiceq' ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      <span>Mark ROI on File</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload ROI</span>
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
