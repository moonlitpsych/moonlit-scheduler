/**
 * Error Boundary Component for Partner Dashboard
 * Catches runtime errors and displays a user-friendly error message
 * instead of crashing the entire application
 */

'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console for debugging
    console.error('Partner Dashboard Error:', error, errorInfo)

    // Update state with error details
    this.setState({
      error,
      errorInfo
    })

    // In production, you could send this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to error reporting service
      // logErrorToService(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }

      // Default error UI
      return (
        <div className="min-h-[400px] flex items-center justify-center bg-moonlit-cream p-8">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg border border-red-200 p-8">
            <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            <h2 className="text-2xl font-bold text-moonlit-navy text-center mb-4 font-['Newsreader']">
              Something went wrong
            </h2>

            <p className="text-gray-600 text-center mb-6 font-['Newsreader'] font-light">
              We encountered an error while loading this page. Please try refreshing or return to the dashboard.
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-sm">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700 mb-2">
                  Error details (development only)
                </summary>
                <div className="bg-gray-50 p-4 rounded border border-gray-200 overflow-auto max-h-40">
                  <p className="font-mono text-xs text-red-600 mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="font-mono text-xs text-gray-600 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-moonlit-brown hover:bg-moonlit-brown/90 text-white rounded-lg font-medium font-['Newsreader'] transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Page
              </button>

              <button
                onClick={() => window.location.href = '/partner-dashboard'}
                className="flex-1 px-4 py-2 border border-gray-300 hover:border-moonlit-brown text-gray-700 hover:text-moonlit-brown rounded-lg font-medium font-['Newsreader'] transition-colors flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go to Dashboard
              </button>
            </div>

            {/* Contact support option */}
            <p className="text-center text-sm text-gray-500 mt-6 font-['Newsreader']">
              If this problem persists, please contact{' '}
              <a
                href="mailto:hello@trymoonlit.com?subject=Partner Dashboard Error"
                className="text-moonlit-brown hover:underline"
              >
                hello@trymoonlit.com
              </a>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary