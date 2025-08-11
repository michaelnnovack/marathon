import type { TrackPoint } from '@/types'

export interface Activity {
  startTime?: string
  distance?: number
  duration?: number
  avgHr?: number
  elevationGain?: number
  trackPoints?: TrackPoint[]
}

// Helper function to yield control back to the UI
function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    if ('scheduler' in globalThis && (globalThis as typeof globalThis & { scheduler?: { postTask?: (callback: () => void, options: { priority: string }) => void } }).scheduler?.postTask) {
      ((globalThis as typeof globalThis & { scheduler: { postTask: (callback: () => void, options: { priority: string }) => void } }).scheduler.postTask)(() => resolve(), { priority: 'user-blocking' })
    } else {
      setTimeout(resolve, 0)
    }
  })
}

// Process file in chunks to prevent UI blocking
export async function parseTcx(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<Activity[]> {
  // Limit file size to prevent memory issues
  if (file.size > 50 * 1024 * 1024) { // 50MB limit
    throw new Error('File too large. Maximum size is 50MB.')
  }

  const text = await file.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')
  const activities = Array.from(xml.getElementsByTagName('Activity'))
  const result: Activity[] = []
  const totalActivities = activities.length
  
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i]
    
    // Yield control every 5 activities to prevent UI blocking
    if (i % 5 === 0) {
      onProgress?.(i / totalActivities)
      await yieldToMain()
    }
    const laps = Array.from(act.getElementsByTagName('Lap'))
    let distance = 0, duration = 0, hrTotal = 0, hrCount = 0, elevGain = 0
    const trackPoints: TrackPoint[] = []
    
    for (const lap of laps) {
      const dist = lap.getElementsByTagName('DistanceMeters')[0]?.textContent
      const time = lap.getElementsByTagName('TotalTimeSeconds')[0]?.textContent
      if (dist) distance += parseFloat(dist)
      if (time) duration += parseFloat(time)
      const tracks = Array.from(lap.getElementsByTagName('Trackpoint'))
      let lastAlt: number | null = null
      
      // Process trackpoints in batches to prevent blocking
      const batchSize = 100
      for (let j = 0; j < tracks.length; j += batchSize) {
        const batch = tracks.slice(j, j + batchSize)
        
        for (const tp of batch) {
          const hr = tp.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent
          if (hr) { hrTotal += parseFloat(hr); hrCount++ }
          const alt = tp.getElementsByTagName('AltitudeMeters')[0]?.textContent
          if (alt) {
            const a = parseFloat(alt)
            if (lastAlt != null && a > lastAlt) elevGain += (a - lastAlt)
            lastAlt = a
          }
          
          // Extract position data with more aggressive sampling
          const position = tp.getElementsByTagName('Position')[0]
          if (position) {
            const lat = position.getElementsByTagName('LatitudeDegrees')[0]?.textContent
            const lng = position.getElementsByTagName('LongitudeDegrees')[0]?.textContent
            const time = tp.getElementsByTagName('Time')[0]?.textContent
            
            if (lat && lng) {
              // More aggressive sampling: every 20th point or first 50 points
              const shouldSample = trackPoints.length < 50 || trackPoints.length % 20 === 0
              if (shouldSample && trackPoints.length < 1000) { // Cap at 1000 points
                trackPoints.push({
                  lat: parseFloat(lat),
                  lng: parseFloat(lng),
                  elevation: alt ? parseFloat(alt) : undefined,
                  time
                })
              }
            }
          }
        }
        
        // Yield control after each batch
        if (j + batchSize < tracks.length) {
          await yieldToMain()
        }
      }
    }
    result.push({
      startTime: act.getAttribute('StartTime') || undefined,
      distance, duration,
      avgHr: hrCount ? Math.round(hrTotal / hrCount) : undefined,
      elevationGain: Math.round(elevGain),
      trackPoints: trackPoints.length > 0 ? trackPoints : undefined
    })
  }
  
  onProgress?.(1) // Complete
  return result
}
