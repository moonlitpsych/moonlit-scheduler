/**
 * Provider Import Modal Component
 *
 * Handles CSV file upload, validation preview, and bulk import
 */

'use client'

import { useState } from 'react'
import { X, Upload, Download, Loader2, AlertCircle, CheckCircle, FileText, Sparkles } from 'lucide-react'
import { isGoogleFormData, convertGoogleFormData } from '@/lib/services/googleFormConverter'

interface ProviderImportModalProps {
  onSuccess: () => void
  onClose: () => void
}

interface ImportResult {
  rowNumber: number
  success: boolean
  email: string
  provider?: any
  errors?: string[]
}

export default function ProviderImportModal({ onSuccess, onClose }: ProviderImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<any[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResults, setValidationResults] = useState<ImportResult[] | null>(null)
  const [importResults, setImportResults] = useState<any | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGoogleForm, setIsGoogleForm] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setCsvData(null)
      setValidationResults(null)
      setImportResults(null)
      setError(null)
      parseCSV(selectedFile)
    }
  }

  const parseCSV = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const rows = text.split('\n').map(row => row.trim()).filter(row => row)

        if (rows.length < 2) {
          setError('CSV file must contain at least a header row and one data row')
          return
        }

        // Simple CSV parser that handles quoted fields
        const parseCSVRow = (row: string): string[] => {
          const values: string[] = []
          let current = ''
          let inQuotes = false

          for (let i = 0; i < row.length; i++) {
            const char = row[i]

            if (char === '"') {
              inQuotes = !inQuotes
            } else if (char === ',' && !inQuotes) {
              values.push(current.trim())
              current = ''
            } else {
              current += char
            }
          }
          values.push(current.trim())
          return values
        }

        // Parse header
        const headers = parseCSVRow(rows[0])

        // Parse data rows
        const data = rows.slice(1).map(row => {
          const values = parseCSVRow(row)
          const obj: any = {}
          headers.forEach((header, index) => {
            obj[header] = values[index] || ''
          })
          return obj
        })

        // Detect if this is Google Form data
        if (data.length > 0 && isGoogleFormData(data[0])) {
          console.log('✨ Google Form data detected! Converting to provider format...')
          setIsGoogleForm(true)
          const converted = convertGoogleFormData(data)
          setCsvData(converted)
        } else {
          setIsGoogleForm(false)
          setCsvData(data)
        }
      } catch (err: any) {
        setError('Failed to parse CSV file: ' + err.message)
      }
    }
    reader.onerror = () => {
      setError('Failed to read file')
    }
    reader.readAsText(file)
  }

  const handleValidate = async () => {
    if (!csvData) return

    setValidating(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/providers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData,
          dryRun: true
        })
      })

      const result = await response.json()

      if (result.success) {
        setValidationResults(result.results)
      } else {
        setError(result.error || 'Validation failed')
      }
    } catch (err: any) {
      setError('Validation failed: ' + err.message)
    } finally {
      setValidating(false)
    }
  }

  const handleImport = async () => {
    if (!csvData || !validationResults) return

    const validCount = validationResults.filter(r => r.success).length

    if (!confirm(`Import ${validCount} ${validCount === 1 ? 'provider' : 'providers'}? This will create new provider records in the database. Rows with errors (duplicates, validation issues) will be skipped.`)) {
      return
    }

    setImporting(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/providers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          csvData,
          dryRun: false
        })
      })

      const result = await response.json()

      if (result.success) {
        setImportResults(result)
        if (result.summary.errors === 0) {
          setTimeout(() => onSuccess(), 2000)
        }
      } else {
        setError(result.error || 'Import failed')
      }
    } catch (err: any) {
      setError('Import failed: ' + err.message)
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const template = `first_name,last_name,email,title,role,provider_type,npi,phone_number,is_active,is_bookable,list_on_provider_page,accepts_new_patients,telehealth_enabled,languages_spoken,med_school_org,med_school_grad_year,residency_org,athena_provider_id
John,Doe,john.doe@example.com,MD,physician,attending,1234567890,(555) 555-5555,true,true,true,true,true,"en,es",Harvard Medical School,2010,Johns Hopkins Hospital,PROV123
Jane,Smith,jane.smith@example.com,PMHNP,nurse_practitioner,advanced_practice,0987654321,(555) 555-5556,true,false,false,true,true,en,University of Utah,2015,UCLA Medical Center,PROV456`

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'provider-import-template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const successCount = validationResults?.filter(r => r.success).length || 0
  const errorCount = validationResults?.filter(r => !r.success).length || 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-moonlit-navy text-white px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold font-['Newsreader']">
            Import Providers from CSV
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
          {/* Template Download */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">CSV Template</h3>
                <p className="text-sm text-blue-700 mb-3">
                  Download the CSV template with example data and required column headers
                </p>
                <button
                  onClick={downloadTemplate}
                  className="inline-flex items-center px-3 py-2 border border-blue-300 rounded-md text-sm font-medium text-blue-700 bg-white hover:bg-blue-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Template
                </button>
              </div>
            </div>
          </div>

          {/* Login Credentials Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">Login Credentials</h3>
                <p className="text-sm text-amber-700">
                  Auth accounts are created automatically during import. All new providers receive temporary password <code className="px-1 py-0.5 bg-amber-100 rounded text-amber-900 font-mono text-xs">TempPassword123!</code>
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  Providers must change this password on first login. Please notify providers manually of their credentials.
                </p>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Success Alert */}
          {importResults && importResults.summary.errors === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-green-800 font-medium">
                  Successfully imported {importResults.summary.inserted} providers!
                </p>
                <p className="text-sm text-green-700 mt-1">
                  The provider list will refresh automatically.
                </p>
              </div>
            </div>
          )}

          {/* File Upload */}
          {!csvData && !importResults && (
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Upload CSV File
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Select a CSV file with provider data to import
              </p>
              <label className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-moonlit-brown hover:bg-moonlit-brown/90 cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Choose File
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Preview */}
          {csvData && !importResults && (
            <div>
              {/* Google Form Detection Banner */}
              {isGoogleForm && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-purple-900">Google Form Detected</h4>
                    <p className="text-sm text-purple-700 mt-1">
                      Your "Join Moonlit as a psychiatry resident" form responses have been automatically converted to provider format.
                      All fields have been mapped and default values set for new residents.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Preview ({csvData.length} rows)
                  </h3>
                  <p className="text-sm text-gray-500">
                    {file?.name}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFile(null)
                      setCsvData(null)
                      setValidationResults(null)
                    }}
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Clear
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {validating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      'Validate'
                    )}
                  </button>
                </div>
              </div>

              {/* Validation Results */}
              {validationResults && (
                <div className="mb-6">
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Validation Summary</h4>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-700">
                          <span className="font-semibold text-green-700">{successCount}</span> Valid
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-600" />
                        <span className="text-sm text-gray-700">
                          <span className="font-semibold text-red-700">{errorCount}</span> Errors
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error Details */}
                  {errorCount > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                      <h4 className="text-sm font-semibold text-red-900 mb-2">Errors Found</h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {validationResults.filter(r => !r.success).map((result, i) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium text-red-800">Row {result.rowNumber}</span>
                            <span className="text-red-700"> ({result.email}):</span>
                            <ul className="ml-4 mt-1 text-red-600 list-disc list-inside">
                              {result.errors?.map((err, j) => (
                                <li key={j}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">NPI</th>
                        {validationResults && (
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {csvData.slice(0, 20).map((row, i) => {
                        const validationResult = validationResults?.find(r => r.rowNumber === i + 2)
                        return (
                          <tr key={i} className={validationResult && !validationResult.success ? 'bg-red-50' : ''}>
                            <td className="px-3 py-2 text-sm text-gray-900">
                              {row.first_name} {row.last_name}
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600">{row.email}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">{row.title}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">{row.role}</td>
                            <td className="px-3 py-2 text-sm text-gray-600">{row.npi}</td>
                            {validationResults && (
                              <td className="px-3 py-2">
                                {validationResult?.success ? (
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                )}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {csvData.length > 20 && (
                  <div className="bg-gray-50 px-4 py-2 text-sm text-gray-500 text-center border-t border-gray-200">
                    Showing first 20 of {csvData.length} rows
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Complete</h3>
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{importResults.summary.total}</p>
                    <p className="text-sm text-gray-600">Total Rows</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-700">{importResults.summary.inserted}</p>
                    <p className="text-sm text-gray-600">Imported</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-700">{importResults.summary.errors}</p>
                    <p className="text-sm text-gray-600">Errors</p>
                  </div>
                </div>
              </div>

              {/* Auth Account Status */}
              {importResults.results && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-blue-900 mb-3">Auth Account Status</h4>
                  <div className="space-y-2">
                    {importResults.results.filter((r: any) => r.authStatus === 'created').length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-gray-700">
                          <span className="font-semibold text-green-700">
                            {importResults.results.filter((r: any) => r.authStatus === 'created').length}
                          </span> auth accounts created
                        </span>
                      </div>
                    )}
                    {importResults.results.filter((r: any) => r.authStatus === 'already_exists').length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span className="text-gray-700">
                          <span className="font-semibold text-blue-700">
                            {importResults.results.filter((r: any) => r.authStatus === 'already_exists').length}
                          </span> auth accounts already exist
                        </span>
                      </div>
                    )}
                    {importResults.results.filter((r: any) => r.authStatus === 'failed').length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        <span className="text-gray-700">
                          <span className="font-semibold text-red-700">
                            {importResults.results.filter((r: any) => r.authStatus === 'failed').length}
                          </span> auth creation failed
                        </span>
                      </div>
                    )}
                    <div className="mt-3 pt-3 border-t border-blue-300">
                      <p className="text-xs text-blue-700">
                        📧 New providers can log in with their email and password: <code className="bg-blue-100 px-1 py-0.5 rounded">TempPassword123!</code>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-moonlit-brown"
          >
            {importResults ? 'Done' : 'Cancel'}
          </button>
          {csvData && !importResults && validationResults && successCount > 0 && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-moonlit-brown hover:bg-moonlit-brown/90 disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Import {successCount} {successCount === 1 ? 'Provider' : 'Providers'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
