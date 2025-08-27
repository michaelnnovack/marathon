"use client"
import React, { useState, useMemo } from 'react'
import { useActivities } from '@/store/activities'
import type { SimpleActivity } from '@/types'
import { MapIcon, EyeSlashIcon, TrophyIcon } from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'

const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false })
const ElevationProfile = dynamic(() => import('./ElevationProfile'), { ssr: false })

// Clean, minimal run card for focused UX
function RunCard({ activity, onMapToggle, showMap }: { 
  activity: SimpleActivity
  onMapToggle: () => void
  showMap: boolean
}) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date'
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      weekday: 'short'
    })
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${Math.floor(secs).toString().padStart(2, '0')}`
    }
    return `${minutes}:${Math.floor(secs).toString().padStart(2, '0')}`
  }

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(2)} km`
  }

  const formatPace = (distance: number, duration: number) => {
    if (distance === 0 || duration === 0) return 'N/A'
    const pacePerKm = duration / (distance / 1000) // seconds per km
    const minutes = Math.floor(pacePerKm / 60)
    const seconds = Math.floor(pacePerKm % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const hasGPS = activity.trackPoints && activity.trackPoints.length > 0
  const hasElevation = hasGPS && activity.trackPoints.some(p => p.elevation !== undefined)

  return (
    <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
              {formatDate(activity.date)}
            </h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span>{formatDistance(activity.distance)}</span>
              <span>•</span>
              <span>{formatDuration(activity.duration)}</span>
              <span>•</span>
              <span>{formatPace(activity.distance, activity.duration)}/km</span>
            </div>
          </div>
          
          {hasGPS && (
            <button
              onClick={onMapToggle}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              {showMap ? (
                <>
                  <EyeSlashIcon className="w-4 h-4" />
                  Hide Route
                </>
              ) : (
                <>
                  <MapIcon className="w-4 h-4" />
                  View Route
                </>
              )}
            </button>
          )}
        </div>

        {/* Key metrics bar */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
          {activity.avgHr && (
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{activity.avgHr}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Avg HR</div>
            </div>
          )}
          
          {activity.elevationGain && activity.elevationGain > 0 && (
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">+{activity.elevationGain}m</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Elevation</div>
            </div>
          )}
          
          {hasGPS && (
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">{activity.trackPoints.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">GPS Points</div>
            </div>
          )}
        </div>
      </div>

      {/* Expandable map section */}
      {showMap && hasGPS && (
        <div className="px-6 pb-6">
          <div className="space-y-4">
            <RouteMap trackPoints={activity.trackPoints} height="300px" />
            {hasElevation && (
              <ElevationProfile trackPoints={activity.trackPoints} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function RunsPage() {
  const { list: activities, isLoading, error, hydrate } = useActivities()
  const [expandedActivity, setExpandedActivity] = useState<string | null>(null)

  // Filter to only running activities and sort by date (newest first)
  const runningActivities = useMemo(() => {
    return activities
      .filter(activity => activity.distance > 0) // Only activities with distance
      .sort((a, b) => {
        if (!a.date) return 1
        if (!b.date) return -1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })
  }, [activities])

  // Hydrate activities on mount
  React.useEffect(() => {
    if (!activities.length && !isLoading) {
      hydrate()
    }
  }, [activities.length, isLoading, hydrate])

  const toggleMap = (activityId: string) => {
    setExpandedActivity(expandedActivity === activityId ? null : activityId)
  }

  if (isLoading && !activities.length) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your runs...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="text-red-600 dark:text-red-400 mb-4">
            <TrophyIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Unable to load runs</p>
            <p className="text-sm opacity-75 mt-1">{error}</p>
          </div>
          <button 
            onClick={() => hydrate()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!runningActivities.length) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <TrophyIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No runs found</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your running activities will appear here once they sync from intervals.icu
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Your Runs</h1>
        <p className="text-gray-600 dark:text-gray-400">
          {runningActivities.length} runs • Click any run to view its GPS route
        </p>
      </div>

      {/* Runs list */}
      <div className="space-y-4">
        {runningActivities.map((activity, index) => (
          <RunCard
            key={activity.id || `activity-${index}`}
            activity={activity}
            onMapToggle={() => toggleMap(activity.id || `activity-${index}`)}
            showMap={expandedActivity === (activity.id || `activity-${index}`)}
          />
        ))}
      </div>
    </div>
  )
}