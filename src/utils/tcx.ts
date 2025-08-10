import type { TrackPoint } from '@/store/activities'

export interface Activity {
  startTime?: string
  distance?: number
  duration?: number
  avgHr?: number
  elevationGain?: number
  trackPoints?: TrackPoint[]
}

export async function parseTcx(file: File): Promise<Activity[]> {
  const text = await file.text()
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')
  const activities = Array.from(xml.getElementsByTagName('Activity'))
  const result: Activity[] = []
  for (const act of activities) {
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
      
      for (const tp of tracks) {
        const hr = tp.getElementsByTagName('HeartRateBpm')[0]?.getElementsByTagName('Value')[0]?.textContent
        if (hr) { hrTotal += parseFloat(hr); hrCount++ }
        const alt = tp.getElementsByTagName('AltitudeMeters')[0]?.textContent
        if (alt) {
          const a = parseFloat(alt)
          if (lastAlt != null && a > lastAlt) elevGain += (a - lastAlt)
          lastAlt = a
        }
        
        // Extract position data
        const position = tp.getElementsByTagName('Position')[0]
        if (position) {
          const lat = position.getElementsByTagName('LatitudeDegrees')[0]?.textContent
          const lng = position.getElementsByTagName('LongitudeDegrees')[0]?.textContent
          const time = tp.getElementsByTagName('Time')[0]?.textContent
          
          if (lat && lng) {
            // Sample every 10th point to reduce data size
            if (trackPoints.length % 10 === 0 || trackPoints.length < 100) {
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
    }
    result.push({
      startTime: act.getAttribute('StartTime') || undefined,
      distance, duration,
      avgHr: hrCount ? Math.round(hrTotal / hrCount) : undefined,
      elevationGain: Math.round(elevGain),
      trackPoints: trackPoints.length > 0 ? trackPoints : undefined
    })
  }
  return result
}
