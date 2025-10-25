'use client'

import { useState, useEffect } from 'react'
import PayerEditorModalEnhanced from '@/components/admin/PayerEditorModalEnhanced'
import { AlertTriangle, Info, CheckCircle, FileText, Search } from 'lucide-react'

interface Payer {
  id: string
  name: string
  payer_type: string
  state: string
  status_code: string | null
  effective_date: string | null
  requires_attending: boolean
  allows_supervised: boolean
  supervision_level: string | null
  requires_individual_contract: boolean
}

export default function TestPayerContractPage() {
  const [showModal, setShowModal] = useState(false)
  const [testMode, setTestMode] = useState<'new' | 'existing'>('existing')
  const [payers, setPayers] = useState<Payer[]>([])
  const [selectedPayer, setSelectedPayer] = useState<Payer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loadingPayers, setLoadingPayers] = useState(false)

  // Fetch payers list
  useEffect(() => {
    const fetchPayers = async () => {
      try {
        setLoadingPayers(true)
        const response = await fetch('/api/admin/payers', {
          credentials: 'include'
        })
        const result = await response.json()

        if (response.ok && result.success) {
          setPayers(result.data || [])
        } else {
          console.error('Failed to fetch payers:', result.error)
        }
      } catch (error) {
        console.error('❌ Error fetching payers:', error)
      } finally {
        setLoadingPayers(false)
      }
    }

    fetchPayers()
  }, [])

  // Filter payers by search term
  const filteredPayers = payers.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.id.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // New payer for testing
  const newPayer = {
    name: '',
    payer_type: '',
    state: '',
    status_code: null,
    effective_date: null,
    requires_attending: false,
    allows_supervised: false,
    supervision_level: null,
    requires_individual_contract: false
  }

  const handleUpdate = () => {
    console.log('✅ Payer contract updated successfully!')
    // In production, this would refresh the payer list
    setShowModal(false)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Test Payer Contract Management
        </h1>
        <p className="text-[#091747]/70">
          Test the new comprehensive payer contract automation system
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-2">What this system does:</p>
            <ul className="space-y-1 ml-4">
              <li>• Automates payer contract setup with effective dates</li>
              <li>• Manages provider-payer network relationships</li>
              <li>• Configures supervision relationships for residents</li>
              <li>• Sets up PracticeQ EMR mappings (optional)</li>
              <li>• Runs comprehensive sanity checks</li>
              <li>• Provides full audit trail</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Test Mode Selection */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#091747] mb-4">Select Test Mode</h2>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTestMode('existing')}
            className={`p-4 rounded-lg border-2 transition-all ${
              testMode === 'existing'
                ? 'border-[#BF9C73] bg-[#BF9C73]/5'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-left">
              <div className="font-medium text-[#091747] mb-1">Update Existing Payer</div>
              <div className="text-sm text-gray-600">
                Test updating an existing payer with new contract terms
              </div>
            </div>
          </button>
          <button
            onClick={() => setTestMode('new')}
            className={`p-4 rounded-lg border-2 transition-all ${
              testMode === 'new'
                ? 'border-[#BF9C73] bg-[#BF9C73]/5'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="text-left">
              <div className="font-medium text-[#091747] mb-1">Create New Payer</div>
              <div className="text-sm text-gray-600">
                Test creating a new payer with full contract setup
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Test Workflow Steps */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-[#091747] mb-4">Test Workflow Steps</h2>
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73]/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-[#BF9C73]">1</span>
            </div>
            <div>
              <div className="font-medium text-[#091747]">Configure Payer Settings</div>
              <div className="text-sm text-gray-600">
                Set status to "approved", add effective date, enable "Allows Supervised Care"
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73]/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-[#BF9C73]">2</span>
            </div>
            <div>
              <div className="font-medium text-[#091747]">Add Provider Contracts</div>
              <div className="text-sm text-gray-600">
                Select providers who have direct contracts with this payer
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73]/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-[#BF9C73]">3</span>
            </div>
            <div>
              <div className="font-medium text-[#091747]">Setup Supervision</div>
              <div className="text-sm text-gray-600">
                Select residents and assign them to attending providers for supervision
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73]/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-[#BF9C73]">4</span>
            </div>
            <div>
              <div className="font-medium text-[#091747]">Configure PracticeQ (Optional)</div>
              <div className="text-sm text-gray-600">
                Add PracticeQ insurance name and payer code for EMR sync
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73]/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-[#BF9C73]">5</span>
            </div>
            <div>
              <div className="font-medium text-[#091747]">Run Validation</div>
              <div className="text-sm text-gray-600">
                Check for issues and review warnings before applying
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-[#BF9C73]/20 rounded-full flex items-center justify-center">
              <span className="text-sm font-bold text-[#BF9C73]">6</span>
            </div>
            <div>
              <div className="font-medium text-[#091747]">Apply Contract</div>
              <div className="text-sm text-gray-600">
                Add audit note and apply all changes in one transaction
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Box */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="text-sm text-yellow-800">
            <p className="font-medium">Test Environment Notes:</p>
            <ul className="mt-1 space-y-0.5">
              <li>• Run the database migration first: <code className="bg-yellow-100 px-1 rounded">021-update-supervision-relationships-for-payers.sql</code></li>
              <li>• Some API endpoints may need minor fixes for your specific database</li>
              <li>• The validation API endpoint needs to be created (copy from apply-contract logic)</li>
              <li>• Test with a non-critical payer first</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Payer Selection (for existing payer mode) */}
      {testMode === 'existing' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#091747] mb-4">Select Payer</h2>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
              />
            </div>
          </div>

          {/* Payer List */}
          {loadingPayers ? (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#BF9C73]"></div>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredPayers.map(payer => (
                <button
                  key={payer.id}
                  onClick={() => setSelectedPayer(payer)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                    selectedPayer?.id === payer.id
                      ? 'border-[#BF9C73] bg-[#BF9C73]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-[#091747]">{payer.name}</div>
                  <div className="text-sm text-gray-600">
                    {payer.payer_type} • {payer.state} • Status: {payer.status_code || 'Not set'}
                  </div>
                </button>
              ))}
              {filteredPayers.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm ? 'No payers match your search' : 'No payers found'}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Launch Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowModal(true)}
          disabled={testMode === 'existing' && !selectedPayer}
          className="px-8 py-4 bg-[#BF9C73] hover:bg-[#BF9C73]/90 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-3"
        >
          <FileText className="h-5 w-5" />
          <span className="text-lg font-medium">
            {testMode === 'new' ? 'Launch New Payer Editor' :
             selectedPayer ? `Edit ${selectedPayer.name}` : 'Select a payer first'}
          </span>
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <PayerEditorModalEnhanced
          payer={testMode === 'new' ? newPayer : selectedPayer!}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Success Message (shown after update) */}
      {false && (
        <div className="fixed bottom-4 right-4 bg-green-50 border border-green-200 rounded-lg p-4 shadow-lg">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Contract Applied Successfully!</p>
              <p className="text-sm text-green-700">All changes have been saved.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}