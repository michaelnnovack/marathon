"use client";
import { Suspense, lazy } from 'react'
import { LoadingSkeleton } from './LoadingSpinner'
import type { TrackPoint } from '@/types'

// Lazy load RouteMap component  
const RouteMap = lazy(() => import('./RouteMap'))

interface LazyRouteMapProps {
  trackPoints: TrackPoint[]
  className?: string
}

export function LazyRouteMap(props: LazyRouteMapProps) {
  return (
    <Suspense fallback={
      <div className="h-48 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <LoadingSkeleton lines={4} className="w-3/4" />
      </div>
    }>
      <RouteMap {...props} />
    </Suspense>
  )
}