'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = generateId()
    const newToast = { ...toast, id, duration: toast.duration || 5000 }
    
    setToasts(prev => [...prev, newToast])

    // Auto-remove after duration
    if (newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, newToast.duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((title: string, message?: string) => {
    showToast({ type: 'success', title, message })
  }, [showToast])

  const error = useCallback((title: string, message?: string) => {
    showToast({ type: 'error', title, message })
  }, [showToast])

  const warning = useCallback((title: string, message?: string) => {
    showToast({ type: 'warning', title, message })
  }, [showToast])

  const info = useCallback((title: string, message?: string) => {
    showToast({ type: 'info', title, message })
  }, [showToast])

  return (
    <ToastContext.Provider value={{
      toasts,
      showToast,
      removeToast,
      success,
      error,
      warning,
      info
    }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

const ToastContainer = ({ toasts, removeToast }: { toasts: Toast[], removeToast: (id: string) => void }) => {
  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

const ToastItem = ({ toast, onRemove }: { toast: Toast, onRemove: () => void }) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10)
  }, [])

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(onRemove, 300) // Match animation duration
  }

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'error': return <XCircle className="h-5 w-5 text-red-600" />
      case 'warning': return <AlertCircle className="h-5 w-5 text-orange-600" />
      case 'info': return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const getStyles = () => {
    const baseStyles = "border-l-4"
    switch (toast.type) {
      case 'success': return `${baseStyles} border-green-500 bg-green-50`
      case 'error': return `${baseStyles} border-red-500 bg-red-50`
      case 'warning': return `${baseStyles} border-orange-500 bg-orange-50`
      case 'info': return `${baseStyles} border-blue-500 bg-blue-50`
    }
  }

  return (
    <div
      className={`
        ${getStyles()}
        p-4 rounded-lg shadow-lg max-w-sm w-full transition-all duration-300 ease-out
        ${isVisible && !isExiting ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isExiting ? 'scale-95' : 'scale-100'}
      `}
    >
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <p className="text-sm font-medium text-[#091747] font-['Newsreader']">
            {toast.title}
          </p>
          {toast.message && (
            <p className="mt-1 text-sm text-[#091747]/70 font-['Newsreader']">
              {toast.message}
            </p>
          )}
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            className="rounded-md text-[#091747]/40 hover:text-[#091747]/60 focus:outline-none transition-colors"
            onClick={handleClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}