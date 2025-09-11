// src/components/errors/DataValidationBoundary.tsx
'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Bug } from 'lucide-react'

interface Props {
    children: ReactNode
    fallback?: ReactNode
    context?: string
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
    isDataFormatError: boolean
}

class DataValidationBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
            isDataFormatError: false
        }
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        // Check if this looks like a data format error
        const isDataFormatError = error.message.includes('provider_id') ||
                                  error.message.includes('providerId') ||
                                  error.message.includes('provider_name') ||
                                  error.message.includes('providerName') ||
                                  error.message.includes('isAvailable') ||
                                  error.message.includes('available') ||
                                  error.message.includes('Cannot read property') ||
                                  error.message.includes('undefined is not an object')

        return {
            hasError: true,
            error,
            isDataFormatError
        }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({
            error,
            errorInfo,
        })

        // Log data format errors with extra context
        if (this.state.isDataFormatError) {
            console.error('🚨 DATA FORMAT ERROR DETECTED:', {
                error: error.message,
                stack: error.stack,
                context: this.props.context,
                component: errorInfo.componentStack,
                timestamp: new Date().toISOString(),
                possibleCause: 'API response field names may not match frontend expectations',
                suggestedFix: 'Run /api/debug/validate-api-contracts to check field mappings'
            })
        }
    }

    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
            isDataFormatError: false
        })
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback
            }

            return (
                <div className="min-h-64 bg-red-50 border border-red-200 rounded-2xl p-8 mx-auto max-w-md">
                    <div className="text-center">
                        {this.state.isDataFormatError ? (
                            <div className="mb-4">
                                <Bug className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-red-800 mb-2 font-['Newsreader']">
                                    Data Format Error Detected
                                </h3>
                                <p className="text-sm text-red-700 mb-4 font-['Newsreader']">
                                    {this.props.context ? `${this.props.context}: ` : ''}
                                    The API response format doesn't match what the frontend expects.
                                    This is likely a field naming mismatch.
                                </p>
                                
                                {process.env.NODE_ENV === 'development' && (
                                    <div className="bg-red-100 border border-red-300 rounded-lg p-4 mb-4 text-left">
                                        <h4 className="font-medium text-red-800 mb-2">Debug Information:</h4>
                                        <p className="text-xs text-red-700 font-mono mb-2">
                                            {this.state.error?.message}
                                        </p>
                                        <p className="text-xs text-red-600">
                                            💡 Check: Are API field names (providerId vs provider_id, isAvailable vs available) consistent?
                                        </p>
                                    </div>
                                )}
                                
                                <div className="space-y-2">
                                    <button
                                        onClick={this.handleRetry}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors font-['Newsreader']"
                                    >
                                        <RefreshCw className="w-4 h-4 inline mr-2" />
                                        Try Again
                                    </button>
                                    
                                    {process.env.NODE_ENV === 'development' && (
                                        <button
                                            onClick={() => {
                                                window.open('/api/debug/validate-api-contracts', '_blank')
                                            }}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors font-['Newsreader']"
                                        >
                                            🔍 Validate API Contracts
                                        </button>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-4">
                                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-red-800 mb-2 font-['Newsreader']">
                                    Something went wrong
                                </h3>
                                <p className="text-sm text-red-700 mb-4 font-['Newsreader']">
                                    {this.props.context ? `${this.props.context}: ` : ''}
                                    An unexpected error occurred. Please try again.
                                </p>
                                
                                <button
                                    onClick={this.handleRetry}
                                    className="bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors font-['Newsreader']"
                                >
                                    <RefreshCw className="w-4 h-4 inline mr-2" />
                                    Try Again
                                </button>
                            </div>
                        )}
                        
                        <p className="text-xs text-red-600 font-['Newsreader']">
                            If this error persists, please contact support at hello@trymoonlit.com
                        </p>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export default DataValidationBoundary

// Higher-order component for easy wrapping
export function withDataValidation<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    context?: string
) {
    const WithDataValidationComponent = (props: P) => (
        <DataValidationBoundary context={context}>
            <WrappedComponent {...props} />
        </DataValidationBoundary>
    )

    WithDataValidationComponent.displayName = `withDataValidation(${WrappedComponent.displayName || WrappedComponent.name})`
    
    return WithDataValidationComponent
}