"use client"
import React, { useMemo } from 'react'
import type { TrackPoint } from '@/types'

interface ElevationProfileProps {
  trackPoints: TrackPoint[]
  className?: string
  height?: number
}

export default function ElevationProfile({ trackPoints, className = '', height = 120 }: ElevationProfileProps) {
  // Calculate elevation profile data
  const profileData = useMemo(() => {
    if (!trackPoints.length) return null

    // Filter points with elevation data
    const pointsWithElevation = trackPoints.filter(point => 
      point.elevation !== undefined && point.elevation !== null
    )

    if (pointsWithElevation.length < 2) return null

    // Calculate cumulative distance for x-axis
    let cumulativeDistance = 0
    const profilePoints = pointsWithElevation.map((point, index) => {
      if (index > 0) {
        const prev = pointsWithElevation[index - 1]
        // Haversine distance calculation
        const R = 6371000 // Earth's radius in meters
        const dLat = (point.lat - prev.lat) * Math.PI / 180
        const dLng = (point.lng - prev.lng) * Math.PI / 180
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(prev.lat * Math.PI / 180) * Math.cos(point.lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
        const distance = R * c
        cumulativeDistance += distance
      }
      
      return {
        distance: cumulativeDistance / 1000, // Convert to km
        elevation: point.elevation!
      }
    })

    // Calculate stats
    const elevations = profilePoints.map(p => p.elevation)
    const minElevation = Math.min(...elevations)
    const maxElevation = Math.max(...elevations)
    const elevationRange = maxElevation - minElevation
    const totalDistance = profilePoints[profilePoints.length - 1]?.distance || 0

    return {
      points: profilePoints,
      minElevation,
      maxElevation,
      elevationRange,
      totalDistance
    }
  }, [trackPoints])

  if (!profileData) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg ${className}`} style={{ height }}>
        <p className="text-sm text-gray-500 dark:text-gray-400">No elevation data available</p>
      </div>
    )
  }

  const { points, minElevation, maxElevation, elevationRange, totalDistance } = profileData

  // Create SVG path
  const svgWidth = 400
  const svgHeight = height - 40 // Leave space for labels
  const padding = 20

  const pathData = points.map((point, index) => {
    const x = padding + (point.distance / totalDistance) * (svgWidth - 2 * padding)
    const y = svgHeight - padding - ((point.elevation - minElevation) / (elevationRange || 1)) * (svgHeight - 2 * padding)
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  // Create fill area path
  const fillPath = pathData + 
    ` L ${padding + (svgWidth - 2 * padding)} ${svgHeight - padding}` +
    ` L ${padding} ${svgHeight - padding} Z`

  return (
    <div className={`bg-gray-50 dark:bg-gray-900 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">Elevation Profile</h4>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {minElevation.toFixed(0)}m - {maxElevation.toFixed(0)}m
        </div>
      </div>
      
      <div className="relative">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="overflow-visible"
        >
          {/* Grid lines */}
          <defs>
            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          
          {/* Elevation area fill */}
          <path
            d={fillPath}
            fill="currentColor"
            className="text-blue-200 dark:text-blue-800"
            opacity="0.3"
          />
          
          {/* Elevation line */}
          <path
            d={pathData}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-blue-600 dark:text-blue-400"
          />
          
          {/* Distance labels */}
          <text x={padding} y={height - 5} fontSize="10" fill="currentColor" className="text-gray-500 dark:text-gray-400">
            0km
          </text>
          <text x={svgWidth - padding} y={height - 5} fontSize="10" fill="currentColor" className="text-gray-500 dark:text-gray-400" textAnchor="end">
            {totalDistance.toFixed(1)}km
          </text>
          
          {/* Elevation labels */}
          <text x="5" y={svgHeight - padding + 5} fontSize="10" fill="currentColor" className="text-gray-500 dark:text-gray-400">
            {minElevation.toFixed(0)}m
          </text>
          <text x="5" y={padding + 5} fontSize="10" fill="currentColor" className="text-gray-500 dark:text-gray-400">
            {maxElevation.toFixed(0)}m
          </text>
        </svg>
      </div>
    </div>
  )
}