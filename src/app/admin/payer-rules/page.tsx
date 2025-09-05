'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Shield,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { PayerRule, SupervisionLevel } from '@/types/admin-operations'

interface PayerOption {
  id: string
  name: string
  state: string
  payer_type: string
}

interface PayerRuleWithPayer extends PayerRule {
  payer_name: string
  payer_state: string
  contracts_count: number
}

const SUPERVISION_LEVELS: Array<{ value: SupervisionLevel; label: string; description: string }> = [
  {
    value: 'sign_off_only',
    label: 'Sign-off Only',
    description: 'Attending physician reviews and signs off on resident care'
  },
  {
    value: 'first_visit_in_person',
    label: 'First Visit In-Person',
    description: 'Attending must be present for first patient visit'
  },
  {
    value: 'co_visit_required',
    label: 'Co-visit Required',
    description: 'Attending must be present for all patient visits'
  }
]

const BILL_AS_OPTIONS = [
  { value: 'attending', label: 'Attending Only', description: 'Only attending physician can bill' },
  { value: 'resident', label: 'Resident Only', description: 'Only resident can bill' },
  { value: 'either', label: 'Either', description: 'Either attending or resident can bill' }
] as const

export default function PayerRulesPage() {
  const [payerRules, setPayerRules] = useState<PayerRuleWithPayer[]>([])
  const [payerOptions, setPayerOptions] = useState<PayerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingRule, setEditingRule] = useState<PayerRuleWithPayer | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    payer_id: '',
    product_code: '',
    requires_supervision: false,
    allowed_supervision_levels: [] as SupervisionLevel[],
    bill_as_type: 'attending' as 'attending' | 'resident' | 'either',
    notes: '',
    effective_date: new Date().toISOString().split('T')[0],
    expiration_date: ''
  })

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [rulesResponse, payersResponse] = await Promise.all([
          fetch('/api/admin/payer-rules'),
          fetch('/api/admin/payers-list')
        ])

        if (rulesResponse.ok) {
          const rulesResult = await rulesResponse.json()
          setPayerRules(rulesResult.data || [])
        }

        if (payersResponse.ok) {
          const payersResult = await payersResponse.json()
          setPayerOptions(payersResult.data || [])
        }
      } catch (error) {
        console.error('Error fetching payer rules data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingRule 
        ? `/api/admin/payer-rules/${editingRule.id}`
        : '/api/admin/payer-rules'
      
      const method = editingRule ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        // Refresh data
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Error: ${error.message || 'Failed to save rule'}`)
      }
    } catch (error) {
      console.error('Error saving payer rule:', error)
      alert('Error saving payer rule')
    }
  }

  const handleEdit = (rule: PayerRuleWithPayer) => {
    setEditingRule(rule)
    setFormData({
      payer_id: rule.payer_id,
      product_code: rule.product_code || '',
      requires_supervision: rule.requires_supervision,
      allowed_supervision_levels: rule.allowed_supervision_levels,
      bill_as_type: rule.bill_as_type,
      notes: rule.notes || '',
      effective_date: rule.effective_date,
      expiration_date: rule.expiration_date || ''
    })
    setShowCreateModal(true)
  }

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this payer rule?')) return

    try {
      const response = await fetch(`/api/admin/payer-rules/${ruleId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        window.location.reload()
      } else {
        alert('Error deleting rule')
      }
    } catch (error) {
      console.error('Error deleting payer rule:', error)
      alert('Error deleting rule')
    }
  }

  const resetForm = () => {
    setFormData({
      payer_id: '',
      product_code: '',
      requires_supervision: false,
      allowed_supervision_levels: [],
      bill_as_type: 'attending',
      notes: '',
      effective_date: new Date().toISOString().split('T')[0],
      expiration_date: ''
    })
    setEditingRule(null)
    setShowCreateModal(false)
  }

  const filteredRules = payerRules.filter(rule =>
    rule.payer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rule.product_code && rule.product_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (rule.notes && rule.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#091747] font-['Newsreader'] mb-2">
          Payer Rules Editor
        </h1>
        <p className="text-[#091747]/70">
          Configure supervision requirements, billing rules, and allowed levels per payer
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Settings className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Rules</p>
              <p className="text-2xl font-bold text-[#091747]">{payerRules.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Shield className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Requires Supervision</p>
              <p className="text-2xl font-bold text-[#091747]">
                {payerRules.filter(r => r.requires_supervision).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Attending Bill-As</p>
              <p className="text-2xl font-bold text-[#091747]">
                {payerRules.filter(r => r.bill_as_type === 'attending').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-stone-200">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-[#BF9C73]/20 rounded-lg">
              <Calendar className="h-6 w-6 text-[#BF9C73]" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Rules</p>
              <p className="text-2xl font-bold text-[#091747]">
                {payerRules.filter(r => !r.expiration_date || new Date(r.expiration_date) > new Date()).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search payer rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent w-full"
            />
          </div>

          <button
            onClick={() => {
              resetForm()
              setShowCreateModal(true)
            }}
            className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payer
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supervision Required
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Allowed Levels
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill As
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective Date
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {filteredRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-stone-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-[#091747]">
                        {rule.payer_name}
                      </div>
                      {rule.product_code && (
                        <div className="text-sm text-gray-500">
                          Product: {rule.product_code}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        {rule.contracts_count} contracts
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {rule.requires_supervision ? (
                        <>
                          <Shield className="h-4 w-4 text-orange-500" />
                          <span className="text-sm text-orange-700">Required</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-700">Not Required</span>
                        </>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {rule.allowed_supervision_levels.map(level => {
                        const levelConfig = SUPERVISION_LEVELS.find(l => l.value === level)
                        return (
                          <span key={level} className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                            {levelConfig?.label || level}
                          </span>
                        )
                      })}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      rule.bill_as_type === 'attending' ? 'bg-green-100 text-green-800' :
                      rule.bill_as_type === 'resident' ? 'bg-blue-100 text-blue-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {BILL_AS_OPTIONS.find(o => o.value === rule.bill_as_type)?.label}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div>
                      <div>{new Date(rule.effective_date).toLocaleDateString()}</div>
                      {rule.expiration_date && (
                        <div className="text-xs text-gray-400">
                          Expires: {new Date(rule.expiration_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => handleEdit(rule)}
                        className="text-[#BF9C73] hover:text-[#BF9C73]/80"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="text-red-600 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredRules.length === 0 && (
          <div className="p-12 text-center">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#091747] mb-2">
              No payer rules found
            </h3>
            <p className="text-gray-500 mb-6">
              Create your first payer rule to configure supervision requirements.
            </p>
            <button
              onClick={() => {
                resetForm()
                setShowCreateModal(true)
              }}
              className="bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Add First Rule
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-[#091747]">
                {editingRule ? 'Edit' : 'Create'} Payer Rule
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Configure supervision and billing requirements for this payer
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Payer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payer *
                </label>
                <select
                  value={formData.payer_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, payer_id: e.target.value }))}
                  required
                  disabled={!!editingRule}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent disabled:bg-gray-50"
                >
                  <option value="">Select a payer...</option>
                  {payerOptions.map(payer => (
                    <option key={payer.id} value={payer.id}>
                      {payer.name} ({payer.state})
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Code (Optional)
                </label>
                <input
                  type="text"
                  value={formData.product_code}
                  onChange={(e) => setFormData(prev => ({ ...prev, product_code: e.target.value }))}
                  placeholder="Leave blank for all products"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                />
              </div>

              {/* Requires Supervision */}
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="requires_supervision"
                  checked={formData.requires_supervision}
                  onChange={(e) => setFormData(prev => ({ ...prev, requires_supervision: e.target.checked }))}
                  className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-gray-300 rounded"
                />
                <label htmlFor="requires_supervision" className="text-sm font-medium text-gray-700">
                  Requires Supervision
                </label>
              </div>

              {/* Supervision Levels (shown only if supervision required) */}
              {formData.requires_supervision && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Allowed Supervision Levels *
                  </label>
                  <div className="space-y-3">
                    {SUPERVISION_LEVELS.map(level => (
                      <div key={level.value} className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          id={level.value}
                          checked={formData.allowed_supervision_levels.includes(level.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData(prev => ({
                                ...prev,
                                allowed_supervision_levels: [...prev.allowed_supervision_levels, level.value]
                              }))
                            } else {
                              setFormData(prev => ({
                                ...prev,
                                allowed_supervision_levels: prev.allowed_supervision_levels.filter(l => l !== level.value)
                              }))
                            }
                          }}
                          className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-gray-300 rounded mt-0.5"
                        />
                        <div className="flex-1">
                          <label htmlFor={level.value} className="text-sm font-medium text-gray-700">
                            {level.label}
                          </label>
                          <p className="text-xs text-gray-500">{level.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bill As Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Bill As Type *
                </label>
                <div className="space-y-2">
                  {BILL_AS_OPTIONS.map(option => (
                    <div key={option.value} className="flex items-center space-x-3">
                      <input
                        type="radio"
                        id={option.value}
                        value={option.value}
                        checked={formData.bill_as_type === option.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, bill_as_type: e.target.value as any }))}
                        className="h-4 w-4 text-[#BF9C73] focus:ring-[#BF9C73] border-gray-300"
                      />
                      <div className="flex-1">
                        <label htmlFor={option.value} className="text-sm font-medium text-gray-700">
                          {option.label}
                        </label>
                        <p className="text-xs text-gray-500">{option.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expiration Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, expiration_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes about this rule..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-[#BF9C73] focus:border-transparent"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors"
                >
                  {editingRule ? 'Update' : 'Create'} Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}