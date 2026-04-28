'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

export interface PayerPlan {
  id?: string
  plan_name: string
  plan_type: string | null
  is_default: boolean
  is_active: boolean
  notes?: string | null
  isNew?: boolean
}

interface PayerPlansPanelProps {
  payerId: string
  onPlansChange: (plans: PayerPlan[]) => void
  existingPlans?: PayerPlan[]
}

const PLAN_TYPES = [
  { value: '', label: '— None —' },
  { value: 'HMO', label: 'HMO' },
  { value: 'PPO', label: 'PPO' },
  { value: 'EPO', label: 'EPO' },
  { value: 'POS', label: 'POS' },
  { value: 'HDHP', label: 'HDHP' },
  { value: 'OTHER', label: 'Other' }
]

export default function PayerPlansPanel({
  payerId,
  onPlansChange,
  existingPlans = []
}: PayerPlansPanelProps) {
  const [plans, setPlans] = useState<PayerPlan[]>(existingPlans)

  useEffect(() => {
    setPlans(existingPlans)
  }, [existingPlans])

  useEffect(() => {
    onPlansChange(plans)
  }, [plans])

  const addPlan = () => {
    setPlans(prev => [
      ...prev,
      {
        plan_name: '',
        plan_type: null,
        is_default: prev.length === 0,
        is_active: true,
        isNew: true
      }
    ])
  }

  const updatePlan = (index: number, field: keyof PayerPlan, value: any) => {
    setPlans(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      // Enforce single default
      if (field === 'is_default' && value === true) {
        next.forEach((p, i) => {
          if (i !== index) p.is_default = false
        })
      }
      return next
    })
  }

  const removePlan = (index: number) => {
    setPlans(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#091747]">Insurance Plans</h3>
          <p className="text-sm text-gray-600">
            Track which specific plans this payer offers (e.g., "Select Choice", "BlueCross PPO").
            Plans are tracked at the practice level and do not affect booking validation today.
          </p>
        </div>
        <button
          onClick={addPlan}
          className="flex items-center px-3 py-2 bg-[#BF9C73] hover:bg-[#BF9C73]/90 text-white rounded-lg transition-colors text-sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Plan
        </button>
      </div>

      <div className="space-y-3">
        {plans.map((plan, index) => (
          <div
            key={plan.id || `new-${index}`}
            className={`p-4 border rounded-lg ${
              plan.isNew ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              {plan.isNew && (
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  New
                </span>
              )}
              <button
                onClick={() => removePlan(index)}
                className="ml-auto text-red-600 hover:text-red-800 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-1">
                  Plan Name *
                </label>
                <input
                  type="text"
                  value={plan.plan_name}
                  onChange={(e) => updatePlan(index, 'plan_name', e.target.value)}
                  placeholder="e.g., Select Choice"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[#091747] mb-1">
                    Plan Type
                  </label>
                  <select
                    value={plan.plan_type || ''}
                    onChange={(e) => updatePlan(index, 'plan_type', e.target.value || null)}
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                  >
                    {PLAN_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-4 pt-6">
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={plan.is_default}
                      onChange={(e) => updatePlan(index, 'is_default', e.target.checked)}
                      className="w-4 h-4 text-[#BF9C73] rounded"
                    />
                    <span>Default</span>
                  </label>
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={plan.is_active}
                      onChange={(e) => updatePlan(index, 'is_active', e.target.checked)}
                      className="w-4 h-4 text-[#BF9C73] rounded"
                    />
                    <span>Active</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#091747] mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={plan.notes || ''}
                  onChange={(e) => updatePlan(index, 'notes', e.target.value || null)}
                  placeholder="e.g., contract appendix p. 12"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                />
              </div>
            </div>
          </div>
        ))}

        {plans.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No plans added yet. Click "Add Plan" to create one.
          </div>
        )}
      </div>
    </div>
  )
}
