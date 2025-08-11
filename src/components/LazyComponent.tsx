'use client'

import { Suspense, lazy, ComponentType, ReactNode, useState, useEffect, useRef } from 'react'
import { ErrorBoundaryWrapper } from './ErrorBoundary'
import { LoadingCard } from './LoadingSpinner'

interface LazyComponentProps {
  fallback?: ReactNode
  componentName: string
  error?: string
}

export function createLazyComponent<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyComponentProps
) {
  const LazyLoadedComponent = lazy(importFn)

  return function LazyWrapper(props: P) {
    return (
      <ErrorBoundaryWrapper 
        componentName={options.componentName}
        fallback={options.error ? (
          <div className="p-4 text-red-600 text-sm">
            {options.error}
          </div>
        ) : undefined}
      >
        <Suspense fallback={options.fallback || <LoadingCard />}>
          <LazyLoadedComponent {...props} />
        </Suspense>
      </ErrorBoundaryWrapper>
    )
  }
}

// Pre-configured lazy components for common use cases
export const LazyActivityCard = createLazyComponent(
  () => import('@/components/ActivityCard'),
  {
    componentName: 'ActivityCard',
    fallback: <LoadingCard />,
  }
)

export const LazyRouteMap = createLazyComponent(
  () => import('@/components/RouteMap'),
  {
    componentName: 'RouteMap',
    fallback: (
      <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading map...</div>
      </div>
    ),
  }
)

// Note: LazyChart is already optimized and doesn't need to be wrapped again

// For components that should only load when visible (intersection observer)
interface LazyOnScrollProps extends LazyComponentProps {
  rootMargin?: string
  threshold?: number
}

export function createLazyOnScroll<P extends object>(
  importFn: () => Promise<{ default: ComponentType<P> }>,
  options: LazyOnScrollProps
) {
  const LazyLoadedComponent = lazy(importFn)

  return function LazyScrollWrapper(props: P) {
    const [isVisible, setIsVisible] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        },
        {
          rootMargin: options.rootMargin || '50px',
          threshold: options.threshold || 0.1
        }
      )

      if (ref.current) {
        observer.observe(ref.current)
      }

      return () => observer.disconnect()
    }, [])

    if (!isVisible) {
      return (
        <div ref={ref} className="min-h-[200px] flex items-center justify-center">
          {options.fallback || <LoadingCard />}
        </div>
      )
    }

    return (
      <ErrorBoundaryWrapper 
        componentName={options.componentName}
        fallback={options.error ? (
          <div className="p-4 text-red-600 text-sm">
            {options.error}
          </div>
        ) : undefined}
      >
        <Suspense fallback={options.fallback || <LoadingCard />}>
          <LazyLoadedComponent {...props} />
        </Suspense>
      </ErrorBoundaryWrapper>
    )
  }
}

// Heavy components that should only load when scrolled into view
export const LazyVisualizationChart = createLazyOnScroll(
  () => import('@/components/D3TrainingProgress'),
  {
    componentName: 'D3TrainingProgress',
    rootMargin: '100px',
    fallback: (
      <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading visualization...</div>
      </div>
    ),
  }
)

export const LazyHeartRateZones = createLazyOnScroll(
  () => import('@/components/HeartRateZones'),
  {
    componentName: 'HeartRateZones',
    rootMargin: '100px',
    fallback: (
      <div className="w-full h-96 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading heart rate analysis...</div>
      </div>
    ),
  }
)