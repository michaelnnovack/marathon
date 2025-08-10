"use client"
import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { SimpleActivity } from '@/store/activities'

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false })

interface ActivityCardProps {
  activity: SimpleActivity
  index?: number
}

export default function ActivityCard({ activity, index }: ActivityCardProps) {
  const [showMap, setShowMap] = useState(false)

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown date'
    return new Date(dateStr).toLocaleDateString()
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  const formatDistance = (meters: number) => {
    return `${(meters / 1000).toFixed(1)} km`
  }

  const formatPace = (distance: number, duration: number) => {
    if (distance === 0 || duration === 0) return 'N/A'
    const pacePerKm = duration / (distance / 1000) // seconds per km
    const minutes = Math.floor(pacePerKm / 60)
    const seconds = Math.floor(pacePerKm % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
  }

  return (
    <div className="rounded-lg p-4 border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/30">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-medium">
            {activity.date ? formatDate(activity.date) : `Activity ${(index || 0) + 1}`}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatDistance(activity.distance)} • {formatDuration(activity.duration)}
          </p>
        </div>
        {activity.trackPoints && activity.trackPoints.length > 0 && (
          <button
            onClick={() => setShowMap(!showMap)}
            className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
          >
            {showMap ? 'Hide Map' : 'Show Route'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Pace:</span>
          <span className="ml-2 font-mono">{formatPace(activity.distance, activity.duration)}</span>
        </div>
        {activity.avgHr && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Avg HR:</span>
            <span className="ml-2">{activity.avgHr} bpm</span>
          </div>
        )}
        {activity.elevationGain && activity.elevationGain > 0 && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">Elevation:</span>
            <span className="ml-2">+{activity.elevationGain}m</span>
          </div>
        )}
        {activity.trackPoints && (
          <div>
            <span className="text-gray-600 dark:text-gray-400">GPS Points:</span>
            <span className="ml-2">{activity.trackPoints.length}</span>
          </div>
        )}
      </div>

      {showMap && activity.trackPoints && (
        <div className="mt-4">
          <RouteMap trackPoints={activity.trackPoints} height="200px" />
        </div>
      )}
    </div>
  )
}