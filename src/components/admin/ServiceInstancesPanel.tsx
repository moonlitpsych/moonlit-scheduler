'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'

export interface ServiceInstance {
  id?: string
  service_id: string
  service_name?: string
  duration_minutes?: number
  location: string
  pos_code: string
  active: boolean
  isNew?: boolean
}

interface ServiceInstancesPanelProps {
  payerId: string
  onInstancesChange: (instances: ServiceInstance[]) => void
  existingInstances?: ServiceInstance[]
}

interface Service {
  id: string
  name: string
  duration_minutes: number
  description: string | null
}

const LOCATIONS = [
  { value: 'Telehealth', label: 'Telehealth' },
  { value: 'Office', label: 'Office Visit' },
  { value: 'Home', label: 'Home Visit' }
]

const POS_CODES = [
  { value: '02', label: '02 - Telehealth' },
  { value: '10', label: '10 - Telehealth (alternative)' },
  { value: '11', label: '11 - Office' },
  { value: '12', label: '12 - Home' }
]

export default function ServiceInstancesPanel({
  payerId,
  onInstancesChange,
  existingInstances = []
}: ServiceInstancesPanelProps) {
  const [instances, setInstances] = useState<ServiceInstance[]>(existingInstances)
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)

  // Load services and existing instances
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        // Fetch available services
        const servicesResponse = await fetch('/api/admin/services', {
          credentials: 'include'
        })
        const servicesResult = await servicesResponse.json()
        if (servicesResult.success) {
          const fetchedServices = servicesResult.data || []
          setServices(fetchedServices)

          // Fetch existing service instances for this payer
          if (payerId && payerId !== 'new') {
            const instancesResponse = await fetch(`/api/admin/payers/${payerId}/service-instances`, {
              credentials: 'include'
            })
            const instancesResult = await instancesResponse.json()
            if (instancesResult.success) {
              const loadedInstances = (instancesResult.data || []).map((inst: any) => ({
                id: inst.id,
                service_id: inst.service_id,
                service_name: inst.services?.name,
                duration_minutes: inst.services?.duration_minutes,
                location: inst.location,
                pos_code: inst.pos_code,
                active: inst.active ?? true
              }))

              // If no existing instances, auto-populate recommendations
              if (loadedInstances.length === 0 && fetchedServices.length > 0) {
                console.log('📦 No existing service instances, creating recommendations...')
                const recommendations: ServiceInstance[] = fetchedServices.map((service: Service) => ({
                  service_id: service.id,
                  service_name: service.name,
                  duration_minutes: service.duration_minutes,
                  location: 'Telehealth',
                  pos_code: '02',
                  active: true,
                  isNew: true
                }))
                setInstances(recommendations)
              } else {
                setInstances(loadedInstances)
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ Error loading service instances data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [payerId])

  // Notify parent of changes
  useEffect(() => {
    onInstancesChange(instances)
  }, [instances, onInstancesChange])

  const addInstance = () => {
    const newInstance: ServiceInstance = {
      service_id: '',
      location: 'Telehealth',
      pos_code: '02',
      active: true,
      isNew: true
    }
    setInstances(prev => [...prev, newInstance])
  }

  const updateInstance = (index: number, field: keyof ServiceInstance, value: any) => {
    setInstances(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }

      // Update service name and duration when service_id changes
      if (field === 'service_id') {
        const service = services.find(s => s.id === value)
        if (service) {
          updated[index].service_name = service.name
          updated[index].duration_minutes = service.duration_minutes
        }
      }

      return updated
    })
  }

  const removeInstance = (index: number) => {
    setInstances(prev => prev.filter((_, i) => i !== index))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#BF9C73] mr-3"></div>
        <span className="text-[#091747]/60">Loading service instances...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#091747] mb-2">Service Instances</h3>
          <p className="text-sm text-[#091747]/60 mb-4">
            Define which services are available for this payer. Service instances link services (like "Intake" or "Follow-up")
            to specific delivery methods (location + place of service code).
          </p>
        </div>
        <button
          onClick={addInstance}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>Add Service Instance</span>
        </button>
      </div>

      {/* Recommendation notice if all instances are new */}
      {instances.length > 0 && instances.every(i => i.isNew) && (
        <div className="flex items-start space-x-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Recommended Service Instances</h4>
            <p className="text-sm text-blue-800">
              We've pre-populated service instances for all available services with Telehealth (POS 02) as the default.
              Review these recommendations below and remove any you don't want, or click "Apply Contract" to approve all.
            </p>
          </div>
        </div>
      )}

      {/* Warning if no instances */}
      {instances.length === 0 && (
        <div className="flex items-start space-x-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-900 mb-1">No Service Instances Defined</h4>
            <p className="text-sm text-yellow-800">
              Without service instances, this payer will fall back to global defaults (if available).
              Add at least one service instance to ensure bookings work correctly for this payer.
            </p>
          </div>
        </div>
      )}

      {/* Service Instances List */}
      <div className="space-y-3">
        {instances.map((instance, index) => (
          <div
            key={instance.id || index}
            className={`p-4 border rounded-lg ${
              instance.isNew && instance.service_name ? 'border-blue-300 bg-blue-50' :
              instance.isNew ? 'border-green-300 bg-green-50' :
              'border-gray-300'
            }`}
          >
            <div className="mb-3">
              <div className="flex items-center justify-between">
                {instance.isNew && instance.service_name && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Recommended
                  </span>
                )}
                {instance.isNew && !instance.service_name && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    New
                  </span>
                )}
                <button
                  onClick={() => removeInstance(index)}
                  className="ml-auto text-red-600 hover:text-red-800 p-1"
                  title="Remove service instance"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {/* Show service name and description in card header */}
              {instance.service_id && (
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <div className="font-medium text-[#091747] text-sm">
                    {services.find(s => s.id === instance.service_id)?.name}
                    <span className="text-[#091747]/60"> ({instance.duration_minutes}m)</span>
                  </div>
                  <div className="text-xs text-[#091747]/60 italic mt-0.5">
                    {services.find(s => s.id === instance.service_id)?.description}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Service Selection */}
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-1">
                  Service *
                  {instance.isNew && instance.service_name && (
                    <span className="ml-2 text-xs font-normal text-blue-600">(Recommended)</span>
                  )}
                </label>
                <select
                  value={instance.service_id}
                  onChange={(e) => updateInstance(index, 'service_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                  required
                >
                  <option value="">Select service...</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.duration_minutes}m)
                    </option>
                  ))}
                </select>
                {/* Show description under dropdown */}
                {instance.service_id && (
                  <p className="mt-1 text-xs text-[#091747]/60 italic">
                    {services.find(s => s.id === instance.service_id)?.description}
                  </p>
                )}
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-1">
                  Location *
                </label>
                <select
                  value={instance.location}
                  onChange={(e) => updateInstance(index, 'location', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                  required
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc.value} value={loc.value}>
                      {loc.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* POS Code */}
              <div>
                <label className="block text-sm font-medium text-[#091747] mb-1">
                  Place of Service Code *
                </label>
                <select
                  value={instance.pos_code}
                  onChange={(e) => updateInstance(index, 'pos_code', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#BF9C73]/20 focus:border-[#BF9C73]"
                  required
                >
                  {POS_CODES.map(code => (
                    <option key={code.value} value={code.value}>
                      {code.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active Status */}
              <div className="flex items-center space-x-3 pt-6">
                <input
                  id={`active-${index}`}
                  type="checkbox"
                  checked={instance.active}
                  onChange={(e) => updateInstance(index, 'active', e.target.checked)}
                  className="w-4 h-4 text-[#BF9C73] border-gray-300 rounded focus:ring-[#BF9C73]/20"
                />
                <label htmlFor={`active-${index}`} className="text-sm font-medium text-[#091747]">
                  Active
                </label>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">About Service Instances</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>Service</strong>: The type of appointment (e.g., "Intake", "Follow-up")</li>
          <li>• <strong>Location</strong>: How the service is delivered (Telehealth, Office, Home)</li>
          <li>• <strong>POS Code</strong>: CMS place of service code for billing</li>
          <li>• <strong>Active</strong>: Only active instances are available for booking</li>
        </ul>
      </div>
    </div>
  )
}
