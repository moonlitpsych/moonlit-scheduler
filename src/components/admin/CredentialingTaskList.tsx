'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Clock, AlertCircle, Ban, Calendar, FileText, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'

interface CredentialingTask {
  id: string
  task_type: string
  title: string
  description: string
  task_status: string
  due_date: string | null
  completed_date: string | null
  task_order: number
  notes: string | null
  assigned_to: string | null
  application_id: string | null
}

interface PayerTaskGroup {
  payer_id: string
  payer_name: string
  payer_type: string
  application_status: string | null
  completion_percentage: number
  total_tasks: number
  completed_tasks: number
  tasks: CredentialingTask[]
  workflow?: {
    portal_url: string | null
    submission_method: string | null
    submission_email: string | null
    contact_type: string | null
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
    form_template_url: string | null
    form_template_filename: string | null
    detailed_instructions: any | null
  }
}

interface CredentialingTaskListProps {
  payerGroups: PayerTaskGroup[]
  onTaskUpdate?: (taskId: string, updates: Partial<CredentialingTask>) => void
  readOnly?: boolean
}

export default function CredentialingTaskList({
  payerGroups,
  onTaskUpdate,
  readOnly = false
}: CredentialingTaskListProps) {
  const [expandedPayers, setExpandedPayers] = useState<Set<string>>(new Set(payerGroups.map(p => p.payer_id)))
  const [editingTask, setEditingTask] = useState<string | null>(null)
  const [taskNotes, setTaskNotes] = useState<Record<string, string>>({})

  const togglePayerExpanded = (payerId: string) => {
    const newExpanded = new Set(expandedPayers)
    if (newExpanded.has(payerId)) {
      newExpanded.delete(payerId)
    } else {
      newExpanded.add(payerId)
    }
    setExpandedPayers(newExpanded)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-600" />
      case 'in_progress':
        return <Clock className="w-5 h-5 text-blue-600" />
      case 'blocked':
        return <Ban className="w-5 h-5 text-red-600" />
      case 'not_applicable':
        return <Circle className="w-5 h-5 text-gray-400" />
      case 'pending':
      default:
        return <Circle className="w-5 h-5 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-200 bg-green-50'
      case 'in_progress':
        return 'border-blue-200 bg-blue-50'
      case 'blocked':
        return 'border-red-200 bg-red-50'
      case 'not_applicable':
        return 'border-gray-200 bg-gray-50'
      case 'pending':
      default:
        return 'border-gray-200 bg-white'
    }
  }

  const getApplicationStatusBadge = (status: string | null) => {
    if (!status) return null

    const badges = {
      not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-700' },
      in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700' },
      submitted: { label: 'Submitted', color: 'bg-purple-100 text-purple-700' },
      under_review: { label: 'Under Review', color: 'bg-yellow-100 text-yellow-700' },
      approved: { label: 'Approved', color: 'bg-green-100 text-green-700' },
      denied: { label: 'Denied', color: 'bg-red-100 text-red-700' },
      on_hold: { label: 'On Hold', color: 'bg-orange-100 text-orange-700' },
      withdrawn: { label: 'Withdrawn', color: 'bg-gray-100 text-gray-700' }
    }

    const badge = badges[status as keyof typeof badges]
    if (!badge) return null

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${badge.color}`}>
        {badge.label}
      </span>
    )
  }

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    if (readOnly || !onTaskUpdate) return

    onTaskUpdate(taskId, { task_status: newStatus } as Partial<CredentialingTask>)
  }

  const handleSaveNotes = async (taskId: string) => {
    if (readOnly || !onTaskUpdate) return

    const notes = taskNotes[taskId] || ''
    onTaskUpdate(taskId, { notes } as Partial<CredentialingTask>)
    setEditingTask(null)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const isOverdue = (dueDate: string | null, status: string) => {
    if (!dueDate || status === 'completed' || status === 'not_applicable') return false
    return new Date(dueDate) < new Date()
  }

  if (payerGroups.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 text-center">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No credentialing tasks found</p>
        <p className="text-sm text-gray-500 mt-2">
          Select payers above to generate credentialing tasks
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Credentialing Tasks</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setExpandedPayers(new Set(payerGroups.map(p => p.payer_id)))}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            Expand All
          </button>
          <span className="text-gray-400">|</span>
          <button
            onClick={() => setExpandedPayers(new Set())}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            Collapse All
          </button>
        </div>
      </div>

      {payerGroups.map((group) => {
        const isExpanded = expandedPayers.has(group.payer_id)

        return (
          <div key={group.payer_id} className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Payer header */}
            <button
              onClick={() => togglePayerExpanded(group.payer_id)}
              className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
            >
              <div className="flex items-center gap-4">
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}

                <div className="text-left">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{group.payer_name}</span>
                    {getApplicationStatusBadge(group.application_status)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">{group.payer_type}</div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Progress bar */}
                <div className="flex items-center gap-3">
                  <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all duration-300"
                      style={{ width: `${group.completion_percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-12 text-right">
                    {group.completion_percentage}%
                  </span>
                </div>

                {/* Task counts */}
                <div className="text-sm text-gray-600">
                  {group.completed_tasks} / {group.total_tasks} tasks
                </div>
              </div>
            </button>

            {/* Task list */}
            {isExpanded && (
              <div className="divide-y divide-gray-200">
                {group.tasks.map((task) => {
                  const overdue = isOverdue(task.due_date, task.task_status)
                  const isEditing = editingTask === task.id

                  return (
                    <div
                      key={task.id}
                      className={`px-6 py-4 ${getStatusColor(task.task_status)} transition-colors`}
                    >
                      <div className="flex items-start gap-4">
                        {/* Status icon */}
                        <div className="flex-shrink-0 mt-1">
                          {getStatusIcon(task.task_status)}
                        </div>

                        {/* Task content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">
                                {task.task_order}. {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                              )}

                              {/* Dates */}
                              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                {task.due_date && (
                                  <div className={`flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                                    <Calendar className="w-4 h-4" />
                                    Due: {formatDate(task.due_date)}
                                    {overdue && <span className="ml-1">(Overdue)</span>}
                                  </div>
                                )}
                                {task.completed_date && (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Completed: {formatDate(task.completed_date)}
                                  </div>
                                )}
                              </div>

                              {/* Notes */}
                              {(task.notes || isEditing) && (
                                <div className="mt-3 p-3 bg-white rounded border border-gray-200">
                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <textarea
                                        value={taskNotes[task.id] ?? task.notes ?? ''}
                                        onChange={(e) => setTaskNotes({ ...taskNotes, [task.id]: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        rows={3}
                                        placeholder="Add notes..."
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleSaveNotes(task.id)}
                                          className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingTask(null)
                                            setTaskNotes({ ...taskNotes, [task.id]: task.notes || '' })
                                          }}
                                          className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start gap-2">
                                      <FileText className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                      <p className="text-sm text-gray-700 flex-1">{task.notes}</p>
                                      {!readOnly && (
                                        <button
                                          onClick={() => setEditingTask(task.id)}
                                          className="text-xs text-indigo-600 hover:text-indigo-700"
                                        >
                                          Edit
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Add notes button */}
                              {!task.notes && !isEditing && !readOnly && (
                                <button
                                  onClick={() => setEditingTask(task.id)}
                                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                >
                                  <FileText className="w-4 h-4" />
                                  Add notes
                                </button>
                              )}
                            </div>

                            {/* Status dropdown */}
                            {!readOnly && (
                              <select
                                value={task.task_status}
                                onChange={(e) => handleStatusChange(task.id, e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="blocked">Blocked</option>
                                <option value="not_applicable">Not Applicable</option>
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
