'use client'

import { useState } from 'react'
import { Check, Copy, Edit2, ExternalLink, X } from 'lucide-react'

interface GoogleMeetLinkEditorProps {
  appointmentId: string
  currentLink: string | null
  onUpdate?: (newLink: string | null) => void
  compact?: boolean
}

export function GoogleMeetLinkEditor({
  appointmentId,
  currentLink,
  onUpdate,
  compact = false
}: GoogleMeetLinkEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [link, setLink] = useState(currentLink || '')
  const [isSaving, setIsSaving] = useState(false)
  const [showCopied, setShowCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCopy = async () => {
    if (!currentLink) return

    try {
      await navigator.clipboard.writeText(currentLink)
      setShowCopied(true)
      setTimeout(() => setShowCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/appointments/${appointmentId}/update-google-meet`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleMeetLink: link.trim() || null })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save')
      }

      const data = await response.json()

      // Call onUpdate callback if provided
      if (onUpdate) {
        onUpdate(link.trim() || null)
      }

      setIsEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setLink(currentLink || '')
    setIsEditing(false)
    setError(null)
  }

  // Display mode
  if (!isEditing) {
    return (
      <div className={compact ? 'flex items-center gap-2' : 'space-y-2'}>
        <div className="flex items-center gap-2">
          {currentLink ? (
            <>
              <a
                href={currentLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                {compact ? 'Meet Link' : 'PracticeQ Google Meet'}
              </a>
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy link"
              >
                {showCopied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 text-gray-500" />
                )}
              </button>
            </>
          ) : (
            <span className="text-sm text-gray-500">No Google Meet link</span>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title={currentLink ? 'Edit link' : 'Add link'}
          >
            <Edit2 className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>
    )
  }

  // Edit mode
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://meet.google.com/xxx-xxxx-xxx"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={isSaving}
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              Save
            </>
          )}
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <X className="w-4 h-4" />
          Cancel
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <p className="text-xs text-gray-500">
        Enter the Google Meet link from PracticeQ (not accessible via API)
      </p>
    </div>
  )
}
