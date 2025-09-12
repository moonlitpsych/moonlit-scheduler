// src/components/ui/Toast.tsx
// Simple toast notification component

'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { Toast as ToastType } from '@/lib/hooks/useToast'

interface ToastProps {
  toast: ToastType
  onRemove: (id: string) => void
}

const iconMap = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: 'bg-green-50 text-green-800 border-green-200',
  error: 'bg-red-50 text-red-800 border-red-200',
  warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  info: 'bg-blue-50 text-blue-800 border-blue-200',
}

const iconColorMap = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
}

export default function Toast({ toast, onRemove }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const Icon = iconMap[toast.type]

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 10)
    
    // Start leaving animation before removal
    const leaveTimer = setTimeout(() => {
      setIsLeaving(true)
    }, (toast.duration || 5000) - 300)
    
    return () => clearTimeout(leaveTimer)
  }, [toast.duration])

  const handleRemove = () => {
    setIsLeaving(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  return (
    <div 
      className={`
        relative flex items-start p-4 mb-3 rounded-lg border shadow-sm transition-all duration-300 ease-out
        ${colorMap[toast.type]}
        ${isVisible && !isLeaving ? 'transform translate-x-0 opacity-100' : 'transform translate-x-full opacity-0'}
        ${isLeaving ? 'transform translate-x-full opacity-0' : ''}
      `}
      style={{
        maxWidth: '400px',
        minWidth: '320px'
      }}
    >
      <Icon className={`w-5 h-5 mt-0.5 mr-3 flex-shrink-0 ${iconColorMap[toast.type]}`} />
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && (
          <p className="mt-1 text-sm opacity-90">{toast.description}</p>
        )}
      </div>
      
      <button
        onClick={handleRemove}
        className="flex-shrink-0 ml-4 p-1 rounded-md hover:bg-black hover:bg-opacity-10 transition-colors"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

interface ToastContainerProps {
  toasts: ToastType[]
  onRemove: (id: string) => void
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div 
      className="fixed top-4 right-4 z-50 space-y-2"
      style={{ maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto' }}
    >
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  )
}