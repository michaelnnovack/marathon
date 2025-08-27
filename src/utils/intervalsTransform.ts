import type { SimpleActivity } from '@/types'
import type { IntervalsActivity } from '@/lib/intervalsIcu'

/**
 * Transform intervals.icu activity data to our SimpleActivity format
 */
export function transformIntervalsActivity(activity: IntervalsActivity): SimpleActivity {
  // Safely handle date conversion with fallbacks
  let date: string | undefined
  try {
    date = activity.start_date_local ? new Date(activity.start_date_local).toISOString() : undefined
  } catch {
    console.warn('Invalid date in activity:', activity.id, activity.start_date_local)
    date = undefined
  }

  // Use moving_time if available, otherwise elapsed_time, ensure it's a number
  const duration = Math.max(0, Number(activity.moving_time) || Number(activity.elapsed_time) || 0)

  // Distance is already in meters, ensure it's a number
  const distance = Math.max(0, Number(activity.distance) || 0)

  // Safely convert heart rate values
  const avgHr = activity.average_heartrate ? Math.round(Number(activity.average_heartrate)) : undefined
  const maxHr = activity.max_heartrate ? Math.round(Number(activity.max_heartrate)) : undefined
  
  // Safely convert elevation gain
  const elevationGain = activity.total_elevation_gain ? Number(activity.total_elevation_gain) : undefined
  
  // Safely convert calories
  const calories = activity.calories ? Math.round(Number(activity.calories)) : undefined
  
  // Safely convert average speed
  const avgPace = activity.average_speed ? Number(activity.average_speed) : undefined

  const simpleActivity: SimpleActivity = {
    id: activity.id?.toString() || `intervals-${Date.now()}-${Math.random()}`,
    date,
    distance,
    duration,
    avgHr,
    maxHr,
    elevationGain,
    calories,
    avgPace,
    // Note: We don't have trackPoints from the basic activities endpoint
    // Those would need to be fetched separately from activity details
  }

  return simpleActivity
}

/**
 * Transform an array of intervals.icu activities with robust error handling
 */
export function transformIntervalsActivities(activities: IntervalsActivity[]): SimpleActivity[] {
  if (!Array.isArray(activities)) {
    console.warn('transformIntervalsActivities received non-array:', activities)
    return []
  }

  return activities
    .filter((activity) => {
      // Filter out null/undefined activities
      if (!activity || typeof activity !== 'object') {
        console.warn('Skipping invalid activity:', activity)
        return false
      }
      return true
    })
    .map((activity) => {
      try {
        return transformIntervalsActivity(activity)
      } catch (error) {
        console.warn('Failed to transform activity:', activity.id, error)
        return null
      }
    })
    .filter((activity): activity is SimpleActivity => {
      // Type guard to ensure we have valid activities
      return activity !== null && 
             activity.date !== undefined && 
             activity.distance > 0 && 
             activity.duration > 0
    })
}

/**
 * Parse CSV data from intervals.icu activities.csv endpoint
 * This is an alternative to the JSON endpoint that might provide more data
 */
export function parseIntervalsCSV(csvData: string): SimpleActivity[] {
  const lines = csvData.trim().split('\n')
  if (lines.length < 2) return [] // Need at least header + 1 row

  const headers = lines[0].split(',').map(h => h.trim())
  const activities: SimpleActivity[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: Record<string, string> = {}
    
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })

    // Map common CSV headers to our format
    // Note: Actual headers will depend on intervals.icu CSV format
    const activity: SimpleActivity = {
      id: row.id || `csv-${i}`,
      date: row.start_date_local || row.start_time || undefined,
      distance: parseFloat(row.distance) || 0,
      duration: parseFloat(row.moving_time || row.elapsed_time) || 0,
      avgHr: parseFloat(row.average_heartrate) || undefined,
      maxHr: parseFloat(row.max_heartrate) || undefined,
      elevationGain: parseFloat(row.total_elevation_gain) || undefined,
      calories: parseFloat(row.calories) || undefined,
      avgPace: parseFloat(row.average_speed) || undefined,
    }

    // Only include activities with basic required data
    if (activity.date && activity.distance && activity.duration) {
      activities.push(activity)
    }
  }

  return activities
}

/**
 * Deduplicate activities based on date, distance, and duration
 * This helps prevent duplicates when syncing data
 */
export function deduplicateActivities(activities: SimpleActivity[]): SimpleActivity[] {
  const seen = new Set<string>()
  const unique: SimpleActivity[] = []

  for (const activity of activities) {
    // Create a fingerprint based on date, distance, and duration
    const fingerprint = `${activity.date}-${Math.round(activity.distance)}-${Math.round(activity.duration)}`
    
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint)
      unique.push(activity)
    }
  }

  return unique
}

/**
 * Filter activities to only include runs
 * This helps focus on marathon training specific activities
 */
export function filterRunningActivities(activities: SimpleActivity[]): SimpleActivity[] {
  // Since we don't have activity type in SimpleActivity, we'll use heuristics
  // Running activities typically have:
  // - Distance between 1km and 50km for training
  // - Average pace between 3-8 min/km (reasonable running range)
  
  return activities.filter(activity => {
    const distanceKm = activity.distance / 1000
    const pace = activity.duration / 60 / distanceKm // min/km
    
    // Basic filters for running activities
    return distanceKm >= 1 && // At least 1km
           distanceKm <= 50 && // No more than 50km
           pace >= 3 && // No faster than 3 min/km
           pace <= 8 // No slower than 8 min/km
  })
}