'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { ComponentError } from '@/types'
import { Button } from './ui/Button'
import { Card, CardContent, CardHeader } from './ui/Card'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: ComponentError) => void
  componentName?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: ComponentError | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error: {
        message: error.message,
        stack: error.stack,
        componentName: 'Unknown',
        timestamp: Date.now()
      }
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const componentError: ComponentError = {
      message: error.message,
      stack: error.stack,
      componentName: this.props.componentName || 'Unknown',
      timestamp: Date.now()
    }

    this.setState({ error: componentError })

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo)
    }

    // Call optional error handler
    this.props.onError?.(componentError)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card variant="outlined" className="border-red-200 dark:border-red-800">
          <CardHeader 
            icon={<ExclamationTriangleIcon className="w-5 h-5 text-red-500" />}
            className="text-red-700 dark:text-red-300"
          >
            Something went wrong
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={this.handleRetry}
              >
                Try Again
              </Button>
              {process.env.NODE_ENV === 'development' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => console.error('Full error:', this.state.error)}
                >
                  Log Details
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// Functional wrapper for easier usage
interface ErrorBoundaryWrapperProps {
  children: ReactNode
  componentName: string
  fallback?: ReactNode
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary componentName={componentName}>
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

export function ErrorBoundaryWrapper({ 
  children, 
  componentName, 
  fallback 
}: ErrorBoundaryWrapperProps) {
  return (
    <ErrorBoundary 
      componentName={componentName} 
      fallback={fallback}
    >
      {children}
    </ErrorBoundary>
  )
}