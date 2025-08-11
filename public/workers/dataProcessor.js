// Web Worker for heavy data processing tasks
self.onmessage = function(e) {
  const { type, data } = e.data
  
  try {
    switch (type) {
      case 'CALCULATE_WEEKLY_MILEAGE':
        const weekly = calculateWeeklyMileage(data.activities)
        self.postMessage({ type: 'WEEKLY_MILEAGE_RESULT', data: weekly })
        break
      
      case 'PROCESS_ACTIVITIES':
        const processed = processActivitiesData(data.activities)
        self.postMessage({ type: 'ACTIVITIES_PROCESSED', data: processed })
        break
        
      case 'CALCULATE_PREDICTIONS':
        const prediction = calculateMarathonPrediction(data.activities)
        self.postMessage({ type: 'PREDICTION_RESULT', data: prediction })
        break
        
      default:
        self.postMessage({ type: 'ERROR', error: `Unknown task type: ${type}` })
    }
  } catch (error) {
    self.postMessage({ type: 'ERROR', error: error.message })
  }
}

function calculateWeeklyMileage(activities) {
  // Safety limit for large datasets
  if (activities.length > 2000) {
    activities = activities.slice(-1000)
  }
  
  const byWeek = new Map()
  
  for (const activity of activities) {
    if (!activity.date) continue
    
    const date = new Date(activity.date)
    const monday = new Date(date)
    const day = monday.getDay() || 7
    
    if (day !== 1) {
      monday.setHours(-24 * (day - 1))
    }
    monday.setHours(0, 0, 0, 0)
    
    const key = monday.toISOString().slice(0, 10)
    const currentKm = byWeek.get(key) || 0
    byWeek.set(key, currentKm + (activity.distance / 1000))
  }
  
  return Array.from(byWeek.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, km]) => ({ week, km }))
}

function processActivitiesData(activities) {
  if (activities.length === 0) {
    return {
      totalDistance: 0,
      totalDuration: 0,
      avgPace: 0,
      totalActivities: 0,
      last7Days: 0,
      last30Days: 0,
      activitiesWithGPS: 0
    }
  }
  
  const now = new Date()
  const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  
  let totalDistance = 0
  let totalDuration = 0
  let last7DaysDistance = 0
  let last30DaysDistance = 0
  let activitiesWithGPS = 0
  
  // Process in chunks to prevent blocking
  const CHUNK_SIZE = 50
  for (let i = 0; i < activities.length; i += CHUNK_SIZE) {
    const chunk = activities.slice(i, i + CHUNK_SIZE)
    
    for (const activity of chunk) {
      totalDistance += activity.distance || 0
      totalDuration += activity.duration || 0
      
      if (activity.trackPoints && activity.trackPoints.length > 0) {
        activitiesWithGPS++
      }
      
      if (activity.date) {
        const activityDate = new Date(activity.date)
        if (activityDate >= last7Days) {
          last7DaysDistance += activity.distance || 0
        }
        if (activityDate >= last30Days) {
          last30DaysDistance += activity.distance || 0
        }
      }
    }
    
    // Yield control periodically
    if (i % (CHUNK_SIZE * 10) === 0) {
      self.postMessage({ 
        type: 'PROGRESS', 
        progress: Math.round((i / activities.length) * 100) 
      })
    }
  }
  
  const avgPace = totalDuration > 0 ? totalDistance / totalDuration : 0
  
  return {
    totalDistance: totalDistance / 1000, // Convert to km
    totalDuration,
    avgPace,
    totalActivities: activities.length,
    last7Days: last7DaysDistance / 1000,
    last30Days: last30DaysDistance / 1000,
    activitiesWithGPS
  }
}

function calculateMarathonPrediction(activities) {
  if (!activities || activities.length === 0) {
    return { seconds: 0, ci: 0, reliability: 'low', basedOnActivities: 0 }
  }
  
  // Filter activities for prediction (runs only, with reasonable distance/duration)
  const validRuns = activities.filter(activity => {
    const distance = activity.distance || 0
    const duration = activity.duration || 0
    
    // Must be at least 2km and have reasonable pace (3-12 min/km)
    if (distance < 2000 || duration < 360) return false
    
    const pace = duration / (distance / 1000) // seconds per km
    return pace >= 180 && pace <= 720 // 3-12 min/km
  }).slice(-50) // Use last 50 valid runs
  
  if (validRuns.length < 3) {
    return { seconds: 0, ci: 0, reliability: 'low', basedOnActivities: validRuns.length }
  }
  
  // Calculate equivalent marathon times using Riegel formula
  const marathonTimes = validRuns.map(activity => {
    const distance = activity.distance / 1000 // Convert to km
    const duration = activity.duration
    const marathonDistance = 42.195
    
    // Riegel formula: T2 = T1 * (D2/D1)^1.06
    return duration * Math.pow(marathonDistance / distance, 1.06)
  })
  
  // Statistical analysis
  marathonTimes.sort((a, b) => a - b)
  
  // Remove outliers (bottom and top 10%)
  const trimmedTimes = marathonTimes.slice(
    Math.floor(marathonTimes.length * 0.1),
    Math.ceil(marathonTimes.length * 0.9)
  )
  
  const mean = trimmedTimes.reduce((sum, time) => sum + time, 0) / trimmedTimes.length
  
  // Calculate standard deviation
  const variance = trimmedTimes.reduce((sum, time) => sum + Math.pow(time - mean, 2), 0) / trimmedTimes.length
  const stdDev = Math.sqrt(variance)
  
  // Confidence interval (±1 standard deviation ≈ 68% confidence)
  const ci = stdDev
  
  // Reliability based on sample size and consistency
  let reliability = 'low'
  if (validRuns.length >= 10 && ci < mean * 0.15) {
    reliability = 'high'
  } else if (validRuns.length >= 5 && ci < mean * 0.25) {
    reliability = 'medium'
  }
  
  return {
    seconds: Math.round(mean),
    ci: Math.round(ci),
    reliability,
    basedOnActivities: validRuns.length
  }
}