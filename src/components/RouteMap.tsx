"use client"
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackPoint } from '@/types'

// Fix Leaflet's default markers in React/Webpack environments
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png'
})

interface RouteMapProps {
  trackPoints: TrackPoint[]
  className?: string
  height?: string
}

export default function RouteMap({ trackPoints, className = '', height = '300px' }: RouteMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapContainer.current || trackPoints.length === 0) return

    // Initialize map if it doesn't exist
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainer.current, {
        zoomControl: true,
        attributionControl: true
      })

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(mapRef.current)
    }

    const map = mapRef.current

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Polyline || layer instanceof L.Marker) {
        map.removeLayer(layer)
      }
    })

    // Convert track points to Leaflet LatLng format
    const latLngs: L.LatLngExpression[] = trackPoints.map(point => [point.lat, point.lng])

    if (latLngs.length > 0) {
      // Create polyline for the route
      const polyline = L.polyline(latLngs, {
        color: '#ef4444',
        weight: 3,
        opacity: 0.8
      }).addTo(map)

      // Add start marker
      const startPoint = trackPoints[0]
      L.marker([startPoint.lat, startPoint.lng])
        .addTo(map)
        .bindPopup('Start')

      // Add end marker
      const endPoint = trackPoints[trackPoints.length - 1]
      if (trackPoints.length > 1) {
        L.marker([endPoint.lat, endPoint.lng])
          .addTo(map)
          .bindPopup('Finish')
      }

      // Fit map to show entire route
      map.fitBounds(polyline.getBounds(), { padding: [10, 10] })
    }

    return () => {
      // Cleanup on unmount
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [trackPoints])

  if (trackPoints.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`} style={{ height }}>
        <p className="text-sm text-gray-500">No route data available</p>
      </div>
    )
  }

  return (
    <div
      ref={mapContainer}
      className={`rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    />
  )
}