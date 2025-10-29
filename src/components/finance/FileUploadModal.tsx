'use client'

import { useState } from 'react'
import { X, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'

interface FileUploadModalProps {
  type: 'appointments' | 'era'
  onClose: () => void
  onSuccess: () => void
}

export default function FileUploadModal({ type, onClose, onSuccess }: FileUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    try {
      setUploading(true)

      const formData = new FormData()
      formData.append('file', file)

      const endpoint = type === 'appointments'
        ? '/api/finance/upload/appointments'
        : '/api/finance/upload/era'

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.success) {
        setResult(data)

        if (data.status !== 'duplicate') {
          // Auto-close after success (unless duplicate)
          setTimeout(() => {
            onSuccess()
          }, 2000)
        }
      } else {
        throw new Error(data.error || 'Upload failed')
      }
    } catch (error: any) {
      alert('Upload failed: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  const isAppointments = type === 'appointments'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-stone-200">
          <div>
            <h2 className="text-xl font-bold text-[#091747] font-['Newsreader']">
              Upload {isAppointments ? 'Appointments' : 'ERA'} CSV
            </h2>
            <p className="text-sm text-[#091747]/60 mt-1">
              {isAppointments
                ? 'Upload appointment data to sync with finance system'
                : 'Upload ERA (835) remittance data to track payments'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-[#091747]" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* CSV Format Guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Required CSV Columns:</h3>
            {isAppointments ? (
              <ul className="text-sm text-blue-800 space-y-1">
                <li><code className="bg-blue-100 px-1 rounded">Date</code> - Appointment date (YYYY-MM-DD or MM/DD/YYYY)</li>
                <li><code className="bg-blue-100 px-1 rounded">Service</code> - Service name</li>
                <li><code className="bg-blue-100 px-1 rounded">Practitioner</code> - Provider full name</li>
                <li><code className="bg-blue-100 px-1 rounded">Patient_Last</code> - Patient last name</li>
                <li><code className="bg-blue-100 px-1 rounded">Payer</code> - Payer name (optional)</li>
                <li><code className="bg-blue-100 px-1 rounded">Revenue_Type</code> - Cash/Medicaid/Commercial</li>
                <li><code className="bg-blue-100 px-1 rounded">Price</code> - Dollar amount</li>
                <li><code className="bg-blue-100 px-1 rounded">External_ID</code> - IntakeQ ID (optional)</li>
              </ul>
            ) : (
              <ul className="text-sm text-blue-800 space-y-1">
                <li><code className="bg-blue-100 px-1 rounded">Claim_Control_Number</code> - Unique claim ID</li>
                <li><code className="bg-blue-100 px-1 rounded">Member_ID</code> - Insurance member ID</li>
                <li><code className="bg-blue-100 px-1 rounded">DOS</code> - Date of service (YYYY-MM-DD)</li>
                <li><code className="bg-blue-100 px-1 rounded">Provider_NPI</code> - Provider NPI number</li>
                <li><code className="bg-blue-100 px-1 rounded">Payment_Amount</code> - Dollar amount paid</li>
                <li><code className="bg-blue-100 px-1 rounded">Adjustment_Amount</code> - Adjustment amount (optional)</li>
                <li><code className="bg-blue-100 px-1 rounded">Check_Number</code> - Check/EFT number (optional)</li>
                <li><code className="bg-blue-100 px-1 rounded">Payment_Date</code> - Payment date (optional)</li>
              </ul>
            )}
          </div>

          {/* File Input */}
          <div>
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-stone-300 rounded-lg cursor-pointer hover:border-[#BF9C73] hover:bg-stone-50 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="h-8 w-8 text-[#091747]/40 mb-2" />
                <p className="text-sm text-[#091747]/60">
                  {file ? (
                    <span className="font-medium text-[#BF9C73]">{file.name}</span>
                  ) : (
                    <>
                      <span className="font-medium">Click to upload</span> or drag and drop
                    </>
                  )}
                </p>
                <p className="text-xs text-[#091747]/40 mt-1">CSV files only</p>
              </div>
              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                <span>Upload CSV</span>
              </>
            )}
          </button>

          {/* Results */}
          {result && (
            <div className={`p-4 rounded-lg border ${
              result.status === 'duplicate'
                ? 'bg-yellow-50 border-yellow-200'
                : 'bg-green-50 border-green-200'
            }`}>
              <div className="flex items-start space-x-3">
                {result.status === 'duplicate' ? (
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className={`font-medium ${
                    result.status === 'duplicate' ? 'text-yellow-900' : 'text-green-900'
                  }`}>
                    {result.message}
                  </h4>
                  {result.results && (
                    <div className="mt-2 text-sm space-y-1">
                      {result.results.total && (
                        <div className="text-[#091747]/80">
                          Total rows: <span className="font-medium">{result.results.total}</span>
                        </div>
                      )}
                      {isAppointments ? (
                        <>
                          {result.results.ingested !== undefined && (
                            <div className="text-[#091747]/80">
                              Ingested: <span className="font-medium">{result.results.ingested}</span>
                            </div>
                          )}
                          {result.results.appointments_created !== undefined && (
                            <div className="text-[#091747]/80">
                              Appointments created: <span className="font-medium">{result.results.appointments_created}</span>
                            </div>
                          )}
                          {result.results.appointments_updated !== undefined && (
                            <div className="text-[#091747]/80">
                              Appointments updated: <span className="font-medium">{result.results.appointments_updated}</span>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {result.results.claims_matched !== undefined && (
                            <div className="text-[#091747]/80">
                              Claims matched: <span className="font-medium">{result.results.claims_matched}</span>
                            </div>
                          )}
                          {result.results.claims_created !== undefined && (
                            <div className="text-[#091747]/80">
                              Claims created: <span className="font-medium">{result.results.claims_created}</span>
                            </div>
                          )}
                          {result.results.remittances_created !== undefined && (
                            <div className="text-[#091747]/80">
                              Remittances created: <span className="font-medium">{result.results.remittances_created}</span>
                            </div>
                          )}
                          {result.results.appointments_recalculated !== undefined && (
                            <div className="text-[#091747]/80">
                              Earnings recalculated: <span className="font-medium">{result.results.appointments_recalculated}</span>
                            </div>
                          )}
                        </>
                      )}
                      {result.results.errors && result.results.errors.length > 0 && (
                        <div className="mt-2">
                          <div className="text-red-900 font-medium">Errors ({result.results.errors.length}):</div>
                          <div className="mt-1 max-h-32 overflow-y-auto">
                            {result.results.errors.map((err: any, idx: number) => (
                              <div key={idx} className="text-xs text-red-800">
                                Row {err.row}: {err.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-stone-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-stone-200 hover:bg-stone-50 text-[#091747] rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
